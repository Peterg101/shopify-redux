"""
Stripe endpoints — checkout, onboarding, webhooks, payouts, shipping.

Handles all Stripe interactions with direct DB access.
"""
import asyncio
import os
import uuid
import logging
from datetime import datetime

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, selectinload

from dependencies import get_db, get_redis, get_any_user, require_verified_email
from cache import cache_invalidate, cache_invalidate_pattern
from events import publish_event
from stripe_utils import generate_stripe_account, generate_account_link, validate_stripe_header
from shipping import create_shipping_label

from fitd_schemas.fitd_db_schemas import (
    BasketItem, Order, UserStripeAccount, Claim, Disbursement,
)
from fitd_schemas.fitd_classes import CheckoutRequest
from rate_limit import limiter

logger = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

router = APIRouter()


# ── Checkout ─────────────────────────────────────────────────────────────


@router.post("/stripe/checkout", status_code=201)
@limiter.limit("5/minute")
async def create_checkout_session(
    request: Request,
    body: CheckoutRequest,
    user=Depends(require_verified_email),
    db: Session = Depends(get_db),
):
    """Creates a Stripe checkout session from the user's basket items."""
    basket_items = db.query(BasketItem).filter(BasketItem.user_id == user.user_id).all()
    if not basket_items:
        raise HTTPException(status_code=400, detail="Basket is empty")

    line_items = []
    for item in basket_items:
        unit_amount = int(round(float(item.price) * 100))
        line_items.append({
            "price_data": {
                "currency": "gbp",
                "unit_amount": unit_amount,
                "product_data": {
                    "name": item.name,
                    "metadata": {
                        "task_id": item.task_id,
                        "user_id": item.user_id,
                        "material": item.material,
                        "technique": item.technique,
                        "sizing": str(item.sizing),
                        "colour": item.colour,
                        "selectedFile": item.selectedFile,
                        "selectedFileType": item.selectedFileType,
                        "process_id": item.process_id or "",
                        "material_id": item.material_id or "",
                        "tolerance_mm": str(item.tolerance_mm) if item.tolerance_mm is not None else "",
                        "surface_finish": item.surface_finish or "",
                        "special_requirements": item.special_requirements or "",
                    },
                },
            },
            "quantity": item.quantity,
        })

    transfer_group = f"tg_{uuid.uuid4().hex[:16]}"

    session = await asyncio.to_thread(
        stripe.checkout.Session.create,
        mode="payment",
        line_items=line_items,
        shipping_address_collection={
            "allowed_countries": ["GB"],
        },
        payment_intent_data={"transfer_group": transfer_group},
        success_url=f"{FRONTEND_URL}/generate?checkout=success",
        cancel_url=f"{FRONTEND_URL}/generate?checkout=cancelled",
        metadata={"user_id": user.user_id, "is_collaborative": str(body.is_collaborative)},
    )

    return {"checkout_url": session.url}


# ── Onboarding ───────────────────────────────────────────────────────────


@router.post("/stripe/onboard")
async def onboard_user(
    user=Depends(get_any_user),
    db: Session = Depends(get_db),
):
    """Creates or returns a Stripe Express account for the given user."""

    # Step 1: Check if the user already has a Stripe account
    existing = db.query(UserStripeAccount).filter(
        UserStripeAccount.user_id == user.user_id
    ).first()

    if existing:
        if existing.onboarding_complete:
            return {
                "message": "User already onboarded",
                "account_info": {
                    "stripe_account_id": existing.stripe_account_id,
                    "onboarding_complete": existing.onboarding_complete,
                },
            }
        # User has account but incomplete — generate new AccountLink
        return await generate_account_link(existing.stripe_account_id)

    # Step 2: Create a new Stripe account
    stripe_account = await generate_stripe_account(user.email)

    # Step 3: Save the account to DB directly
    record = UserStripeAccount(
        user_id=user.user_id,
        stripe_account_id=stripe_account["id"],
        onboarding_complete=False,
    )
    db.add(record)
    db.commit()

    # Step 4: Generate an onboarding link
    return await generate_account_link(stripe_account["id"])


# ── Webhooks ─────────────────────────────────────────────────────────────


@router.post("/webhook")
async def webhook_handler(
    event=Depends(validate_stripe_header),
    db: Session = Depends(get_db),
    redis_client=Depends(get_redis),
):
    """Consolidated Stripe webhook handler — dispatches by event type."""
    event_type = event["type"]

    if event_type == "account.updated":
        return _handle_account_updated(event, db, redis_client)
    elif event_type == "checkout.session.completed":
        return await _handle_checkout_completed(event, db, redis_client)
    elif event_type == "payment_intent.payment_failed":
        return _handle_payment_failed(event, db)
    elif event_type == "charge.dispute.created":
        return _handle_dispute_created(event, db)
    elif event_type == "charge.refunded":
        return _handle_charge_refunded(event, db)
    else:
        return {"status": "event_ignored", "type": event_type}


def _handle_account_updated(event, db: Session, redis_client):
    account = event["data"]["object"]
    account_id = account["id"]
    charges_enabled = account.get("charges_enabled", False)
    payouts_enabled = account.get("payouts_enabled", False)

    if charges_enabled and payouts_enabled:
        stripe_account = db.query(UserStripeAccount).filter(
            UserStripeAccount.stripe_account_id == account_id
        ).first()
        if not stripe_account:
            return {"status": "error", "detail": "Stripe account not found in DB"}

        stripe_account.onboarding_complete = True
        db.commit()
        cache_invalidate(redis_client, f"fitd:session:{stripe_account.user_id}")
        publish_event(redis_client, "stripe:onboarded", user_id=stripe_account.user_id)
        return {"status": "onboarding_confirmed", "account_id": account_id}

    return {"status": "event_received"}


async def _handle_checkout_completed(event, db: Session, redis_client):
    session = event["data"]["object"]
    if session.get("payment_status") != "paid":
        return {"status": "not_paid"}

    session_id = session["id"]
    user_id = session.get("metadata", {}).get("user_id")
    if not user_id:
        logger.error(f"checkout.session.completed missing user_id in metadata: {session_id}")
        return {"status": "error", "detail": "Missing user_id in session metadata"}

    payment_intent_id = session.get("payment_intent")
    is_collaborative = session.get("metadata", {}).get("is_collaborative", "False") == "True"

    # Retrieve full session with expanded line items
    full_session = await asyncio.to_thread(
        stripe.checkout.Session.retrieve,
        session_id,
        expand=["line_items.data.price.product"],
    )

    transfer_group = None
    if payment_intent_id:
        pi = await asyncio.to_thread(stripe.PaymentIntent.retrieve, payment_intent_id)
        transfer_group = getattr(pi, "transfer_group", None)

    # Check for already-processed (idempotency)
    existing = db.query(Order).filter(
        Order.stripe_checkout_session_id == session_id
    ).first()
    if existing:
        return {"status": "already_processed", "stripe_checkout_session_id": session_id}

    # Extract shipping address
    shipping = getattr(full_session, "shipping_details", None)
    shipping_address = None
    if shipping and getattr(shipping, "address", None):
        shipping_address = {
            "name": shipping.name,
            "line1": shipping.address.line1,
            "line2": getattr(shipping.address, "line2", None),
            "city": shipping.address.city,
            "postal_code": shipping.address.postal_code,
            "country": shipping.address.country,
        }

    # Create orders directly in DB (replaces HTTP call to create_order_from_stripe)
    created_orders = []
    for item in full_session.line_items.data:
        product = item.price.product
        meta = product.metadata

        order = Order(
            stripe_checkout_session_id=session_id,
            user_id=meta.get("user_id", user_id),
            task_id=meta.get("task_id", ""),
            name=product.name,
            material=meta.get("material", ""),
            technique=meta.get("technique", ""),
            sizing=float(meta.get("sizing", 0)),
            colour=meta.get("colour", ""),
            selectedFile=meta.get("selectedFile", ""),
            selectedFileType=meta.get("selectedFileType", ""),
            price=round(item.amount_total / item.quantity) / 100 if item.quantity else item.amount_total / 100,
            quantity=item.quantity,
            created_at=datetime.utcnow().isoformat(),
            is_collaborative=is_collaborative,
            status="created",
            process_id=meta.get("process_id") or None,
            material_id=meta.get("material_id") or None,
            tolerance_mm=float(meta["tolerance_mm"]) if meta.get("tolerance_mm") and meta["tolerance_mm"] not in ("", "None") else None,
            surface_finish=meta.get("surface_finish") or None,
            special_requirements=meta.get("special_requirements", ""),
            shipping_name=shipping_address["name"] if shipping_address else None,
            shipping_line1=shipping_address["line1"] if shipping_address else None,
            shipping_line2=shipping_address.get("line2") if shipping_address else None,
            shipping_city=shipping_address["city"] if shipping_address else None,
            shipping_postal_code=shipping_address["postal_code"] if shipping_address else None,
            shipping_country=shipping_address["country"] if shipping_address else None,
            payment_intent=payment_intent_id,
            transfer_group=transfer_group,
        )
        created_orders.append(order)
        db.add(order)

    # Clear basket
    db.query(BasketItem).filter(BasketItem.user_id == user_id).delete()
    db.commit()

    cache_invalidate(redis_client, f"fitd:orders:{user_id}", f"fitd:basket:{user_id}")
    cache_invalidate_pattern(redis_client, "fitd:claimable:*")
    publish_event(redis_client, "order:created")

    return {"status": "orders_created", "order_count": len(created_orders)}


def _handle_payment_failed(event, db: Session):
    pi = event["data"]["object"]
    payment_intent_id = pi["id"]

    orders = db.query(Order).filter(Order.payment_intent == payment_intent_id).all()
    for order in orders:
        order.status = "payment_failed"
    db.commit()

    return {"status": "payment_failure_recorded", "payment_intent": payment_intent_id}


def _handle_dispute_created(event, db: Session):
    dispute = event["data"]["object"]
    payment_intent_id = dispute.get("payment_intent")
    if not payment_intent_id:
        return {"status": "dispute_ignored", "detail": "no payment_intent on dispute"}

    orders = db.query(Order).filter(Order.payment_intent == payment_intent_id).all()
    if not orders:
        return {"status": "no_orders_found", "payment_intent": payment_intent_id}

    order_ids = [o.order_id for o in orders]
    claims = db.query(Claim).filter(Claim.order_id.in_(order_ids)).all()
    claim_ids = [c.id for c in claims]

    frozen_count = 0
    if claim_ids:
        disbursements = db.query(Disbursement).filter(
            Disbursement.claim_id.in_(claim_ids),
            Disbursement.status == "pending",
        ).all()
        for d in disbursements:
            d.status = "frozen"
            frozen_count += 1
        db.commit()

    return {"status": "disbursements_frozen", "payment_intent": payment_intent_id, "count": frozen_count}


def _handle_charge_refunded(event, db: Session):
    charge = event["data"]["object"]
    payment_intent_id = charge.get("payment_intent")
    if not payment_intent_id:
        return {"status": "refund_ignored", "detail": "no payment_intent on charge"}

    orders = db.query(Order).filter(Order.payment_intent == payment_intent_id).all()
    for order in orders:
        order.status = "refunded"
    db.commit()

    return {"status": "refund_recorded", "payment_intent": payment_intent_id}


# ── Payouts ──────────────────────────────────────────────────────────────


@router.post("/stripe/process_payout/{claim_id}")
async def process_payout(
    claim_id: str,
    user=Depends(get_any_user),
    db: Session = Depends(get_db),
):
    """Processes a Stripe Transfer (payout) for a completed claim."""

    # Fetch pending disbursement directly
    disbursement = db.query(Disbursement).filter(
        Disbursement.claim_id == claim_id,
        Disbursement.status == "pending",
    ).first()
    if not disbursement:
        raise HTTPException(status_code=404, detail="No pending disbursement found")

    # Get payment_intent and transfer_group from the associated order
    claim = db.query(Claim).options(selectinload(Claim.order)).filter(Claim.id == claim_id).first()
    payment_intent_id = None
    order_transfer_group = None
    if claim and claim.order:
        payment_intent_id = claim.order.payment_intent
        order_transfer_group = claim.order.transfer_group

    # Resolve source_transaction from payment_intent
    source_transaction = None
    if payment_intent_id:
        try:
            pi = await asyncio.to_thread(stripe.PaymentIntent.retrieve, payment_intent_id)
            source_transaction = getattr(pi, "latest_charge", None)
        except stripe.error.StripeError:
            logger.warning(f"Could not retrieve PaymentIntent {payment_intent_id} for source_transaction")

    # Get user's Stripe account
    stripe_account = db.query(UserStripeAccount).filter(
        UserStripeAccount.user_id == user.user_id
    ).first()
    if not stripe_account:
        raise HTTPException(status_code=400, detail="User not onboarded with Stripe")
    if not stripe_account.onboarding_complete:
        raise HTTPException(status_code=400, detail="Stripe onboarding not complete")

    # Create Stripe Transfer
    try:
        transfer_kwargs = {
            "amount": disbursement.amount_cents,
            "currency": "gbp",
            "destination": stripe_account.stripe_account_id,
            "description": f"Payout for claim {claim_id}",
            "idempotency_key": f"payout-{claim_id}-{disbursement.id}",
        }
        if order_transfer_group:
            transfer_kwargs["transfer_group"] = order_transfer_group
        if source_transaction:
            transfer_kwargs["source_transaction"] = source_transaction

        transfer = await asyncio.to_thread(stripe.Transfer.create, **transfer_kwargs)
    except stripe.error.StripeError:
        logger.exception("Stripe transfer failed")
        raise HTTPException(status_code=500, detail="Payment transfer failed")

    # Mark disbursement as paid directly
    disbursement.stripe_transfer_id = transfer.id
    if source_transaction:
        disbursement.source_transaction = source_transaction
    if order_transfer_group:
        disbursement.transfer_group = order_transfer_group
    disbursement.status = "paid"
    db.commit()

    return {
        "message": "Payout processed",
        "transfer_id": transfer.id,
        "amount_cents": disbursement.amount_cents,
    }


# ── Shipping ─────────────────────────────────────────────────────────────


@router.post("/shipping/create_label/{claim_id}")
async def create_label_for_claim(
    claim_id: str,
    user=Depends(get_any_user),
    db: Session = Depends(get_db),
):
    """Creates a ShipEngine shipping label for a claim."""

    # 1. Fetch claim + order details (buyer shipping address)
    claim = db.query(Claim).options(selectinload(Claim.order)).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    # Verify the requesting user is the fulfiller
    if claim.claimant_user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Only the fulfiller can create a shipping label")

    order = claim.order
    ship_to = {
        "name": order.shipping_name,
        "line1": order.shipping_line1,
        "line2": order.shipping_line2,
        "city": order.shipping_city,
        "postal_code": order.shipping_postal_code,
        "country": order.shipping_country,
    }
    if not ship_to.get("line1"):
        raise HTTPException(status_code=400, detail="Buyer shipping address not available on this order")

    # 2. Fetch fulfiller address directly
    stripe_account = db.query(UserStripeAccount).filter(
        UserStripeAccount.user_id == user.user_id
    ).first()
    if not stripe_account or not stripe_account.address_line1:
        raise HTTPException(status_code=400, detail="Fulfiller address not set. Please add your shipping address first.")

    ship_from = {
        "name": stripe_account.address_name,
        "line1": stripe_account.address_line1,
        "line2": stripe_account.address_line2,
        "city": stripe_account.address_city,
        "postal_code": stripe_account.address_postal_code,
        "country": stripe_account.address_country,
    }

    # 3. Create ShipEngine label
    try:
        label_result = await create_shipping_label(
            ship_from=ship_from,
            ship_to=ship_to,
        )
    except Exception:
        logger.exception("ShipEngine label creation failed")
        raise HTTPException(status_code=502, detail="Failed to create shipping label")

    # 4. Save shipping info back to claim directly
    claim.tracking_number = label_result["tracking_number"]
    claim.label_url = label_result["label_url"]
    claim.carrier_code = label_result["carrier_code"]
    claim.shipment_id = label_result["shipment_id"]
    db.commit()

    return {
        "label_url": label_result["label_url"],
        "tracking_number": label_result["tracking_number"],
        "carrier_code": label_result["carrier_code"],
    }

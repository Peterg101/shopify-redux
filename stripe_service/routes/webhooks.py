from fastapi import APIRouter, Depends
from utils import validate_stripe_header
from dependencies import get_db_api
from service_client import ServiceClient
from api_calls import (
    create_orders_from_checkout,
    confirm_onboarding,
    update_orders_by_payment_intent,
    freeze_disbursements_by_payment_intent,
)
import asyncio
import logging
import stripe

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhook", tags=["webhook"])


@router.post("")
async def webhook_handler(
    event=Depends(validate_stripe_header),
    db_api: ServiceClient = Depends(get_db_api),
):
    event_type = event["type"]

    if event_type == "account.updated":
        return await handle_account_updated(event, db_api)
    elif event_type == "checkout.session.completed":
        return await handle_checkout_completed(event, db_api)
    elif event_type == "payment_intent.payment_failed":
        return await handle_payment_failed(event, db_api)
    elif event_type == "charge.dispute.created":
        return await handle_dispute_created(event, db_api)
    elif event_type == "charge.refunded":
        return await handle_charge_refunded(event, db_api)
    else:
        return {"status": "event_ignored", "type": event_type}


async def handle_account_updated(event, db_api: ServiceClient):
    account = event["data"]["object"]
    account_id = account["id"]
    charges_enabled = account.get("charges_enabled", False)
    payouts_enabled = account.get("payouts_enabled", False)

    if charges_enabled and payouts_enabled:
        result = await confirm_onboarding(db_api, account_id)
        if result is None:
            return {"status": "error", "detail": "Failed to confirm onboarding in DB"}
        return {"status": "onboarding_confirmed", "account_id": account_id}

    return {"status": "event_received"}


async def handle_checkout_completed(event, db_api: ServiceClient):
    session = event["data"]["object"]
    if session.get("payment_status") != "paid":
        return {"status": "not_paid"}

    session_id = session["id"]
    user_id = session.get("metadata", {}).get("user_id")
    if not user_id:
        logger.error(f"checkout.session.completed missing user_id in metadata: {session_id}")
        return {"status": "error", "detail": "Missing user_id in session metadata"}

    payment_intent_id = session.get("payment_intent")

    full_session = await asyncio.to_thread(
        stripe.checkout.Session.retrieve,
        session_id,
        expand=["line_items.data.price.product"],
    )

    transfer_group = None
    if payment_intent_id:
        pi = await asyncio.to_thread(stripe.PaymentIntent.retrieve, payment_intent_id)
        transfer_group = getattr(pi, "transfer_group", None)

    line_items = []
    for item in full_session.line_items.data:
        product = item.price.product
        meta = product.metadata
        line_items.append({
            "task_id": meta.get("task_id", ""),
            "user_id": meta.get("user_id", user_id),
            "name": product.name,
            "material": meta.get("material", ""),
            "technique": meta.get("technique", ""),
            "sizing": float(meta.get("sizing", 0)),
            "colour": meta.get("colour", ""),
            "selectedFile": meta.get("selectedFile", ""),
            "selectedFileType": meta.get("selectedFileType", ""),
            "price": round(item.amount_total / item.quantity) / 100 if item.quantity else item.amount_total / 100,
            "quantity": item.quantity,
            "process_id": meta.get("process_id") or None,
            "material_id": meta.get("material_id") or None,
            "tolerance_mm": float(meta["tolerance_mm"]) if meta.get("tolerance_mm") else None,
            "surface_finish": meta.get("surface_finish") or None,
            "special_requirements": meta.get("special_requirements", ""),
        })

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

    checkout_payload = {
        "stripe_checkout_session_id": session_id,
        "user_id": user_id,
        "order_status": "created",
        "line_items": line_items,
        "shipping_address": shipping_address,
        "payment_intent": payment_intent_id,
        "transfer_group": transfer_group,
    }

    result = await create_orders_from_checkout(db_api, checkout_payload)
    return {"status": "orders_created", "result": result}


async def handle_payment_failed(event, db_api: ServiceClient):
    pi = event["data"]["object"]
    payment_intent_id = pi["id"]
    await update_orders_by_payment_intent(db_api, payment_intent_id, "payment_failed")
    return {"status": "payment_failure_recorded", "payment_intent": payment_intent_id}


async def handle_dispute_created(event, db_api: ServiceClient):
    dispute = event["data"]["object"]
    payment_intent_id = dispute.get("payment_intent")
    if not payment_intent_id:
        return {"status": "dispute_ignored", "detail": "no payment_intent on dispute"}
    await freeze_disbursements_by_payment_intent(db_api, payment_intent_id)
    return {"status": "disbursements_frozen", "payment_intent": payment_intent_id}


async def handle_charge_refunded(event, db_api: ServiceClient):
    charge = event["data"]["object"]
    payment_intent_id = charge.get("payment_intent")
    if not payment_intent_id:
        return {"status": "refund_ignored", "detail": "no payment_intent on charge"}
    await update_orders_by_payment_intent(db_api, payment_intent_id, "refunded")
    return {"status": "refund_recorded", "payment_intent": payment_intent_id}

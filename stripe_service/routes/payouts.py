import asyncio
import logging
from fastapi import APIRouter, HTTPException, Depends
from utils import cookie_verification_user_only
from dependencies import get_db_api
from service_client import ServiceClient
from api_calls import (
    get_pending_disbursement,
    check_user_stripe_onboarded,
    mark_disbursement_paid,
)
import stripe

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stripe", tags=["stripe"])


@router.post("/process_payout/{claim_id}")
async def process_payout(
    claim_id: str,
    user=Depends(cookie_verification_user_only),
    db_api: ServiceClient = Depends(get_db_api),
):
    # Fetch pending disbursement
    disbursement = await get_pending_disbursement(db_api, claim_id)
    if not disbursement:
        raise HTTPException(status_code=404, detail="No pending disbursement found")

    # Resolve source_transaction from payment_intent
    payment_intent_id = disbursement.get("payment_intent")
    source_transaction = None
    if payment_intent_id:
        try:
            pi = await asyncio.to_thread(stripe.PaymentIntent.retrieve, payment_intent_id)
            source_transaction = getattr(pi, "latest_charge", None)
        except stripe.error.StripeError:
            logger.warning(f"Could not retrieve PaymentIntent {payment_intent_id} for source_transaction")

    # Get user's Stripe account
    stripe_info = await check_user_stripe_onboarded(db_api, user.user_id)
    if not stripe_info:
        raise HTTPException(status_code=400, detail="User not onboarded with Stripe")
    if not stripe_info.get("onboarding_complete"):
        raise HTTPException(status_code=400, detail="Stripe onboarding not complete")

    # Create Stripe Transfer
    try:
        transfer_kwargs = {
            "amount": disbursement["amount_cents"],
            "currency": "gbp",
            "destination": stripe_info["stripe_account_id"],
            "description": f"Payout for claim {claim_id}",
            "idempotency_key": f"payout-{claim_id}-{disbursement['id']}",
        }
        if disbursement.get("transfer_group"):
            transfer_kwargs["transfer_group"] = disbursement["transfer_group"]
        if source_transaction:
            transfer_kwargs["source_transaction"] = source_transaction

        transfer = await asyncio.to_thread(stripe.Transfer.create, **transfer_kwargs)
    except stripe.error.StripeError:
        logger.exception("Stripe transfer failed")
        raise HTTPException(status_code=500, detail="Payment transfer failed")

    # Mark disbursement as paid
    result = await mark_disbursement_paid(
        db_api,
        disbursement_id=disbursement["id"],
        stripe_transfer_id=transfer.id,
        source_transaction=source_transaction,
        transfer_group=disbursement.get("transfer_group"),
    )
    if not result:
        raise HTTPException(status_code=500, detail="Failed to mark disbursement as paid")

    return {
        "message": "Payout processed",
        "transfer_id": transfer.id,
        "amount_cents": disbursement["amount_cents"],
    }

import asyncio
import logging
from fastapi import APIRouter, HTTPException, Depends
from utils import cookie_verification_user_only
from jwt_auth import generate_token
import httpx
import stripe
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stripe", tags=["stripe"])

DB_SERVICE_URL = os.getenv("DB_SERVICE_URL", "http://localhost:8000")
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")


@router.post("/process_payout/{claim_id}")
async def process_payout(claim_id: str, user=Depends(cookie_verification_user_only)):
    auth_token = generate_token("stripe_service")
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        # Fetch pending disbursement
        disb_response = await client.get(
            f"{DB_SERVICE_URL}/disbursements/pending/{claim_id}",
            headers=headers,
        )
        if disb_response.status_code != 200:
            raise HTTPException(status_code=404, detail="No pending disbursement found")

        disbursement = disb_response.json()

        # Get user's Stripe account
        stripe_response = await client.get(
            f"{DB_SERVICE_URL}/user_onboarded_with_stripe/{user.user_id}",
            headers=headers,
        )
        if stripe_response.status_code != 200:
            raise HTTPException(status_code=400, detail="User not onboarded with Stripe")

        stripe_info = stripe_response.json()
        if not stripe_info.get("onboarding_complete"):
            raise HTTPException(status_code=400, detail="Stripe onboarding not complete")

        # Create Stripe Transfer
        try:
            transfer = await asyncio.to_thread(
                stripe.Transfer.create,
                amount=disbursement["amount_cents"],
                currency="gbp",
                destination=stripe_info["stripe_account_id"],
                description=f"Payout for claim {claim_id}",
                idempotency_key=f"payout-{claim_id}-{disbursement['id']}",
            )
        except stripe.error.StripeError:
            logger.exception("Stripe transfer failed")
            raise HTTPException(status_code=500, detail="Payment transfer failed")

        # Mark disbursement as paid
        paid_response = await client.patch(
            f"{DB_SERVICE_URL}/disbursements/{disbursement['id']}/paid",
            headers=headers,
            json={"stripe_transfer_id": transfer.id},
        )
        if paid_response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to mark disbursement as paid")

    return {
        "message": "Payout processed",
        "transfer_id": transfer.id,
        "amount_cents": disbursement["amount_cents"],
    }

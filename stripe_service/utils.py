from fastapi import Request, HTTPException
from fitd_schemas.fitd_classes import UserInformation
from fitd_schemas.auth_utils import cookie_verification as _cookie_verification, cookie_verification_user_only as _cookie_verification_user_only
from api_calls import session_exists, session_exists_user_only
import asyncio
import os
import logging
import stripe


logger = logging.getLogger(__name__)

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
REFRESH_URL = f"{FRONTEND_URL}/fulfill"
RETURN_URL = f"{FRONTEND_URL}/fulfill"
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

async def cookie_verification(request: Request):
    return await _cookie_verification(request, session_exists)


async def cookie_verification_user_only(request: Request) -> UserInformation:
    return await _cookie_verification_user_only(request, session_exists_user_only)


async def generate_stripe_account(email: str):
    stripe.api_key = STRIPE_SECRET_KEY
    stripe_account = await asyncio.to_thread(
        stripe.Account.create,
        type="express",
        country="GB",
        email=email
    )

    return stripe_account


async def generate_account_link(account_id: str):
    stripe.api_key = STRIPE_SECRET_KEY
    account_link = await asyncio.to_thread(
        stripe.AccountLink.create,
        account=account_id,
        refresh_url=REFRESH_URL,
        return_url=RETURN_URL,
        type="account_onboarding"
    )
    return {"onboarding_url": account_link["url"]}


async def validate_stripe_header(request: Request):
    # Read raw body bytes (do NOT json.loads first)
    body_bytes = await request.body()

    # Header key is case-insensitive, but use the canonical name
    sig_header = request.headers.get("stripe-signature") or request.headers.get("Stripe-Signature")
    if not sig_header:
        # No signature header from Stripe — reject
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    # Verify the signature & construct event using the raw body
    try:
        event = stripe.Webhook.construct_event(
            payload=body_bytes,
            sig_header=sig_header,
            secret=STRIPE_WEBHOOK_SECRET,
        )
        return event
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")
        
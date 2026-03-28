"""Stripe SDK utility functions — account creation, onboarding links, webhook validation."""
import asyncio
import os
import logging
import stripe
from fastapi import Request, HTTPException

logger = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
REFRESH_URL = f"{FRONTEND_URL}/fulfill"
RETURN_URL = f"{FRONTEND_URL}/fulfill"
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")


async def generate_stripe_account(email: str):
    """Creates a Stripe Express account for the given email."""
    stripe_account = await asyncio.to_thread(
        stripe.Account.create,
        type="express",
        country="GB",
        email=email,
    )
    return stripe_account


async def generate_account_link(account_id: str):
    """Generates a Stripe AccountLink for onboarding."""
    account_link = await asyncio.to_thread(
        stripe.AccountLink.create,
        account=account_id,
        refresh_url=REFRESH_URL,
        return_url=RETURN_URL,
        type="account_onboarding",
    )
    return {"onboarding_url": account_link["url"]}


async def validate_stripe_header(request: Request):
    """FastAPI dependency: validates Stripe webhook signature and returns the event."""
    body_bytes = await request.body()

    sig_header = request.headers.get("stripe-signature") or request.headers.get("Stripe-Signature")
    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    try:
        event = stripe.Webhook.construct_event(
            payload=body_bytes,
            sig_header=sig_header,
            secret=STRIPE_WEBHOOK_SECRET,
        )
        return event
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")

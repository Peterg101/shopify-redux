from fastapi import Request, HTTPException
from fitd_schemas.fitd_classes import UserInformation, LineItem, ShopifyOrder, ShippingAddress
from fitd_schemas.fitd_db_schemas import BasketItem
from typing import List, Dict
from api_calls import session_exists, session_exists_user_only
from datetime import datetime
import uuid
import hmac
import hashlib
import base64
import os
from pydantic import ValidationError
import logging
import stripe
from typing import Optional


SHOPIFY_WEBHOOK_SECRET = os.getenv("SHOPIFY_WEBHOOK_SECRET") 
STRIPE_SECRET_KEY = os.getenv("SECRET_KEY")
REFRESH_URL = "http://localhost:3000/fulfill"
RETURN_URL = "http://localhost:3000/fulfill"
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

async def cookie_verification(request: Request):
    session_id = request.cookies.get("fitd_session_data")
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = await session_exists(session_id)
    if not session_data:
        raise HTTPException(status_code=401, detail="No Session Found")


async def cookie_verification_user_only(request: Request) -> UserInformation:
    session_id = request.cookies.get("fitd_session_data")
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = await session_exists_user_only(session_id)
    if not session_data:
        raise HTTPException(status_code=401, detail="No Session Found")

    return session_data


async def generate_stripe_account(email: str):
    stripe.api_key = STRIPE_SECRET_KEY
    stripe_account = stripe.Account.create(
        type="express",
        country="GB",
        email=email
    )

    return stripe_account


async def generate_account_link(account_id: str):
    stripe.api_key = STRIPE_SECRET_KEY
    account_link = stripe.AccountLink.create(
        account=account_id,
        refresh_url=REFRESH_URL,
        return_url=RETURN_URL,
        type="account_onboarding"
    )
    print(account_link["url"])
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
    except:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")
        
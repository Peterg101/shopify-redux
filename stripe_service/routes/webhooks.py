from fastapi import APIRouter, Request, Header, HTTPException
from fitd_schemas.fitd_classes import UserInformation
from jwt_auth import generate_token
import hmac
import hashlib
import base64
import json
import requests
import os
import stripe
# from utils import verify_shopify_hmac, extract_order_info_from_webhook

router = APIRouter(prefix="/webhook", tags=["webhook"])
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")  # ensure set
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

@router.post("/confirm_user_onboarded")
async def user_onboarded_webhook(request: Request):
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
    except:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")

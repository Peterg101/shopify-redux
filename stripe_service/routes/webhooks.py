from fastapi import APIRouter, Request, Header, HTTPException, Depends
from fitd_schemas.fitd_classes import UserInformation
from utils import validate_stripe_header
from jwt_auth import generate_token
import hmac
import hashlib
import base64
import json
import httpx
import os
import stripe

router = APIRouter(prefix="/webhook", tags=["webhook"])
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

DB_SERVICE_URL = os.getenv("DB_SERVICE_URL", "http://localhost:8000")


@router.post("/confirm_user_onboarded")
async def user_onboarded_webhook(event=Depends(validate_stripe_header)):
    if event["type"] == "account.updated":
        account = event["data"]["object"]
        account_id = account["id"]
        charges_enabled = account.get("charges_enabled", False)
        payouts_enabled = account.get("payouts_enabled", False)

        if charges_enabled and payouts_enabled:
            auth_token = generate_token("stripe_service")
            headers = {
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json",
            }
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{DB_SERVICE_URL}/stripe/confirm_onboarding/{account_id}",
                    headers=headers,
                )
                if response.status_code != 200:
                    return {"status": "error", "detail": "Failed to confirm onboarding in DB"}

            return {"status": "onboarding_confirmed", "account_id": account_id}

    return {"status": "event_received"}

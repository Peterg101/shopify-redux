from fastapi import APIRouter, Request, Header, HTTPException, Depends
from fitd_schemas.fitd_classes import UserInformation
from utils import validate_stripe_header
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
async def user_onboarded_webhook(event=Depends(validate_stripe_header)):
    print("HIt this heeeeeere")
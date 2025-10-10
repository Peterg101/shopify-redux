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

SHOPIFY_WEBHOOK_SECRET = os.getenv("SHOPIFY_WEBHOOK_SECRET") 


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

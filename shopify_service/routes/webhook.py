from fastapi import APIRouter, Request, Header, HTTPException
from fitd_schemas.fitd_classes import UserInformation
from jwt_auth import generate_token
import hmac
import hashlib
import base64
import json
import requests
from utils import verify_shopify_hmac, extract_order_info_from_webhook

router = APIRouter(prefix="/webhook", tags=["webhook"])

@router.post("/shopify/webhooks/order-created")
async def order_created_webhook(
    request: Request,
    x_shopify_hmac_sha256: str = Header(None)
):
    body = await request.body()
    verify_shopify_hmac(body, x_shopify_hmac_sha256)
    payload = json.loads(body)
    shopify_order = extract_order_info_from_webhook(payload)
    server_url = "http://localhost:8000/orders/create_order"
    auth_token = generate_token("shopify_service")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}", 
    }
    response = requests.post(
        server_url, json=shopify_order.dict(), headers=headers
    )
    print("Response from server:", response.json())

    return {"status": "ok"}

@router.post("/shopify/webhooks/order-fulfilled")
async def order_fulfilled_webhook(
    request: Request,
    x_shopify_hmac_sha256: str = Header(None)
):
    body = await request.body()
    verify_shopify_hmac(body, x_shopify_hmac_sha256)

    payload = json.loads(body)
    print("Order fulfilled:", payload)
    shopify_order = extract_order_info_from_webhook(
        payload,
        order_status="fulfilled"
    )
    server_url = "http://localhost:8000/orders/update_order"
    auth_token = generate_token("shopify_service")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}", 
    }
    response = requests.post(
        server_url, json=shopify_order.dict(), headers=headers
    )
    print("Response from server:", response.json())

    return {"status": "ok"}


@router.post("/shopify/webhooks/order-cancelled")
async def order_cancelled_webhook(
    request: Request,
    x_shopify_hmac_sha256: str = Header(None)
):
    body = await request.body()
    verify_shopify_hmac(body, x_shopify_hmac_sha256)

    payload = json.loads(body)
    print("Order Cancelled:", payload)
    shopify_order = extract_order_info_from_webhook(
        payload,
        order_status="cancelled"
    )
    server_url = "http://localhost:8000/orders/update_order"
    auth_token = generate_token("shopify_service")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}", 
    }
    response = requests.post(
        server_url, json=shopify_order.dict(), headers=headers
    )
    print("Response from server:", response.json())

    return {"status": "ok"}

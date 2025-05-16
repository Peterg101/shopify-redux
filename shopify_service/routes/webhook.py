from fastapi import APIRouter, Request, Header, HTTPException
from shopify_client import ShopifyClient
import hmac
import hashlib
import base64
import json
from utils import verify_shopify_hmac

router = APIRouter(prefix="/webhook", tags=["webhook"])

@router.post("/shopify/webhooks/order-created")
async def order_created_webhook(
    request: Request,
    x_shopify_hmac_sha256: str = Header(None)
):
    body = await request.body()
    verify_shopify_hmac(body, x_shopify_hmac_sha256)


    payload = json.loads(body)
    print("New order created:", payload)

    # Do something with the order data (e.g., save to your database)
    # Example: order_id = payload["id"], customer_email = payload["email"]

    return {"status": "ok"}


@router.post("/shopify/webhooks/order-paid")
async def order_paid_webhook(
    request: Request,
    x_shopify_hmac_sha256: str = Header(None)
):
    body = await request.body()
    verify_shopify_hmac(body, x_shopify_hmac_sha256)

    payload = json.loads(body)
    print("Order paid:", payload)

    # Example: mark order as paid in your DB
    # db.mark_order_paid(payload["id"])

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

    # db.mark_order_fulfilled(payload["id"])

    return {"status": "ok"}


@router.post("/shopify/webhooks/order-cancelled")
async def order_cancelled_webhook(
    request: Request,
    x_shopify_hmac_sha256: str = Header(None)
):
    body = await request.body()
    verify_shopify_hmac(body, x_shopify_hmac_sha256)

    payload = json.loads(body)
    print("Order cancelled:", payload)

    # db.cancel_order(payload["id"])

    return {"status": "ok"}

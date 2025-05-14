from fastapi import APIRouter, Request, Header, HTTPException
from shopify_client import ShopifyClient
import hmac
import hashlib
import base64
import json

router = APIRouter(prefix="/webhook", tags=["webhook"])

SHOPIFY_WEBHOOK_SECRET = "your_shopify_webhook_secret_here"


@router.post("/shopify/webhooks/order-created")
async def order_created_webhook(
    request: Request,
    x_shopify_hmac_sha256: str = Header(None)
):
    body = await request.body()

    # Verify the HMAC signature
    digest = hmac.new(
        key=SHOPIFY_WEBHOOK_SECRET.encode("utf-8"),
        msg=body,
        digestmod=hashlib.sha256
    ).digest()
    computed_hmac = base64.b64encode(digest).decode()

    if not hmac.compare_digest(computed_hmac, x_shopify_hmac_sha256):
        raise HTTPException(status_code=401, detail="Invalid HMAC")

    # Parse the JSON payload
    payload = json.loads(body)
    print("New order created:", payload)

    # Do something with the order data (e.g., save to your database)
    # Example: order_id = payload["id"], customer_email = payload["email"]

    return {"status": "ok"}

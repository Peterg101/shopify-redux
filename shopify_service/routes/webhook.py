from fastapi import APIRouter, Request, Header
from shopify_client import ShopifyClient

router = APIRouter(prefix="/webhook", tags=["webhook"])

shopify = ShopifyClient()


@router.post("/")
async def receive_webhook(
    request: Request,
    x_shopify_hmac_sha256: str = Header(None),
):
    raw_body = await request.body()

    # Optional: verify webhook authenticity
    is_valid = await shopify.verify_webhook(raw_body, x_shopify_hmac_sha256)
    if not is_valid:
        return {"status": "invalid webhook"}

    payload = await request.json()

    # Here you can handle specific webhook events like:
    event_topic = request.headers.get("X-Shopify-Topic")
    if event_topic == "orders/paid":
        print("Order was paid!", payload)
    elif event_topic == "checkouts/create":
        print("Checkout created", payload)
    
    return {"status": "success"}

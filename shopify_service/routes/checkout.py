from fastapi import APIRouter
from shopify_client import ShopifyClient

router = APIRouter(prefix="/checkout", tags=["checkout"])

shopify = ShopifyClient()

@router.post("/")
async def create_checkout(order_details: dict):
    # You would validate and clean up `order_details` first
    # Build the Shopify checkout payload
    payload = {
        "line_items": [
            {
                "title": order_details["name"],
                "price": order_details["price"],
                "quantity": order_details["quantity"],
            }
        ],
        "email": order_details.get("email"),
        "shipping_address": order_details.get("shipping_address"),
    }
    
    checkout_data = await shopify.create_checkout(payload)
    return {"checkout_url": checkout_data["checkout"]["web_url"]}

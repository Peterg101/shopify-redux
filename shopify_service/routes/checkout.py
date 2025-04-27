from fastapi import APIRouter, Request, Depends
from shopify_client import ShopifyClient
from utils import (
    cookie_verification,
    cookie_verification_user_only,
    convert_basket_items_to_orders
)
from api_calls import get_all_basket_items

router = APIRouter(prefix="/checkout", tags=["checkout"])
shopify = ShopifyClient()

@router.post("/")
async def create_checkout(
    request: Request,
    user_info: None = Depends(cookie_verification_user_only)
):
    basket_items = await get_all_basket_items(user_info.user_id)
    line_items = convert_basket_items_to_orders(basket_items)
    checkout_payload = {
        "line_items": line_items,
        "email": user_info.email  
    }
    checkout_response = await shopify.create_checkout(checkout_payload)
    return {
        "checkout_url": checkout_response["checkout"]["web_url"]
    }
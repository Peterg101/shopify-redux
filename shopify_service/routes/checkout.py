from fastapi import APIRouter, Request, Depends
from shopify_client import ShopifyClient
import os
import httpx
from utils import (
    cookie_verification,
    cookie_verification_user_only,
    convert_basket_items_to_line_items
)
from api_calls import get_all_basket_items

router = APIRouter(prefix="/checkout", tags=["checkout"])
shopify = ShopifyClient()

@router.post("/checkout/")
async def create_checkout():
    storefront_token = os.getenv("SHOPIFY_STOREFRONT_ACCESS_TOKEN")
    
    graphql_query = """
    mutation {
      checkoutCreate(input: {
        lineItems: [
          {
            variantId: "gid://shopify/ProductVariant/123456789",
            quantity: 2
          }
        ]
      }) {
        checkout {
          id
          webUrl
        }
        userErrors {
          field
          message
        }
      }
    }
    """
    headers = {
        "X-Shopify-Storefront-Access-Token": storefront_token,
        "Content-Type": "application/json",
    }

    response = await httpx.post(
        "https://fitdai.myshopify.com/api/2023-04/graphql.json",
        headers=headers,
        json={"query": graphql_query},
    )
    response.raise_for_status()
    return response.json()
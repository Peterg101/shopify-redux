from fastapi import APIRouter, Depends, HTTPException
from shopify_client import ShopifyClient
from utils import cookie_verification_user_only, convert_basket_items_to_shopify_graphql_line_items, convert_basket_items_to_checkout_api_line_items
from api_calls import get_all_basket_items
import os
import httpx

router = APIRouter(prefix="/checkout", tags=["checkout"])
shopify = ShopifyClient()


@router.post("/")
async def create_checkout(user=Depends(cookie_verification_user_only)):

    basket_items = await get_all_basket_items(user.user_id)
    if not basket_items:
        raise HTTPException(status_code=400, detail="Basket is empty")
    line_items = convert_basket_items_to_shopify_graphql_line_items(
        basket_items
        )
    graphql_query = f"""
    mutation {{
      draftOrderCreate(input: {{
        lineItems: [
          {",".join(line_items)}
        ],
        email: "{user.email}",
        useCustomerDefaultAddress: true,
      }}) {{
        draftOrder {{
          id
          invoiceUrl
        }}
        userErrors {{
          field
          message
        }}
      }}
    }}
    """
    headers = {
        "X-Shopify-Access-Token": os.getenv("SHOPIFY_ACCESS_TOKEN"),
        "Content-Type": "application/json",
    }

    response = httpx.post(
        f"{os.getenv('SHOPIFY_STORE_URL')}/admin/api/2023-04/graphql.json",
        headers=headers,
        json={"query": graphql_query},
    )
    response.raise_for_status()

    data = response.json()
    print(data)
    # errors = data["data"]["draftOrderCreate"]["userErrors"]
    # if errors:
    #     raise HTTPException(status_code=400, detail=errors)

    return {
        "checkout_url": data["data"]["draftOrderCreate"]["draftOrder"]["invoiceUrl"]
    }



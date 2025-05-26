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


def convert_basket_items_to_shopify_graphql_line_items(basket_items: List[BasketItem], user_id: str) -> List[str]:
    line_items = []
    for item in basket_items:
        properties_block = ", ".join([
            f'''{{ key: "Task Id", value: "{item.task_id}" }}'''
            f'''{{ key: "Material", value: "{item.material}" }}''',
            f'''{{ key: "Technique", value: "{item.technique}" }}''',
            f'''{{ key: "Sizing", value: "{item.sizing}" }}''',
            f'''{{ key: "Colour", value: "{item.colour}" }}''',
            f'''{{ key: "Selected File Type", value: "{item.selectedFileType}" }}''',
            f'''{{ key: "Selected File", value: "{item.selectedFile}" }}'''
            f'''{{ key: "User Id", value: "{user_id}" }}'''
        ])

        line_item_block = f"""
        {{
            title: "{item.name}",
            quantity: {item.quantity},
            originalUnitPrice: "{item.price:.2f}",
            customAttributes: [{properties_block}]
        }}
        """
        line_items.append(line_item_block.strip())
    return line_items


def convert_basket_items_to_checkout_api_line_items(basket_items: List) -> List[Dict]:
    line_items = []
    for item in basket_items:
        custom_attributes = [
            {"name": "Material", "value": item.material},
            {"name": "Technique", "value": item.technique},
            {"name": "Sizing", "value": item.sizing},
            {"name": "Colour", "value": item.colour},
            {"name": "File Type", "value": item.selectedFileType},
            {"name": "File Name", "value": item.selectedFile}
        ]

        line_item = {
            "title": item.name,  # Optional: Shopify will ignore this if variant_id is used
            "quantity": item.quantity,
            "price": f"{item.price:.2f}",  # Optional: if you're using a custom app to generate prices
            "custom_attributes": custom_attributes,
            # "variant_id": item.variant_id,  # Uncomment if you're using real Shopify product variants
        }

        line_items.append(line_item)
    return line_items   


def verify_shopify_hmac(body: bytes, hmac_header: str):
    digest = hmac.new(
        key=SHOPIFY_WEBHOOK_SECRET.encode("utf-8"),
        msg=body,
        digestmod=hashlib.sha256
    ).digest()
    computed_hmac = base64.b64encode(digest).decode()

    if not hmac.compare_digest(computed_hmac, hmac_header):
        raise HTTPException(status_code=401, detail="Invalid HMAC")
    

def extract_order_info_from_webhook(
    webhook_payload: Dict, 
    order_status: str = "created"
) -> ShopifyOrder:
    line_items = [LineItem(**item) for item in webhook_payload.get("line_items", [])]
    shipping_address = ShippingAddress(**webhook_payload.get("billing_address", {}))

    shopify_order = ShopifyOrder(
        id=webhook_payload["id"],
        order_status=order_status,
        line_items=line_items,
        shipping_address=shipping_address
    )
    return shopify_order



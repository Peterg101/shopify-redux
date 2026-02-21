from fastapi import Request, HTTPException
from fitd_schemas.fitd_classes import UserInformation, LineItem, ShopifyOrder, ShippingAddress
from fitd_schemas.fitd_db_schemas import BasketItem
from fitd_schemas.auth_utils import cookie_verification as _cookie_verification, cookie_verification_user_only as _cookie_verification_user_only
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
    return await _cookie_verification(request, session_exists)


async def cookie_verification_user_only(request: Request) -> UserInformation:
    return await _cookie_verification_user_only(request, session_exists_user_only)


def convert_basket_items_to_shopify_graphql_line_items(basket_items: List[BasketItem], user_id: str) -> List[str]:
    line_items = []
    for item in basket_items:
        properties_block = ", ".join([
            f'''{{ key: "Task Id", value: "{item.task_id}" }}''',
            f'''{{ key: "Material", value: "{item.material}" }}''',
            f'''{{ key: "Technique", value: "{item.technique}" }}''',
            f'''{{ key: "Sizing", value: "{item.sizing}" }}''',
            f'''{{ key: "Colour", value: "{item.colour}" }}''',
            f'''{{ key: "Selected File Type", value: "{item.selectedFileType}" }}''',
            f'''{{ key: "Selected File", value: "{item.selectedFile}" }}''',
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
    try:
        if "id" not in webhook_payload:
            raise ValueError("Missing 'id' field in webhook payload.")

        line_items_raw = webhook_payload.get("line_items", [])
        if not isinstance(line_items_raw, list):
            raise ValueError("'line_items' must be a list.")

        line_items = []
        for item in line_items_raw:
            try:
                line_items.append(LineItem(**item))
            except ValidationError as ve:
                logging.warning(f"Invalid line item skipped: {ve.json()}")

        if not line_items:
            raise ValueError("No valid line items found in webhook payload.")

        shipping_data = webhook_payload.get("billing_address", {})
        shipping_address = ShippingAddress(**shipping_data)

        shopify_order = ShopifyOrder(
            id=webhook_payload["id"],
            order_status=order_status,
            line_items=line_items,
            shipping_address=shipping_address
        )
        return shopify_order

    except (ValidationError, ValueError, KeyError) as e:
        raise HTTPException(
            status_code=400,
            detail=f"Malformed Shopify webhook payload: {str(e)}"
        )



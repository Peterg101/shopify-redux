import asyncio
import os
import logging
import uuid
import stripe
from fastapi import APIRouter, Depends, HTTPException
from utils import cookie_verification_user_only
from dependencies import get_db_api
from service_client import ServiceClient
from api_calls import get_all_basket_items

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stripe", tags=["checkout"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


@router.post("/checkout", status_code=201)
async def create_checkout_session(
    user=Depends(cookie_verification_user_only),
    db_api: ServiceClient = Depends(get_db_api),
):
    basket_items = await get_all_basket_items(db_api, user.user_id)
    if not basket_items:
        raise HTTPException(status_code=400, detail="Basket is empty")

    line_items = []
    for item in basket_items:
        unit_amount = int(round(float(item["price"]) * 100))
        line_items.append({
            "price_data": {
                "currency": "gbp",
                "unit_amount": unit_amount,
                "product_data": {
                    "name": item["name"],
                    "metadata": {
                        "task_id": item["task_id"],
                        "user_id": item["user_id"],
                        "material": item["material"],
                        "technique": item["technique"],
                        "sizing": str(item["sizing"]),
                        "colour": item["colour"],
                        "selectedFile": item["selectedFile"],
                        "selectedFileType": item["selectedFileType"],
                        "process_id": item.get("process_id", ""),
                        "material_id": item.get("material_id", ""),
                        "tolerance_mm": str(item.get("tolerance_mm", "")),
                        "surface_finish": item.get("surface_finish", ""),
                        "special_requirements": item.get("special_requirements", ""),
                    },
                },
            },
            "quantity": item["quantity"],
        })

    transfer_group = f"tg_{uuid.uuid4().hex[:16]}"

    session = await asyncio.to_thread(
        stripe.checkout.Session.create,
        mode="payment",
        line_items=line_items,
        shipping_address_collection={
            "allowed_countries": ["GB"],
        },
        payment_intent_data={"transfer_group": transfer_group},
        success_url=f"{FRONTEND_URL}/generate?checkout=success",
        cancel_url=f"{FRONTEND_URL}/generate?checkout=cancelled",
        metadata={"user_id": user.user_id},
    )

    return {"checkout_url": session.url}

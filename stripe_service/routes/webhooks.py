from fastapi import APIRouter, Request, Header, HTTPException, Depends
from utils import validate_stripe_header
from api_calls import create_orders_from_checkout
from jwt_auth import generate_token
import asyncio
import logging
import httpx
import os
import stripe

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhook", tags=["webhook"])
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

DB_SERVICE_URL = os.getenv("DB_SERVICE_URL", "http://localhost:8000")


@router.post("/confirm_user_onboarded")
async def user_onboarded_webhook(event=Depends(validate_stripe_header)):
    if event["type"] == "account.updated":
        account = event["data"]["object"]
        account_id = account["id"]
        charges_enabled = account.get("charges_enabled", False)
        payouts_enabled = account.get("payouts_enabled", False)

        if charges_enabled and payouts_enabled:
            auth_token = generate_token("stripe_service")
            headers = {
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json",
            }
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{DB_SERVICE_URL}/stripe/confirm_onboarding/{account_id}",
                    headers=headers,
                )
                if response.status_code != 200:
                    return {"status": "error", "detail": "Failed to confirm onboarding in DB"}

            return {"status": "onboarding_confirmed", "account_id": account_id}

    return {"status": "event_received"}


@router.post("/checkout_completed")
async def checkout_completed_webhook(event=Depends(validate_stripe_header)):
    if event["type"] != "checkout.session.completed":
        return {"status": "event_ignored"}

    session = event["data"]["object"]
    if session.get("payment_status") != "paid":
        return {"status": "not_paid"}

    session_id = session["id"]
    user_id = session.get("metadata", {}).get("user_id")
    if not user_id:
        logger.error(f"checkout.session.completed missing user_id in metadata: {session_id}")
        return {"status": "error", "detail": "Missing user_id in session metadata"}

    # Retrieve the full session with expanded line items
    full_session = await asyncio.to_thread(
        stripe.checkout.Session.retrieve,
        session_id,
        expand=["line_items.data.price.product"],
    )

    line_items = []
    for item in full_session.line_items.data:
        product = item.price.product
        meta = product.metadata
        line_items.append({
            "task_id": meta.get("task_id", ""),
            "user_id": meta.get("user_id", user_id),
            "name": product.name,
            "material": meta.get("material", ""),
            "technique": meta.get("technique", ""),
            "sizing": float(meta.get("sizing", 0)),
            "colour": meta.get("colour", ""),
            "selectedFile": meta.get("selectedFile", ""),
            "selectedFileType": meta.get("selectedFileType", ""),
            "price": item.amount_total / item.quantity / 100 if item.quantity else item.amount_total / 100,
            "quantity": item.quantity,
            "process_id": meta.get("process_id") or None,
            "material_id": meta.get("material_id") or None,
            "tolerance_mm": float(meta["tolerance_mm"]) if meta.get("tolerance_mm") else None,
            "surface_finish": meta.get("surface_finish") or None,
            "special_requirements": meta.get("special_requirements", ""),
        })

    # Extract shipping address from Stripe checkout
    shipping = getattr(full_session, "shipping_details", None)
    shipping_address = None
    if shipping and getattr(shipping, "address", None):
        shipping_address = {
            "name": shipping.name,
            "line1": shipping.address.line1,
            "line2": getattr(shipping.address, "line2", None),
            "city": shipping.address.city,
            "postal_code": shipping.address.postal_code,
            "country": shipping.address.country,
        }

    checkout_payload = {
        "stripe_checkout_session_id": session_id,
        "user_id": user_id,
        "order_status": "created",
        "line_items": line_items,
        "shipping_address": shipping_address,
    }

    result = await create_orders_from_checkout(checkout_payload)
    return {"status": "orders_created", "result": result}

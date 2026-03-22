import logging
from fastapi import APIRouter, Depends, HTTPException
from utils import cookie_verification_user_only
from dependencies import get_db_api
from service_client import ServiceClient
from api_calls import get_fulfiller_address, get_claim_detail, update_claim_shipping
from shipping import create_shipping_label

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/shipping", tags=["shipping"])


@router.post("/create_label/{claim_id}")
async def create_label_for_claim(
    claim_id: str,
    user=Depends(cookie_verification_user_only),
    db_api: ServiceClient = Depends(get_db_api),
):
    # 1. Fetch claim + order details (buyer shipping address)
    claim_context = await get_claim_detail(db_api, claim_id)
    if not claim_context:
        raise HTTPException(status_code=404, detail="Claim not found")

    # Verify the requesting user is the fulfiller
    if claim_context["claimant_user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only the fulfiller can create a shipping label")

    ship_to = claim_context["ship_to"]
    if not ship_to or not ship_to.get("line1"):
        raise HTTPException(status_code=400, detail="Buyer shipping address not available on this order")

    # 2. Fetch fulfiller address
    ship_from = await get_fulfiller_address(db_api, user.user_id)
    if not ship_from:
        raise HTTPException(status_code=400, detail="Fulfiller address not set. Please add your shipping address first.")

    # 3. Create ShipEngine label
    try:
        label_result = await create_shipping_label(
            ship_from=ship_from,
            ship_to=ship_to,
        )
    except Exception:
        logger.exception("ShipEngine label creation failed")
        raise HTTPException(status_code=502, detail="Failed to create shipping label")

    # 4. Save shipping info back to claim
    await update_claim_shipping(db_api, claim_id, {
        "tracking_number": label_result["tracking_number"],
        "label_url": label_result["label_url"],
        "carrier_code": label_result["carrier_code"],
        "shipment_id": label_result["shipment_id"],
    })

    return {
        "label_url": label_result["label_url"],
        "tracking_number": label_result["tracking_number"],
        "carrier_code": label_result["carrier_code"],
    }

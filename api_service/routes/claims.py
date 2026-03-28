"""Claim lifecycle endpoints."""
import os
import logging
import base64
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from dependencies import get_db, get_redis, require_verified_email
from cache import cache_invalidate, cache_invalidate_pattern
from events import publish_event
from config import UPLOAD_DIR, MAX_EVIDENCE_SIZE_MB, MAX_EVIDENCE_SIZE_B64
from helpers import ALLOWED_STATUS_TRANSITIONS, DISPUTE_RESPONSE_DAYS, DISPUTE_BUYER_REVIEW_DAYS
from utils import cookie_verification, cookie_verification_user_only, add_claim_to_db
from jwt_auth import verify_jwt_token

from fitd_schemas.fitd_db_schemas import (
    Order, Claim, ClaimEvidence, ClaimStatusHistory, Disbursement, Dispute, FulfillerProfile,
)
from fitd_schemas.fitd_classes import (
    ClaimOrder,
    ClaimQuantityUpdate,
    ClaimStatusUpdate,
    ClaimShippingUpdate,
    EvidenceUploadRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/claims/claim_order", status_code=201)
def claim_order(
    claimed_order: ClaimOrder,
    db: Session = Depends(get_db),
    user_information: None = Depends(cookie_verification_user_only),
    _verified=Depends(require_verified_email),
    redis_client=Depends(get_redis),
):
    try:
        existing_claim = db.query(Claim).filter(
            Claim.order_id == claimed_order.order_id,
            Claim.claimant_user_id == user_information.user_id
        ).first()

        if existing_claim:
            raise HTTPException(status_code=409, detail="You have already claimed this order")

        order = db.query(Order).filter(Order.order_id == claimed_order.order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        if order.process_id:
            import json as _json
            profile = db.query(FulfillerProfile).filter(
                FulfillerProfile.user_id == user_information.user_id
            ).first()
            if not profile:
                raise HTTPException(
                    status_code=403,
                    detail="A fulfiller profile with matching capabilities is required to claim this order"
                )

            matching_cap = next(
                (cap for cap in profile.capabilities if cap.process_id == order.process_id),
                None
            )
            if not matching_cap:
                raise HTTPException(
                    status_code=403,
                    detail="Your profile does not support the required manufacturing process"
                )

            if order.material_id and matching_cap.materials:
                mat_list = _json.loads(matching_cap.materials) if isinstance(matching_cap.materials, str) else matching_cap.materials
                if mat_list and order.material_id not in mat_list:
                    raise HTTPException(
                        status_code=403,
                        detail="Your profile does not support the required material"
                    )

            if order.tolerance_mm is not None and profile.min_tolerance_mm is not None:
                if profile.min_tolerance_mm > order.tolerance_mm:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Order requires ±{order.tolerance_mm}mm tolerance but your profile minimum is ±{profile.min_tolerance_mm}mm"
                    )

        add_claim_to_db(db, claimed_order, user_information)
        cache_invalidate(redis_client, f"fitd:claims:{user_information.user_id}", f"fitd:orders:{order.user_id}")
        cache_invalidate_pattern(redis_client, "fitd:claimable:*")
        publish_event(redis_client, "claim:status_changed", user_id=user_information.user_id)
        if order.user_id != user_information.user_id:
            publish_event(redis_client, "order:claimed", user_id=order.user_id)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Error claiming order")
        raise HTTPException(status_code=500, detail="Error claiming order")


@router.patch("/claims/{claim_id}/quantity")
def update_claim_quantity(
    claim_id: str,
    quantity_update: ClaimQuantityUpdate,
    db: Session = Depends(get_db),
    user_information: None = Depends(cookie_verification_user_only),
):
    claim = db.query(Claim).options(selectinload(Claim.order)).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if claim.claimant_user_id != user_information.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this claim")

    if claim.status not in ("pending", "in_progress"):
        raise HTTPException(status_code=400, detail="Can only adjust quantity while claim is pending or in_progress")

    if quantity_update.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

    order = claim.order
    other_claimed = sum(c.quantity for c in order.claims if c.id != claim.id)
    available = order.quantity - other_claimed

    if quantity_update.quantity > available:
        raise HTTPException(
            status_code=400,
            detail=f"Only {available} items available (order has {order.quantity}, {other_claimed} claimed by others)"
        )

    claim.quantity = quantity_update.quantity
    claim.updated_at = datetime.utcnow()
    db.commit()

    return {"message": "Claim quantity updated", "claim_id": claim_id, "new_quantity": quantity_update.quantity}


@router.patch("/claims/{claim_id}/status")
def update_claim_status(
    claim_id: str,
    status_update: ClaimStatusUpdate,
    db: Session = Depends(get_db),
    user_information: None = Depends(cookie_verification_user_only),
    redis_client=Depends(get_redis),
):
    claim = db.query(Claim).options(selectinload(Claim.order)).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    order = claim.order

    if claim.status == "delivered":
        if order.user_id != user_information.user_id:
            raise HTTPException(status_code=403, detail="Only the buyer can accept or dispute a delivered claim")
    else:
        if claim.claimant_user_id != user_information.user_id:
            raise HTTPException(status_code=403, detail="Not authorized to update this claim")

    allowed = ALLOWED_STATUS_TRANSITIONS.get(claim.status, [])
    if status_update.status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from '{claim.status}' to '{status_update.status}'. Allowed: {allowed}"
        )

    if claim.status == "qa_check" and status_update.status == "shipped":
        if order.qa_level == "high":
            evidence_count = db.query(ClaimEvidence).filter(
                ClaimEvidence.claim_id == claim.id,
                ClaimEvidence.status_at_upload == "qa_check"
            ).count()
            if evidence_count == 0:
                raise HTTPException(
                    status_code=400,
                    detail="High-QA orders require at least one evidence photo during QA check before shipping"
                )

    previous_status = claim.status

    if status_update.status == "disputed" and not status_update.reason:
        raise HTTPException(status_code=400, detail="Reason is required when disputing a claim")

    claim.status = status_update.status
    db.commit()

    history = ClaimStatusHistory(
        claim_id=claim.id,
        previous_status=previous_status,
        new_status=status_update.status,
        changed_by=user_information.user_id,
    )
    db.add(history)
    db.commit()

    if status_update.status == "accepted":
        amount_cents = round(order.price * claim.quantity / order.quantity * 100)
        disbursement = Disbursement(
            claim_id=claim.id,
            user_id=claim.claimant_user_id,
            amount_cents=amount_cents,
            status="pending",
        )
        db.add(disbursement)
        db.commit()

    if status_update.status == "disputed":
        amount_cents = round(order.price * claim.quantity / order.quantity * 100)
        disbursement = Disbursement(
            claim_id=claim.id,
            user_id=claim.claimant_user_id,
            amount_cents=amount_cents,
            status="held",
        )
        db.add(disbursement)

        dispute = Dispute(
            claim_id=claim.id,
            opened_by=user_information.user_id,
            reason=status_update.reason,
            status="open",
            fulfiller_deadline=datetime.utcnow() + timedelta(days=DISPUTE_RESPONSE_DAYS),
        )
        db.add(dispute)
        db.commit()

    cache_invalidate(redis_client, f"fitd:claims:{claim.claimant_user_id}", f"fitd:orders:{order.user_id}")
    publish_event(redis_client, "claim:status_changed", user_id=claim.claimant_user_id)
    if order.user_id != claim.claimant_user_id:
        publish_event(redis_client, "claim:status_changed", user_id=order.user_id)
    return {"message": "Claim status updated", "claim_id": claim_id, "new_status": status_update.status}


@router.post("/claims/{claim_id}/evidence", status_code=201)
def upload_claim_evidence(
    claim_id: str,
    payload: EvidenceUploadRequest,
    db: Session = Depends(get_db),
    user_information: None = Depends(cookie_verification_user_only),
):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if claim.claimant_user_id != user_information.user_id:
        raise HTTPException(status_code=403, detail="Only the fulfiller can upload evidence")

    if len(payload.image_data) > MAX_EVIDENCE_SIZE_B64:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_EVIDENCE_SIZE_MB}MB limit")

    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"evidence_{file_id}.jpg"
    file_bytes = base64.b64decode(payload.image_data)
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    evidence = ClaimEvidence(
        claim_id=claim_id,
        file_path=str(file_path),
        status_at_upload=claim.status,
        description=payload.description,
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    return {
        "id": evidence.id,
        "claim_id": evidence.claim_id,
        "file_path": evidence.file_path,
        "status_at_upload": evidence.status_at_upload,
        "description": evidence.description,
    }


@router.get("/claims/{claim_id}/evidence")
def get_claim_evidence(
    claim_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(cookie_verification),
):
    evidence_list = db.query(ClaimEvidence).filter(ClaimEvidence.claim_id == claim_id).all()
    result = []
    for ev in evidence_list:
        ev_data = {
            "id": ev.id,
            "claim_id": ev.claim_id,
            "file_path": ev.file_path,
            "uploaded_at": ev.uploaded_at.isoformat() if ev.uploaded_at else None,
            "status_at_upload": ev.status_at_upload,
            "description": ev.description,
        }
        if os.path.exists(ev.file_path):
            with open(ev.file_path, "rb") as f:
                ev_data["image_data"] = base64.b64encode(f.read()).decode("utf-8")
        result.append(ev_data)
    return result


@router.get("/claims/{claim_id}/history")
def get_claim_history(
    claim_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(cookie_verification),
):
    history = db.query(ClaimStatusHistory).filter(
        ClaimStatusHistory.claim_id == claim_id
    ).order_by(ClaimStatusHistory.changed_at).all()
    return [
        {
            "id": h.id,
            "claim_id": h.claim_id,
            "previous_status": h.previous_status,
            "new_status": h.new_status,
            "changed_by": h.changed_by,
            "changed_at": h.changed_at.isoformat() if h.changed_at else None,
        }
        for h in history
    ]


@router.get("/claims/{claim_id}/shipping_context")
def get_claim_shipping_context(
    claim_id: str,
    payload: dict = Depends(verify_jwt_token),
    db: Session = Depends(get_db),
):
    """Returns claim + order shipping details for label creation (inter-service)."""
    claim = db.query(Claim).options(selectinload(Claim.order)).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    order = claim.order
    return {
        "claim_id": claim.id,
        "claimant_user_id": claim.claimant_user_id,
        "status": claim.status,
        "order_id": order.order_id,
        "ship_to": {
            "name": order.shipping_name,
            "line1": order.shipping_line1,
            "line2": order.shipping_line2,
            "city": order.shipping_city,
            "postal_code": order.shipping_postal_code,
            "country": order.shipping_country,
        },
    }


@router.patch("/claims/{claim_id}/shipping")
def update_claim_shipping(
    claim_id: str,
    shipping_data: ClaimShippingUpdate,
    payload: dict = Depends(verify_jwt_token),
    db: Session = Depends(get_db),
):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    claim.tracking_number = shipping_data.tracking_number
    claim.label_url = shipping_data.label_url
    claim.carrier_code = shipping_data.carrier_code
    claim.shipment_id = shipping_data.shipment_id
    db.commit()

    return {"message": "Shipping info updated", "claim_id": claim_id}

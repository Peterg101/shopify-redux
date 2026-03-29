"""Dispute endpoints."""
import os
import logging
import base64
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from dependencies import get_db, get_current_user
from config import UPLOAD_DIR, MAX_EVIDENCE_SIZE_MB, MAX_EVIDENCE_SIZE_B64
from helpers import check_and_auto_resolve, DISPUTE_BUYER_REVIEW_DAYS

from fitd_schemas.fitd_db_schemas import (
    User, Claim, ClaimEvidence, ClaimStatusHistory, Disbursement, Dispute,
)
from fitd_schemas.fitd_classes import (
    DisputeFulfillerResponse,
    DisputeResolveRequest,
    DisputeResponse,
    EvidenceUploadRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/disputes/{claim_id}", response_model=DisputeResponse)
def get_dispute(
    claim_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    dispute = db.query(Dispute).options(
        selectinload(Dispute.claim).selectinload(Claim.order)
    ).filter(Dispute.claim_id == claim_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    check_and_auto_resolve(dispute, db)
    return dispute


@router.post("/disputes/{dispute_id}/respond")
def respond_to_dispute(
    dispute_id: str,
    payload: DisputeFulfillerResponse,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    dispute = db.query(Dispute).options(
        selectinload(Dispute.claim).selectinload(Claim.order)
    ).filter(Dispute.id == dispute_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    claim = dispute.claim
    if claim.claimant_user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Only the fulfiller can respond to a dispute")

    if dispute.status != "open":
        raise HTTPException(status_code=400, detail="Dispute is not open for response")

    now = datetime.utcnow()
    if dispute.fulfiller_deadline < now:
        check_and_auto_resolve(dispute, db)
        raise HTTPException(status_code=400, detail="Response deadline has passed")

    dispute.fulfiller_response = payload.response_text
    dispute.responded_at = now
    dispute.status = "responded"
    dispute.buyer_deadline = now + timedelta(days=DISPUTE_BUYER_REVIEW_DAYS)
    db.commit()

    return {"message": "Response recorded", "dispute_id": dispute_id, "status": "responded"}


@router.post("/disputes/{dispute_id}/resolve")
def resolve_dispute(
    dispute_id: str,
    payload: DisputeResolveRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    dispute = db.query(Dispute).options(
        selectinload(Dispute.claim).selectinload(Claim.order)
    ).filter(Dispute.id == dispute_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    claim = dispute.claim
    order = claim.order

    if order.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Only the buyer can resolve a dispute")

    if payload.resolution not in ("accepted", "partial", "rejected"):
        raise HTTPException(status_code=400, detail="Resolution must be accepted, partial, or rejected")

    disbursement = db.query(Disbursement).filter(
        Disbursement.claim_id == claim.id, Disbursement.status == "held"
    ).first()

    previous_status = claim.status
    now = datetime.utcnow()

    if payload.resolution == "accepted":
        if disbursement:
            disbursement.status = "pending"
        claim.status = "resolved_accepted"
    elif payload.resolution == "partial":
        if not payload.partial_amount_cents or payload.partial_amount_cents <= 0:
            raise HTTPException(status_code=400, detail="partial_amount_cents is required for partial resolution")
        max_amount = round(order.price * claim.quantity / order.quantity * 100)
        if payload.partial_amount_cents > max_amount:
            raise HTTPException(
                status_code=400,
                detail=f"Partial amount ({payload.partial_amount_cents}) exceeds claim value ({max_amount} cents)"
            )
        if disbursement:
            disbursement.amount_cents = payload.partial_amount_cents
            disbursement.status = "pending"
        claim.status = "resolved_partial"
    elif payload.resolution == "rejected":
        if disbursement:
            disbursement.status = "cancelled"
        claim.status = "resolved_rejected"

    dispute.status = "resolved"
    dispute.resolution = payload.resolution
    dispute.resolution_amount_cents = payload.partial_amount_cents
    dispute.resolved_by = "buyer"
    dispute.resolved_at = now

    db.add(ClaimStatusHistory(
        claim_id=claim.id,
        previous_status=previous_status,
        new_status=claim.status,
        changed_by=user.user_id,
    ))
    db.commit()

    return {"message": "Dispute resolved", "dispute_id": dispute_id, "resolution": payload.resolution}


@router.post("/disputes/{dispute_id}/evidence", status_code=201)
def upload_dispute_evidence(
    dispute_id: str,
    payload: EvidenceUploadRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    dispute = db.query(Dispute).options(
        selectinload(Dispute.claim)
    ).filter(Dispute.id == dispute_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    claim = dispute.claim
    if claim.claimant_user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Only the fulfiller can upload counter-evidence")

    if len(payload.image_data) > MAX_EVIDENCE_SIZE_B64:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_EVIDENCE_SIZE_MB}MB limit")

    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"evidence_{file_id}.jpg"
    file_bytes = base64.b64decode(payload.image_data)
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    evidence = ClaimEvidence(
        claim_id=claim.id,
        file_path=str(file_path),
        status_at_upload="disputed",
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

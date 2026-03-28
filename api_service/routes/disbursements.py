"""Disbursement endpoints."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from dependencies import get_db
from jwt_auth import verify_jwt_token

from fitd_schemas.fitd_db_schemas import Order, Claim, Disbursement
from fitd_schemas.fitd_classes import MarkDisbursementPaidRequest

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/disbursements/pending/{claim_id}")
def get_pending_disbursement(
    claim_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_jwt_token),
):
    disbursement = db.query(Disbursement).filter(
        Disbursement.claim_id == claim_id,
        Disbursement.status == "pending"
    ).first()
    if not disbursement:
        raise HTTPException(status_code=404, detail="No pending disbursement found")

    claim = db.query(Claim).options(selectinload(Claim.order)).filter(Claim.id == disbursement.claim_id).first()
    order_payment_intent = None
    order_transfer_group = None
    if claim and claim.order:
        order_payment_intent = claim.order.payment_intent
        order_transfer_group = claim.order.transfer_group

    return {
        "id": disbursement.id,
        "claim_id": disbursement.claim_id,
        "user_id": disbursement.user_id,
        "amount_cents": disbursement.amount_cents,
        "status": disbursement.status,
        "payment_intent": order_payment_intent,
        "transfer_group": order_transfer_group,
    }


@router.patch("/disbursements/{disbursement_id}/paid")
def mark_disbursement_paid(
    disbursement_id: str,
    payload: MarkDisbursementPaidRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_jwt_token),
):
    disbursement = db.query(Disbursement).filter(Disbursement.id == disbursement_id).first()
    if not disbursement:
        raise HTTPException(status_code=404, detail="Disbursement not found")

    disbursement.stripe_transfer_id = payload.stripe_transfer_id
    if payload.source_transaction:
        disbursement.source_transaction = payload.source_transaction
    if payload.transfer_group:
        disbursement.transfer_group = payload.transfer_group
    disbursement.status = "paid"
    db.commit()

    return {"message": "Disbursement marked as paid", "disbursement_id": disbursement_id}


@router.patch("/disbursements/by_payment_intent/{payment_intent_id}/freeze")
def freeze_disbursements_by_payment_intent(
    payment_intent_id: str,
    payload: dict = Depends(verify_jwt_token),
    db: Session = Depends(get_db),
):
    orders = db.query(Order).filter(Order.payment_intent == payment_intent_id).all()
    if not orders:
        raise HTTPException(status_code=404, detail="No orders found for this payment_intent")

    order_ids = [o.order_id for o in orders]
    claims = db.query(Claim).filter(Claim.order_id.in_(order_ids)).all()
    claim_ids = [c.id for c in claims]

    frozen_count = 0
    if claim_ids:
        disbursements = db.query(Disbursement).filter(
            Disbursement.claim_id.in_(claim_ids),
            Disbursement.status == "pending"
        ).all()
        for d in disbursements:
            d.status = "frozen"
            frozen_count += 1
        db.commit()

    return {"status": "frozen", "count": frozen_count}

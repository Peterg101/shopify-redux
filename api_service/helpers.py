"""
Shared helper functions and constants for api_service routes.
"""
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from fitd_schemas.fitd_db_schemas import Claim, ClaimStatusHistory, Disbursement, Dispute
from fitd_schemas.fitd_classes import OrderResponse, ClaimResponse

logger = logging.getLogger(__name__)


def _order_to_response(o) -> OrderResponse:
    """Serialize an Order ORM object without triggering circular claim->order loading."""
    return OrderResponse(
        order_id=o.order_id, task_id=o.task_id, user_id=o.user_id,
        name=o.name, material=o.material, technique=o.technique,
        sizing=o.sizing, colour=o.colour, selectedFile=o.selectedFile,
        selectedFileType=o.selectedFileType, price=o.price,
        quantity=o.quantity, created_at=str(o.created_at),
        is_collaborative=o.is_collaborative, status=o.status,
        qa_level=o.qa_level, quantity_claimed=o.quantity_claimed,
        claims=[ClaimResponse.from_orm(c) for c in o.claims],
        process_id=o.process_id, material_id=o.material_id,
        tolerance_mm=o.tolerance_mm, surface_finish=o.surface_finish,
        special_requirements=o.special_requirements,
        shipping_name=o.shipping_name, shipping_line1=o.shipping_line1,
        shipping_line2=o.shipping_line2, shipping_city=o.shipping_city,
        shipping_postal_code=o.shipping_postal_code,
        shipping_country=o.shipping_country,
        payment_intent=o.payment_intent,
        transfer_group=o.transfer_group,
    )


# ── Dispute auto-resolution ────────────────────────────────────────────

DISPUTE_RESPONSE_DAYS = 7
DISPUTE_BUYER_REVIEW_DAYS = 7


def check_and_auto_resolve(dispute: Dispute, db: Session):
    """Lazy timer check: auto-resolve disputes when deadlines pass."""
    now = datetime.utcnow()
    if dispute.status == "resolved":
        return

    claim = dispute.claim
    order = claim.order

    if dispute.status == "open" and dispute.fulfiller_deadline < now:
        # Fulfiller didn't respond — buyer wins (rejected)
        dispute.status = "resolved"
        dispute.resolution = "rejected"
        dispute.resolved_by = "auto"
        dispute.resolved_at = now

        disbursement = db.query(Disbursement).filter(
            Disbursement.claim_id == claim.id, Disbursement.status == "held"
        ).first()
        if disbursement:
            disbursement.status = "cancelled"

        previous_status = claim.status
        claim.status = "resolved_rejected"
        db.add(ClaimStatusHistory(
            claim_id=claim.id,
            previous_status=previous_status,
            new_status="resolved_rejected",
            changed_by="system",
        ))
        db.commit()

    elif dispute.status == "responded" and dispute.buyer_deadline and dispute.buyer_deadline < now:
        # Buyer didn't act — fulfiller wins (accepted)
        dispute.status = "resolved"
        dispute.resolution = "accepted"
        dispute.resolved_by = "auto"
        dispute.resolved_at = now

        disbursement = db.query(Disbursement).filter(
            Disbursement.claim_id == claim.id, Disbursement.status == "held"
        ).first()
        if disbursement:
            disbursement.status = "pending"

        previous_status = claim.status
        claim.status = "resolved_accepted"
        db.add(ClaimStatusHistory(
            claim_id=claim.id,
            previous_status=previous_status,
            new_status="resolved_accepted",
            changed_by="system",
        ))
        db.commit()


# ── Claim status machine ───────────────────────────────────────────────

ALLOWED_STATUS_TRANSITIONS = {
    "pending": ["in_progress", "cancelled"],
    "in_progress": ["printing", "cancelled"],
    "printing": ["qa_check"],
    "qa_check": ["shipped"],
    "shipped": ["delivered"],
    "delivered": ["accepted", "disputed"],
}

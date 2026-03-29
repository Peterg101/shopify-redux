"""Order endpoints."""
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from dependencies import get_db, get_redis, get_current_user
from cache import cache_invalidate, cache_invalidate_pattern
from events import publish_event
from helpers import _order_to_response
from jwt_auth import verify_jwt_token

from fitd_schemas.fitd_db_schemas import (
    User, Order, BasketItem, Claim, ClaimEvidence, ClaimStatusHistory, Dispute,
)
from fitd_schemas.fitd_classes import (
    StripeCheckoutOrder,
    OrderStatusUpdate,
    OrderDetailResponse,
    ClaimDetailResponse,
    ClaimEvidenceResponse,
    ClaimStatusHistoryResponse,
    DisputeResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/orders/create_from_stripe_checkout", status_code=201)
def create_order_from_stripe(
    checkout_order: StripeCheckoutOrder,
    payload: dict = Depends(verify_jwt_token),
    db: Session = Depends(get_db),
    redis_client=Depends(get_redis),
):
    if not checkout_order.line_items:
        raise HTTPException(status_code=400, detail="No line items found")

    existing = db.query(Order).filter(
        Order.stripe_checkout_session_id == checkout_order.stripe_checkout_session_id
    ).first()
    if existing:
        return {"status": "already_processed", "stripe_checkout_session_id": checkout_order.stripe_checkout_session_id}

    shipping = checkout_order.shipping_address
    created_orders = []
    for item in checkout_order.line_items:
        order = Order(
            stripe_checkout_session_id=checkout_order.stripe_checkout_session_id,
            user_id=item.user_id,
            task_id=item.task_id,
            name=item.name,
            material=item.material,
            technique=item.technique,
            sizing=item.sizing,
            colour=item.colour,
            selectedFile=item.selectedFile,
            selectedFileType=item.selectedFileType,
            price=item.price,
            quantity=item.quantity,
            created_at=datetime.utcnow().isoformat(),
            is_collaborative=checkout_order.is_collaborative,
            status=checkout_order.order_status,
            process_id=item.process_id,
            material_id=item.material_id,
            tolerance_mm=item.tolerance_mm,
            surface_finish=item.surface_finish,
            special_requirements=item.special_requirements,
            shipping_name=shipping.name if shipping else None,
            shipping_line1=shipping.line1 if shipping else None,
            shipping_line2=shipping.line2 if shipping else None,
            shipping_city=shipping.city if shipping else None,
            shipping_postal_code=shipping.postal_code if shipping else None,
            shipping_country=shipping.country if shipping else None,
            payment_intent=checkout_order.payment_intent,
            transfer_group=checkout_order.transfer_group,
        )
        created_orders.append(order)
        db.add(order)

    db.query(BasketItem).filter(BasketItem.user_id == checkout_order.user_id).delete()
    db.commit()
    cache_invalidate(redis_client, f"fitd:orders:{checkout_order.user_id}", f"fitd:basket:{checkout_order.user_id}")
    cache_invalidate_pattern(redis_client, "fitd:claimable:*")
    publish_event(redis_client, "order:created")
    return {"status": "success", "order_count": len(created_orders)}


@router.get("/orders/{order_id}/detail", response_model=OrderDetailResponse)
def get_order_detail(
    order_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    owner = db.query(User).filter(User.user_id == order.user_id).first()

    claims_detail = []
    for claim in order.claims:
        claimant = db.query(User).filter(User.user_id == claim.claimant_user_id).first()
        evidence = (
            db.query(ClaimEvidence)
            .filter(ClaimEvidence.claim_id == claim.id)
            .order_by(ClaimEvidence.uploaded_at)
            .all()
        )
        history = (
            db.query(ClaimStatusHistory)
            .filter(ClaimStatusHistory.claim_id == claim.id)
            .order_by(ClaimStatusHistory.changed_at)
            .all()
        )
        dispute = db.query(Dispute).filter(Dispute.claim_id == claim.id).first()

        claims_detail.append(ClaimDetailResponse(
            id=claim.id,
            order_id=claim.order_id,
            claimant_user_id=claim.claimant_user_id,
            claimant_username=claimant.username if claimant else "Unknown",
            quantity=claim.quantity,
            status=claim.status,
            created_at=claim.created_at,
            updated_at=claim.updated_at,
            evidence=[ClaimEvidenceResponse.from_orm(e) for e in evidence],
            status_history=[ClaimStatusHistoryResponse.from_orm(h) for h in history],
            dispute=DisputeResponse.from_orm(dispute) if dispute else None,
            tracking_number=claim.tracking_number,
            label_url=claim.label_url,
            carrier_code=claim.carrier_code,
        ))

    return OrderDetailResponse(
        order_id=order.order_id,
        task_id=order.task_id,
        user_id=order.user_id,
        owner_username=owner.username if owner else "Unknown",
        name=order.name,
        material=order.material,
        technique=order.technique,
        sizing=order.sizing,
        colour=order.colour,
        selectedFile=order.selectedFile,
        selectedFileType=order.selectedFileType,
        price=order.price,
        quantity=order.quantity,
        quantity_claimed=order.quantity_claimed,
        created_at=order.created_at,
        is_collaborative=order.is_collaborative,
        status=order.status,
        qa_level=order.qa_level,
        claims=claims_detail,
        shipping_name=order.shipping_name,
        shipping_line1=order.shipping_line1,
        shipping_line2=order.shipping_line2,
        shipping_city=order.shipping_city,
        shipping_postal_code=order.shipping_postal_code,
        shipping_country=order.shipping_country,
    )


@router.patch("/orders/{order_id}/visibility")
def toggle_order_visibility(
    order_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this order")
    if not order.is_collaborative:
        pass
    else:
        active_claims = [c for c in order.claims if c.status not in ("accepted", "resolved_accepted", "resolved_partial", "resolved_rejected")]
        if active_claims:
            raise HTTPException(status_code=400, detail="Cannot make order private while it has active claims")
    order.is_collaborative = not order.is_collaborative
    db.commit()
    return {"order_id": order_id, "is_collaborative": order.is_collaborative}


@router.post("/orders/update_order")
def update_order(
    update_payload: OrderStatusUpdate,
    payload: dict = Depends(verify_jwt_token),
    db: Session = Depends(get_db)
):
    try:
        orders = db.query(Order).filter(Order.order_id == update_payload.order_id).all()

        if not orders:
            raise HTTPException(status_code=404, detail=f"No orders found with ID {update_payload.order_id}")

        for order in orders:
            order.status = update_payload.order_status

        db.commit()

        return {
            "status": "success",
            "updated_count": len(orders),
            "order_id": update_payload.order_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Error updating orders")
        raise HTTPException(status_code=500, detail="Error updating orders")


@router.patch("/orders/by_payment_intent/{payment_intent_id}/status")
def update_orders_by_payment_intent(
    payment_intent_id: str,
    body: dict,
    payload: dict = Depends(verify_jwt_token),
    db: Session = Depends(get_db),
):
    new_status = body.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="status required")
    orders = db.query(Order).filter(Order.payment_intent == payment_intent_id).all()
    if not orders:
        raise HTTPException(status_code=404, detail="No orders found for this payment_intent")
    for order in orders:
        order.status = new_status
    db.commit()
    return {"status": "updated", "count": len(orders)}

"""
Billing routes — subscriptions, credits, Stripe Checkout for plans and credit packs.
"""
import os
import logging
from datetime import datetime

import stripe
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from dependencies import get_db, get_current_user
from jwt_auth import verify_jwt_token

from fitd_schemas.fitd_db_schemas import (
    User, UserSubscription, UserCredits, CreditTransaction,
)
from fitd_schemas.fitd_classes import (
    SubscriptionResponse,
    CreditTransactionResponse,
)
from pydantic import BaseModel
from typing import Optional, List

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Stripe price IDs from environment
STRIPE_PRO_PRICE_ID = os.getenv("STRIPE_PRO_PRICE_ID", "")
STRIPE_ENTERPRISE_PRICE_ID = os.getenv("STRIPE_ENTERPRISE_PRICE_ID", "")
STRIPE_CREDIT_SMALL_PRICE_ID = os.getenv("STRIPE_CREDIT_SMALL_PRICE_ID", "")
STRIPE_CREDIT_LARGE_PRICE_ID = os.getenv("STRIPE_CREDIT_LARGE_PRICE_ID", "")

CREDIT_PACK_AMOUNTS = {
    "small": 10,
    "large": 50,
}


# ── Request models ──────────────────────────────────────────────

class SubscriptionCheckoutRequest(BaseModel):
    tier: str  # "pro" or "enterprise"

class CreditCheckoutRequest(BaseModel):
    pack: str  # "small" or "large"

class CheckCreditsRequest(BaseModel):
    user_id: str

class DeductCreditsRequest(BaseModel):
    user_id: str
    amount: int
    reference_id: str
    description: Optional[str] = None


# ── Helpers ─────────────────────────────────────────────────────

def _get_or_create_stripe_customer(user: User, subscription: UserSubscription, db: Session) -> str:
    """Return existing Stripe customer ID or create a new one."""
    if subscription.stripe_customer_id:
        return subscription.stripe_customer_id

    customer = stripe.Customer.create(
        email=user.email,
        metadata={"user_id": user.user_id},
    )
    subscription.stripe_customer_id = customer.id
    db.commit()
    return customer.id


def _ensure_subscription_and_credits(user_id: str, db: Session):
    """Ensure UserSubscription and UserCredits rows exist for a user."""
    sub = db.query(UserSubscription).filter(UserSubscription.user_id == user_id).first()
    if not sub:
        sub = UserSubscription(user_id=user_id)
        db.add(sub)

    credits = db.query(UserCredits).filter(UserCredits.user_id == user_id).first()
    if not credits:
        credits = UserCredits(user_id=user_id)
        db.add(credits)

    db.commit()
    return sub, credits


# ── Endpoints ───────────────────────────────────────────────────

@router.post("/create-checkout")
def create_subscription_checkout(
    body: SubscriptionCheckoutRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe Checkout session for a subscription plan."""
    if body.tier == "pro":
        price_id = STRIPE_PRO_PRICE_ID
    elif body.tier == "enterprise":
        price_id = STRIPE_ENTERPRISE_PRICE_ID
    else:
        raise HTTPException(status_code=400, detail="Invalid tier. Must be 'pro' or 'enterprise'.")

    if not price_id:
        raise HTTPException(status_code=500, detail=f"Stripe price ID not configured for tier '{body.tier}'.")

    sub, _ = _ensure_subscription_and_credits(user.user_id, db)
    customer_id = _get_or_create_stripe_customer(user, sub, db)

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{FRONTEND_URL}/billing?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{FRONTEND_URL}/billing?canceled=true",
        metadata={"user_id": user.user_id, "tier": body.tier},
    )

    return {"checkout_url": session.url}


@router.post("/create-credit-checkout")
def create_credit_checkout(
    body: CreditCheckoutRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe Checkout session for a credit pack purchase."""
    if body.pack == "small":
        price_id = STRIPE_CREDIT_SMALL_PRICE_ID
    elif body.pack == "large":
        price_id = STRIPE_CREDIT_LARGE_PRICE_ID
    else:
        raise HTTPException(status_code=400, detail="Invalid pack. Must be 'small' or 'large'.")

    if not price_id:
        raise HTTPException(status_code=500, detail=f"Stripe price ID not configured for pack '{body.pack}'.")

    sub, _ = _ensure_subscription_and_credits(user.user_id, db)
    customer_id = _get_or_create_stripe_customer(user, sub, db)

    credit_amount = CREDIT_PACK_AMOUNTS[body.pack]

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="payment",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{FRONTEND_URL}/billing?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{FRONTEND_URL}/billing?canceled=true",
        metadata={
            "user_id": user.user_id,
            "type": "credit_purchase",
            "credit_amount": str(credit_amount),
        },
    )

    return {"checkout_url": session.url}


@router.post("/manage")
def manage_billing(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe Billing Portal session for the user to manage their subscription."""
    sub = db.query(UserSubscription).filter(UserSubscription.user_id == user.user_id).first()
    if not sub or not sub.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No billing account found. Please subscribe to a plan first.")

    portal_session = stripe.billing_portal.Session.create(
        customer=sub.stripe_customer_id,
        return_url=f"{FRONTEND_URL}/billing",
    )

    return {"portal_url": portal_session.url}


@router.get("/subscription", response_model=SubscriptionResponse)
def get_subscription(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's subscription and credit info."""
    sub = db.query(UserSubscription).filter(UserSubscription.user_id == user.user_id).first()
    credits = db.query(UserCredits).filter(UserCredits.user_id == user.user_id).first()

    return SubscriptionResponse(
        tier=sub.tier if sub else "free",
        status=sub.status if sub else "active",
        available_credits=credits.available_credits if credits else 5,
        credit_renewal_date=credits.renewal_date if credits else None,
    )


@router.get("/transactions", response_model=List[CreditTransactionResponse])
def get_transactions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """Get the user's credit transaction history."""
    transactions = (
        db.query(CreditTransaction)
        .filter(CreditTransaction.user_id == user.user_id)
        .order_by(CreditTransaction.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [CreditTransactionResponse.from_orm(t) for t in transactions]


@router.post("/check-credits")
def check_credits(
    body: CheckCreditsRequest,
    _: dict = Depends(verify_jwt_token),
    db: Session = Depends(get_db),
):
    """Inter-service endpoint: check if a user has credits available."""
    sub = db.query(UserSubscription).filter(UserSubscription.user_id == body.user_id).first()
    credits = db.query(UserCredits).filter(UserCredits.user_id == body.user_id).first()

    tier = sub.tier if sub else "free"
    available = credits.available_credits if credits else 5

    return {
        "allowed": available > 0,
        "tier": tier,
        "credits": available,
    }


@router.post("/deduct-credits")
def deduct_credits(
    body: DeductCreditsRequest,
    _: dict = Depends(verify_jwt_token),
    db: Session = Depends(get_db),
):
    """Inter-service endpoint: deduct credits from a user's balance."""
    credits = db.query(UserCredits).filter(UserCredits.user_id == body.user_id).first()
    if not credits:
        # Auto-create with defaults if missing
        credits = UserCredits(user_id=body.user_id)
        db.add(credits)
        db.flush()

    if credits.available_credits < body.amount:
        raise HTTPException(status_code=402, detail="Insufficient credits")

    credits.available_credits -= body.amount
    credits.total_used += body.amount
    credits.updated_at = datetime.now().isoformat()

    transaction = CreditTransaction(
        user_id=body.user_id,
        transaction_type="generation",
        amount=-body.amount,
        balance_after=credits.available_credits,
        reference_id=body.reference_id,
        description=body.description,
    )
    db.add(transaction)
    db.commit()

    return {
        "success": True,
        "remaining": credits.available_credits,
    }

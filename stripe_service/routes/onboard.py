# routes/onboard.py (inside stripe_service)
import asyncio, stripe
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from models import UserStripeAccount
from database import get_db
import os

router = APIRouter(prefix="/stripe", tags=["Stripe Onboarding"])
SERVICE_TOKEN = os.getenv("SERVICE_TOKEN")

def verify_service_token(authorization: str = Header(...)):
    if authorization != SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="invalid service token")

@router.post("/onboard")
async def onboard_user(
    user_id: str,
    email: str,
    db: Session = Depends(get_db),
    _: None = Depends(verify_service_token),
):
    # Check if account already exists
    existing = db.query(UserStripeAccount).filter_by(user_id=user_id).first()
    if existing and existing.stripe_account_id:
        return {"stripe_account_id": existing.stripe_account_id, "created": False}

    # Create Express account in Stripe
    account = await asyncio.to_thread(
        stripe.Account.create,
        type="express",
        country="GB",
        email=email,
        capabilities={"transfers": {"requested": True}},
    )

    if existing:
        existing.stripe_account_id = account.id
    else:
        existing = UserStripeAccount(
            user_id=user_id,
            stripe_account_id=account.id,
            onboarding_complete=False,
        )
        db.add(existing)

    db.commit()
    return {"stripe_account_id": account.id, "created": True}

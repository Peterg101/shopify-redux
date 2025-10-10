# routes/onboard.py
import os
import stripe
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from datetime import datetime
from utils import cookie_verification_user_only
from fitd_schemas.fitd_db_schemas import UserStripeAccount;


router = APIRouter(prefix="/stripe", tags=["stripe"])


@router.post("/onboard")
async def onboard_user(user=Depends(cookie_verification_user_only)):
    """Creates or returns a Stripe Express account for the given user."""

    print(user)
    print(user.user_id)

    
    # account = db.query(UserStripeAccount).filter_by(user_id=user_id).first()

    # if account and account.stripe_account_id:
    #     return {
    #         "stripe_account_id": account.stripe_account_id,
    #         "onboarding_complete": account.onboarding_complete,
    #     }

    # try:
    #     account_obj = await asyncio.to_thread(
    #         stripe.Account.create,
    #         type="express",
    #         country="GB",
    #         email=email,
    #         capabilities={
    #             "transfers": {"requested": True},
    #             "card_payments": {"requested": True},
    #         },
    #     )
    # except Exception as e:
    #     raise HTTPException(status_code=500, detail=f"Stripe account creation failed: {e}")

    # # Save or update in database
    # if not account:
    #     account = UserStripeAccount(
    #         user_id=user_id,
    #         stripe_account_id=account_obj["id"],
    #         onboarding_complete=False,
    #         created_at=datetime.utcnow(),
    #     )
    #     db.add(account)
    # else:
    #     account.stripe_account_id = account_obj["id"]

    # db.commit()
    # return {
    #     "stripe_account_id": account.stripe_account_id,
    #     "onboarding_complete": False,
    # }

# -----------------------------------------------------------------------------
# Generate onboarding link
# -----------------------------------------------------------------------------
# @router.post("/account_link")
# async def create_account_link(
#     user_id: str,
#     db: Session = Depends(get_db),
#     _: None = Depends(verify_service_token),
# ):
#     """Generates an onboarding link for the user to complete Stripe setup."""

#     account = db.query(UserStripeAccount).filter_by(user_id=user_id).first()
#     if not account or not account.stripe_account_id:
#         raise HTTPException(status_code=404, detail="User Stripe account not found")

#     try:
#         link = await asyncio.to_thread(
#             stripe.AccountLink.create,
#             account=account.stripe_account_id,
#             refresh_url="https://your-frontend.com/onboard/refresh",
#             return_url="https://your-frontend.com/onboard/complete",
#             type="account_onboarding",
#         )
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to create account link: {e}")

#     return {"url": link["url"]}

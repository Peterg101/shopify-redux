# routes/onboard.py
import os
import stripe
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Header, Request
import requests
from sqlalchemy.orm import Session
from datetime import datetime
from api_calls import check_user_stripe_onboarded, generate_stripe_account_in_db
from utils import cookie_verification_user_only, cookie_verification, generate_stripe_account, generate_account_link
from fitd_schemas.fitd_db_schemas import UserStripeAccount;
from jwt_auth import generate_token



router = APIRouter(prefix="/stripe", tags=["stripe"])


@router.post("/onboard")
async def onboard_user(user=Depends(cookie_verification_user_only)):
    """Creates or returns a Stripe Express account for the given user."""

    # Step 1: Check if the user already has a Stripe account
    account_info = await check_user_stripe_onboarded(user.user_id)
    # if account_info:
    #     # Optional: if user already onboarded, return message or redirect
    #     return {"message": "User already onboarded", "account_info": account_info}

    # Step 2: Create a new Stripe account
    stripe_account = await generate_stripe_account(user.email)

    # Step 3: Save the account to your DB
    await generate_stripe_account_in_db(user.user_id, stripe_account["id"])
    print("hitting here")
    # Step 4: Generate an onboarding link
    return_values = await generate_account_link(stripe_account["id"])

    # Step 5: Return the onboarding URL to the frontend
    return return_values


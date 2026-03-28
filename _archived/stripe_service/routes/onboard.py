# routes/onboard.py
from fastapi import APIRouter, Depends
from api_calls import check_user_stripe_onboarded, generate_stripe_account_in_db
from utils import cookie_verification_user_only, generate_stripe_account, generate_account_link
from dependencies import get_db_api
from service_client import ServiceClient



router = APIRouter(prefix="/stripe", tags=["stripe"])


@router.post("/onboard")
async def onboard_user(
    user=Depends(cookie_verification_user_only),
    db_api: ServiceClient = Depends(get_db_api),
):
    """Creates or returns a Stripe Express account for the given user."""

    # Step 1: Check if the user already has a Stripe account
    account_info = await check_user_stripe_onboarded(db_api, user.user_id)
    if account_info:
        if account_info.get("onboarding_complete"):
            return {"message": "User already onboarded", "account_info": account_info}
        # User has account but incomplete — generate new AccountLink
        return await generate_account_link(account_info["stripe_account_id"])

    # Step 2: Create a new Stripe account
    stripe_account = await generate_stripe_account(user.email)

    # Step 3: Save the account to your DB
    await generate_stripe_account_in_db(db_api, user.user_id, stripe_account["id"])

    # Step 4: Generate an onboarding link
    return_values = await generate_account_link(stripe_account["id"])

    # Step 5: Return the onboarding URL to the frontend
    return return_values

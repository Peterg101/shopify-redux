import httpx
from typing import Optional, List
from fitd_schemas.fitd_classes import UserInformation
from jwt_auth import generate_token
import stripe, os


async def session_exists(session_id: str) -> bool:
    cookies = {"fitd_session_data": session_id}
    url = "http://localhost:2468/get_session"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, cookies=cookies)
            print(response.text)
            return response.status_code == 200
        except httpx.HTTPError as e:
            print(f"HTTP error occurred: {e}")
            return False


async def session_exists_user_only(session_id: str) -> Optional[UserInformation]:
    cookies = {"fitd_session_data": session_id}
    url = "http://localhost:2468/get_just_user_details"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, cookies=cookies)
            if response.status_code == 200:
                # Parse the response JSON and return a UserInformation object
                user_info = UserInformation.parse_obj(response.json())
                return user_info
            else:
                print(f"Failed to fetch user details, status code: {response.status_code}")
                return None
        except httpx.HTTPError as e:
            print(f"HTTP error occurred: {e}")
            return None


async def check_user_stripe_onboarded(user_id: str) -> Optional[dict]:
    """
    Calls the Stripe microservice to check if the user has a Stripe account.
    Returns the Stripe account info dict if onboarded, otherwise None.
    """
    auth_token = generate_token("stripe_service")
    url = f"http://localhost:8000/user_onboarded_with_stripe/{user_id}"
    headers = {
        "Authorization": f"Bearer {auth_token}",
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers)
            if response.status_code == 204:
                return None
            if response.status_code == 200:
                return response.json()
            print(f"Unexpected status from Stripe service: {response.status_code}")
            return None

        except httpx.HTTPError as e:
            print(f"HTTP error when checking Stripe onboarding: {e}")
            return None


async def generate_stripe_account_in_db(user_id: str, stripe_account_id: str):
    auth_token = generate_token("stripe_service")
    url = f"http://localhost:8000/generate_user_stripe_account_in_db/{user_id}"
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json",
    }
    payload = {"stripe_account_id": stripe_account_id}

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code in (200, 201):
                return response.json()
            else:
                print(f"Failed to create Stripe account record: {response.status_code}")
                print(response.text)
                return None
        except httpx.HTTPError as e:
            print(f"HTTP error occurred: {e}")
            return None

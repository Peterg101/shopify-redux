import os
import logging
import httpx
from typing import Optional, List
from fitd_schemas.fitd_classes import UserInformation
from jwt_auth import generate_token
import stripe

logger = logging.getLogger(__name__)

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://localhost:2468")
DB_SERVICE_URL = os.getenv("DB_SERVICE_URL", "http://localhost:8000")


async def session_exists(session_id: str) -> bool:
    cookies = {"fitd_session_data": session_id}
    url = f"{AUTH_SERVICE_URL}/get_session"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, cookies=cookies)
            logger.info(response.text)
            return response.status_code == 200
        except httpx.HTTPError as e:
            logger.error(f"HTTP error occurred: {e}")
            return False


async def session_exists_user_only(session_id: str) -> Optional[UserInformation]:
    cookies = {"fitd_session_data": session_id}
    url = f"{AUTH_SERVICE_URL}/get_just_user_details"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, cookies=cookies)
            if response.status_code == 200:
                # Parse the response JSON and return a UserInformation object
                user_info = UserInformation.parse_obj(response.json())
                return user_info
            else:
                logger.error(f"Failed to fetch user details, status code: {response.status_code}")
                return None
        except httpx.HTTPError as e:
            logger.error(f"HTTP error occurred: {e}")
            return None


async def check_user_stripe_onboarded(user_id: str) -> Optional[dict]:
    """
    Calls the Stripe microservice to check if the user has a Stripe account.
    Returns the Stripe account info dict if onboarded, otherwise None.
    """
    auth_token = generate_token("stripe_service")
    url = f"{DB_SERVICE_URL}/user_onboarded_with_stripe/{user_id}"
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
            logger.error(f"Unexpected status from Stripe service: {response.status_code}")
            return None

        except httpx.HTTPError as e:
            logger.error(f"HTTP error when checking Stripe onboarding: {e}")
            return None


async def get_all_basket_items(user_id: str) -> List[dict]:
    auth_token = generate_token("stripe_service")
    url = f"{DB_SERVICE_URL}/all_basket_items"
    headers = {
        "Authorization": f"Bearer {auth_token}",
    }
    params = {"user_id": user_id}

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, params=params)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Error fetching basket items: {response.status_code} - {response.text}")
                return []
        except httpx.HTTPError as e:
            logger.error(f"HTTP error fetching basket items: {e}")
            return []


async def create_orders_from_checkout(checkout_payload: dict) -> dict:
    auth_token = generate_token("stripe_service")
    url = f"{DB_SERVICE_URL}/orders/create_from_stripe_checkout"
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=checkout_payload)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to create orders: {response.status_code} - {response.text}")
                return {"status": "error", "detail": response.text}
        except httpx.HTTPError as e:
            logger.error(f"HTTP error creating orders: {e}")
            return {"status": "error", "detail": str(e)}


async def get_fulfiller_address(user_id: str) -> Optional[dict]:
    """Fetch the fulfiller's ship-from address from db_service."""
    auth_token = generate_token("stripe_service")
    url = f"{DB_SERVICE_URL}/users/{user_id}/fulfiller_address"
    headers = {"Authorization": f"Bearer {auth_token}"}

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                return response.json()
            logger.error(f"Fulfiller address not found: {response.status_code}")
            return None
        except httpx.HTTPError as e:
            logger.error(f"HTTP error fetching fulfiller address: {e}")
            return None


async def get_claim_detail(claim_id: str) -> Optional[dict]:
    """Fetch claim details from db_service (uses cookie-authenticated endpoint via order detail)."""
    auth_token = generate_token("stripe_service")
    # We need claim + order data; simplest approach is to get the claim directly
    # but there's no JWT-protected claim endpoint. We'll add a lightweight one.
    # For now, use a direct DB query pattern via a new endpoint.
    url = f"{DB_SERVICE_URL}/claims/{claim_id}/shipping_context"
    headers = {"Authorization": f"Bearer {auth_token}"}

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                return response.json()
            logger.error(f"Claim detail not found: {response.status_code}")
            return None
        except httpx.HTTPError as e:
            logger.error(f"HTTP error fetching claim detail: {e}")
            return None


async def update_claim_shipping(claim_id: str, shipping_data: dict) -> Optional[dict]:
    """Update shipping info on a claim in db_service."""
    auth_token = generate_token("stripe_service")
    url = f"{DB_SERVICE_URL}/claims/{claim_id}/shipping"
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.patch(url, headers=headers, json=shipping_data)
            if response.status_code == 200:
                return response.json()
            logger.error(f"Failed to update claim shipping: {response.status_code}")
            return None
        except httpx.HTTPError as e:
            logger.error(f"HTTP error updating claim shipping: {e}")
            return None


async def generate_stripe_account_in_db(user_id: str, stripe_account_id: str):
    auth_token = generate_token("stripe_service")
    url = f"{DB_SERVICE_URL}/generate_user_stripe_account_in_db/{user_id}"
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
                logger.error(f"Failed to create Stripe account record: {response.status_code}")
                logger.error(response.text)
                return None
        except httpx.HTTPError as e:
            logger.error(f"HTTP error occurred: {e}")
            return None

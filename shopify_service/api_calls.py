import os
import logging
import httpx
from typing import Optional, List
from fitd_schemas.fitd_classes import UserInformation
from fitd_schemas.fitd_db_schemas import BasketItem
from jwt_auth import generate_token

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


async def get_all_basket_items(user_id: str) -> List[BasketItem]:
    auth_token = generate_token("shopify_service")
    url = f"{DB_SERVICE_URL}/all_basket_items"
    headers = {
        "Authorization": f"Bearer {auth_token}",
    }
    params = {"user_id": user_id}

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, params=params)

    if response.status_code == 200:
        logger.info(f"Basket items: {response.json()}")
        basket_items = [BasketItem(**item) for item in response.json()]
        return basket_items
    else:
        logger.error(f"Error: {response.status_code} - {response.text}")
        return []
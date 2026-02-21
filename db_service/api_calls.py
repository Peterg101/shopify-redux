import os
import logging
import httpx
from typing import Optional
from fitd_schemas.fitd_classes import UserInformation

logger = logging.getLogger(__name__)

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://localhost:2468")


async def session_exists(session_id: str) -> bool:
    cookies = {"fitd_session_data": session_id}
    url = f"{AUTH_SERVICE_URL}/get_session"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, cookies=cookies)
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

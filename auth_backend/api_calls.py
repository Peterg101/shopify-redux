import os
import logging
import httpx
from jwt_auth import generate_token
from fitd_schemas.fitd_classes import UserInformation

logger = logging.getLogger(__name__)

DB_SERVICE_URL = os.getenv("DB_SERVICE_URL", "http://localhost:8000")


async def check_user_exists(user_id: str | None):
    url = f"{DB_SERVICE_URL}/users/{user_id}"
    auth_token = generate_token("auth_backend")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}",  # Add the auth token here
    }
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)

        if response.status_code == 200:
            # If the user was successfully found, return the response data
            return response.json()
        else:
            # Handle any errors
            logger.error(f"Error: {response.status_code} - {response.text}")
            return None

async def check_only_user_exists(user_id: str | None):
    url = f"{DB_SERVICE_URL}/only_user/{user_id}"
    auth_token = generate_token("auth_backend")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}",  # Add the auth token here
    }
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)

        if response.status_code == 200:
            # If the user was successfully found, return the response data
            logger.info(f"User details: {response.json()}")
            return response.json()
        else:
            # Handle any errors
            logger.error(f"Error: {response.status_code} - {response.text}")
            return None


async def create_user(user_information: UserInformation):
    auth_token = generate_token("auth_backend")
    url = f"{DB_SERVICE_URL}/users"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}",
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=user_information.dict(), headers=headers)

        if response.status_code in (200, 201):
            return response.json()
        else:
            logger.error(f"Error: {response.status_code} - {response.text}")
            return None


async def register_email_user(user_info: UserInformation):
    auth_token = generate_token("auth_backend")
    url = f"{DB_SERVICE_URL}/users/register"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}",
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=user_info.dict(), headers=headers)
        return response


async def get_user_by_email(email: str):
    auth_token = generate_token("auth_backend")
    url = f"{DB_SERVICE_URL}/users/by_email/{email}"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}",
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        if response.status_code == 200:
            return response.json()
        else:
            return None

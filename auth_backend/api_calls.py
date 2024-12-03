import httpx
from jwt_auth import generate_token
from models import UserInformation


async def check_user_exists(user_id: str | None):
    url = f"http://localhost:8000/users/{user_id}"
    auth_token = generate_token()
    print(auth_token)
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}",  # Add the auth token here
    }
    with httpx.Client() as client:
        response = client.get(url, headers=headers)

        if response.status_code == 200:
            # If the user was successfully found, return the response data
            return response.json()
        else:
            # Handle any errors
            print(f"Error: {response.status_code} - {response.text}")
            return None


async def create_user(user_information: UserInformation):
    auth_token = generate_token()
    url = "http://localhost:8000/users"  # Adjust with your actual FastAPI URL
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}",  # Add the auth token here
    }

    # Send the POST request with user data and session token in cookies
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=user_information.dict(), headers=headers)

        if response.status_code == 200:
            # If successful, return the user data
            return response.json()
        else:
            # Handle any errors
            print(f"Error: {response.status_code} - {response.text}")
            return None
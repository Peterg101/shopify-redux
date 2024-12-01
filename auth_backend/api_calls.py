import httpx
from jwt_auth import generate_token


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

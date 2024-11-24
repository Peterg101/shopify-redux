import httpx

async def check_user_exists(user_id: str, session_token: str):
    url = f"http://localhost:8000/users/{user_id}"
    
    headers = {
        "Content-Type": "application/json"
    }
    
    cookies = {
        "fitd_session_data": session_token  # Include session token in cookies
    }

    with httpx.Client() as client:
        response = client.get(url, headers=headers, cookies=cookies)

        if response.status_code == 200:
            # If the user was successfully found, return the response data
            return response.json()
        else:
            # Handle any errors
            print(f"Error: {response.status_code} - {response.text}")
            return None

import os
from fastapi import FastAPI, Depends, HTTPException, Response, Request
import asyncio
import asyncio_redis
from fastapi.responses import RedirectResponse, JSONResponse
import aioredis
from fastapi_sessions.session_verifier import SessionVerifier
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt
import requests
import uvicorn
from models import Token, SessionData, UserInformation
import httpx
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordBearer
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from redis import Redis
from utils import create_session, get_session, delete_session
from api_calls import check_user_exists, create_user, get_file

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:1234"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Redis Configuration
REDIS_HOST = "localhost"
REDIS_PORT = 6379
redis_session = aioredis.from_url(f"redis://{REDIS_HOST}:{REDIS_PORT}", decode_responses=True)

# Google OAuth2 configuration
GOOGLE_CLIENT_ID = "854876909268-92r1ja775v91cciriu3blce5ulentf9f.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET = "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"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
REDIRECT_URI = (
    "http://localhost:2468/auth/google/callback"  # The redirect URI in Google console
)
GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"


@app.get("/auth/google")
def auth_google():
    google_auth_url = (
        f"{GOOGLE_AUTH_URL}"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=openid%20email%20profile"
    )
    return RedirectResponse(google_auth_url)


@app.get("/auth/google/callback")
async def auth_callback(code: str, request: Request):
    redirect_uri = "http://localhost:2468/auth/google/callback"
    token_request_uri = "https://oauth2.googleapis.com/token"
    
    data = {
        'code': code,
        'client_id': GOOGLE_CLIENT_ID,
        'client_secret': GOOGLE_CLIENT_SECRET,
        'redirect_uri': redirect_uri,
        'grant_type': 'authorization_code',
    }

    # Step 1: Exchange code for token
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(token_request_uri, data=data)
            response.raise_for_status()
            token_response = response.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=400, detail="Failed to retrieve token")

    # Step 2: Get the ID token and verify it
    id_token_value = token_response.get('id_token')
    if not id_token_value:
        raise HTTPException(status_code=400, detail="Missing id_token in response.")

    try:
        # Verify the ID token
        id_info = id_token.verify_oauth2_token(
            id_token_value, google_requests.Request(), GOOGLE_CLIENT_ID
        )
        user_information = UserInformation()
        user_information.user_id = id_info["sub"]
        user_information.email = id_info["email"]
        user_information.username = id_info["name"]

        print(user_information.username)

        # # Step 3: Check if the user exists in the database
        user_exists = await check_user_exists(user_information.user_id)
        if not user_exists:
            print("USER DOES NOT EXIST")
            await create_user(user_information)
        
        # Step 5: Create a session for the user
        session_data = SessionData()
        # session_data.user_id = user_id
        session_data.user_id = id_info["sub"]
        session_id = await create_session(redis_session, session_data)

        # Create the response with a session cookie
        response = RedirectResponse(url="http://localhost:3000/")
        response.set_cookie(
            "fitd_session_data",
            str(session_id),
            max_age=3600,  # Session duration in seconds
            httponly=True,  # Prevent JavaScript from accessing the cookie
            secure=True,   # Set to True for HTTPS environments
            samesite="Lax"  # Prevents CSRF attacks by restricting cross-site requests
        )
        return response

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid id_token: {str(e)}")


@app.get("/logout")
async def logout(request: Request):
    session_id = request.cookies.get("fitd_session_data")
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        session_data = await get_session(redis_session, session_id)
        if not session_data:
            raise HTTPException(status_code=401, detail="Session not found")

        await delete_session(redis_session, session_id)
        print(f"User logged out: {session_data}")  # Accessing name from session_data object

        return {
            "message": "Logged out",
            "user_info": {"user_id": session_data.user_id}
        }
    except ValueError:
        # Token is invalid or verification failed
        raise HTTPException(status_code=401, detail="Invalid token or token verification failed")


@app.get("/get_session")
async def protected_endpoint(request: Request):
    session_id = request.cookies.get("fitd_session_data")
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session_data = await get_session(redis_session, session_id)
    if not session_data:
        print('no session data')
        raise HTTPException(status_code=401, detail="Session not found")

    try:
        print(f"User authenticated: {session_data}")
        print(session_data.user_id)
        user_info = await check_user_exists(session_data.user_id)
        print(user_info)
        return user_info
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token or token verification failed")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=2468)

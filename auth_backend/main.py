import os
from dotenv import load_dotenv
load_dotenv()
import logging
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from redis.asyncio import Redis as AsyncRedis
import uvicorn
from fitd_schemas.fitd_classes import SessionData, UserInformation, EmailRegisterRequest, EmailLoginRequest
import httpx
import bcrypt
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from utils import create_session, delete_session, cookie_verification
from api_calls import check_user_exists, create_user, check_only_user_exists, register_email_user, get_user_by_email, verify_user_password

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
IS_PRODUCTION = os.getenv("ENV", "development") == "production"

limiter = Limiter(key_func=get_remote_address)

app = FastAPI()
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:1234", "http://localhost:100"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please try again later."}
    )

# Redis Configuration
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
redis_session = AsyncRedis.from_url(
    f"redis://{REDIS_HOST}:{REDIS_PORT}", decode_responses=True
)

# Google OAuth2 configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:2468/auth/google/callback")
GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"


@app.get("/auth/google")
@limiter.limit("10/minute")
def auth_google(request: Request):
    google_auth_url = (
        f"{GOOGLE_AUTH_URL}"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=openid%20email%20profile"
        f"&prompt=select_account"
    )
    return RedirectResponse(google_auth_url)


@app.get("/auth/google/callback")
async def auth_callback(code: str, request: Request):
    redirect_uri = REDIRECT_URI
    token_request_uri = "https://oauth2.googleapis.com/token"

    data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
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
    id_token_value = token_response.get("id_token")
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

        # # Step 3: Check if the user exists in the database
        user_exists = await check_user_exists(user_information.user_id)
        if not user_exists:
            await create_user(user_information)

        # Step 5: Create a session for the user
        session_data = SessionData()
        # session_data.user_id = user_id
        session_data.user_id = id_info["sub"]
        session_id = await create_session(redis_session, session_data)

        # Create the response with a session cookie
        response = RedirectResponse(url=f"{FRONTEND_URL}/generate")
        response.set_cookie(
            "fitd_session_data",
            str(session_id),
            max_age=3600,  # Session duration in seconds
            httponly=True,  # Prevent JavaScript from accessing the cookie
            secure=IS_PRODUCTION,  # Set to True for HTTPS environments
            samesite="Lax",  # Prevents CSRF attacks by restricting cross-site requests
        )
        return response

    except ValueError:
        logger.exception("Google token verification failed")
        raise HTTPException(status_code=400, detail="Invalid or expired Google token")


@app.post("/auth/register")
@limiter.limit("3/minute")
async def email_register(request: Request, register_request: EmailRegisterRequest):
    hashed = bcrypt.hashpw(register_request.password.encode("utf-8"), bcrypt.gensalt())

    import uuid
    user_info = UserInformation(
        user_id=str(uuid.uuid4()),
        username=register_request.username,
        email=register_request.email,
        password_hash=hashed.decode("utf-8"),
        auth_provider="email",
    )

    response = await register_email_user(user_info)
    if response.status_code == 409:
        raise HTTPException(status_code=409, detail=response.json().get("detail", "Already exists"))
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="Registration failed")

    user_data = response.json()
    session_data = SessionData(user_id=user_data["user_id"])
    session_id = await create_session(redis_session, session_data)

    from fastapi.responses import JSONResponse
    resp = JSONResponse(content={"message": "Registration successful", "user_id": user_data["user_id"]})
    resp.set_cookie(
        "fitd_session_data",
        str(session_id),
        max_age=3600,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="Lax",
    )
    return resp


@app.post("/auth/login")
@limiter.limit("5/minute")
async def email_login(request: Request, login_request: EmailLoginRequest):
    try:
        result = await verify_user_password(login_request.email, login_request.password)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        elif e.response.status_code == 400:
            raise HTTPException(status_code=400, detail="This account uses Google sign-in")
        else:
            logger.exception("Password verification request failed")
            raise HTTPException(status_code=500, detail="Authentication service error")

    if not result.get("verified"):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    session_data = SessionData(user_id=result["user_id"])
    session_id = await create_session(redis_session, session_data)

    from fastapi.responses import JSONResponse
    resp = JSONResponse(content={"message": "Login successful", "user_id": result["user_id"]})
    resp.set_cookie(
        "fitd_session_data",
        str(session_id),
        max_age=3600,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="Lax",
    )
    return resp


@app.get("/logout")
async def logout(request: Request):
    session_data, session_id = await cookie_verification(request, redis_session)

    try:
        await delete_session(redis_session, session_id)

        return {"message": "Logged out", "user_info": {"user_id": session_data.user_id}}
    except ValueError:
        # Token is invalid or verification failed
        raise HTTPException(
            status_code=401, detail="Invalid token or token verification failed"
        )


@app.get("/get_session")
async def protected_endpoint(request: Request):
    session_data, _ = await cookie_verification(request, redis_session)

    try:
        user_info = await check_user_exists(session_data.user_id)
        return user_info
    except ValueError:
        raise HTTPException(
            status_code=401, detail="Invalid token or token verification failed"
        )


@app.get("/get_just_user_details")
async def user_details(request: Request):
    session_data, _ = await cookie_verification(request, redis_session)

    try:
        user_info = await check_only_user_exists(session_data.user_id)
        return user_info
    except ValueError:
        raise HTTPException(
            status_code=401, detail="Invalid token or token verification failed"
        )


@app.get("/health")
async def health_check():
    try:
        await redis_session.ping()
        return {"status": "ok", "redis": "connected"}
    except Exception:
        raise HTTPException(status_code=503, detail={"status": "error", "redis": "disconnected"})


if __name__ == "__main__":
    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=2468)

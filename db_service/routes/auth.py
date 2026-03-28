"""
Authentication routes — absorbed from auth_backend.

Provides:
- Google OAuth flow (redirect + callback)
- Email registration and login
- Logout (session destruction)
- Cookie-authenticated versions of user data endpoints
  (session, basket, orders, claims, claimable, tasks, events, user details)
"""
import os
import uuid
import logging
import asyncio
import json

import bcrypt
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, JSONResponse
from starlette.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload, selectinload
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from dependencies import get_db, get_redis, get_session_redis, get_current_user
from cache import cached
from helpers import _order_to_response
from utils import check_user_existence, add_user_to_db

from fitd_schemas.fitd_db_schemas import (
    User, Task, BasketItem, Order, UserStripeAccount, Claim, FulfillerProfile,
)
from fitd_schemas.fitd_classes import (
    UserInformation,
    SessionData,
    EmailRegisterRequest,
    EmailLoginRequest,
    UserResponse,
    TaskResponse,
    BasketItemResponse,
    OrderResponse,
    ClaimWithOrderResponse,
    IncompleteTaskResponse,
    SlimSessionResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Config ───────────────────────────────────────────────────────────────

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
IS_PRODUCTION = os.getenv("ENV", "development") == "production"

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")


# ── Session helpers ──────────────────────────────────────────────────────

async def create_session(session_redis, session_data: SessionData) -> str:
    """Create a new Redis session and return the session ID."""
    session_id = str(uuid.uuid4())
    await session_redis.setex(f"session:{session_id}", 3600, session_data.json())
    return session_id


async def delete_session(session_redis, session_id: str):
    """Delete a session from Redis."""
    result = await session_redis.delete(f"session:{session_id}")
    if result == 0:
        raise HTTPException(status_code=404, detail="Session not found")


def _set_session_cookie(response, session_id: str):
    """Set the fitd_session_data cookie on a response."""
    response.set_cookie(
        "fitd_session_data",
        str(session_id),
        max_age=3600,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="Lax",
    )
    return response


# ── Google OAuth ─────────────────────────────────────────────────────────

@router.get("/auth/google")
def auth_google(request: Request):
    """Redirect to Google OAuth consent screen."""
    google_auth_url = (
        f"{GOOGLE_AUTH_URL}"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=openid%20email%20profile"
        f"&prompt=select_account"
    )
    return RedirectResponse(google_auth_url)


@router.get("/auth/google/callback")
async def auth_callback(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    session_redis=Depends(get_session_redis),
):
    """Handle Google OAuth callback — create user if new, create session."""
    data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    # Step 1: Exchange code for token
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(GOOGLE_TOKEN_URL, data=data)
            response.raise_for_status()
            token_response = response.json()
        except httpx.HTTPStatusError:
            raise HTTPException(status_code=400, detail="Failed to retrieve token")

    # Step 2: Get and verify the ID token
    id_token_value = token_response.get("id_token")
    if not id_token_value:
        raise HTTPException(status_code=400, detail="Missing id_token in response.")

    try:
        id_info = await asyncio.to_thread(
            id_token.verify_oauth2_token,
            id_token_value, google_requests.Request(), GOOGLE_CLIENT_ID
        )

        user_id = id_info["sub"]
        email = id_info["email"]
        username = id_info["name"]

        # Step 3: Check if user exists — DIRECT DB query (no HTTP call)
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            # Create user directly in DB
            user_info = UserInformation(
                user_id=user_id,
                username=username,
                email=email,
                auth_provider="google",
            )
            user = add_user_to_db(db, user_info)

        # Step 4: Create Redis session
        session_data = SessionData(user_id=user_id)
        session_id = await create_session(session_redis, session_data)

        # Step 5: Redirect to frontend with session cookie
        response = RedirectResponse(url=f"{FRONTEND_URL}/generate")
        _set_session_cookie(response, session_id)
        return response

    except ValueError:
        logger.exception("Google token verification failed")
        raise HTTPException(status_code=400, detail="Invalid or expired Google token")


# ── Email Auth ───────────────────────────────────────────────────────────

@router.post("/auth/register")
async def email_register(
    register_request: EmailRegisterRequest,
    db: Session = Depends(get_db),
    session_redis=Depends(get_session_redis),
):
    """Register a new user with email/password."""
    # Check for existing email
    existing_email = db.query(User).filter(User.email == register_request.email).first()
    if existing_email:
        raise HTTPException(status_code=409, detail="Email already registered")

    # Check for existing username
    existing_username = db.query(User).filter(User.username == register_request.username).first()
    if existing_username:
        raise HTTPException(status_code=409, detail="Username already taken")

    # Hash password
    hashed = await asyncio.to_thread(
        bcrypt.hashpw, register_request.password.encode("utf-8"), bcrypt.gensalt()
    )

    user_info = UserInformation(
        user_id=str(uuid.uuid4()),
        username=register_request.username,
        email=register_request.email,
        password_hash=hashed.decode("utf-8"),
        auth_provider="email",
    )

    # Create user directly in DB
    user = add_user_to_db(db, user_info)

    # Create session
    session_data = SessionData(user_id=user.user_id)
    session_id = await create_session(session_redis, session_data)

    resp = JSONResponse(content={"message": "Registration successful", "user_id": user.user_id})
    _set_session_cookie(resp, session_id)
    return resp


@router.post("/auth/login")
async def email_login(
    login_request: EmailLoginRequest,
    db: Session = Depends(get_db),
    session_redis=Depends(get_session_redis),
):
    """Login with email/password."""
    # Direct DB query for user
    user = db.query(User).filter(User.email == login_request.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Check if this is a Google-only account
    if not user.password_hash:
        raise HTTPException(status_code=400, detail="This account uses Google sign-in")

    # Verify password directly
    is_valid = await asyncio.to_thread(
        bcrypt.checkpw,
        login_request.password.encode("utf-8"),
        user.password_hash.encode("utf-8"),
    )
    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Create session
    session_data = SessionData(user_id=user.user_id)
    session_id = await create_session(session_redis, session_data)

    resp = JSONResponse(content={"message": "Login successful", "user_id": user.user_id})
    _set_session_cookie(resp, session_id)
    return resp


# ── Logout ───────────────────────────────────────────────────────────────

@router.get("/logout")
async def logout(
    request: Request,
    session_redis=Depends(get_session_redis),
):
    """Destroy session and clear cookie."""
    session_id = request.cookies.get("fitd_session_data")
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Read session data before deleting (for the response)
    raw = await session_redis.get(f"session:{session_id}")
    user_id = None
    if raw:
        try:
            parsed = json.loads(raw)
            user_id = parsed.get("user_id")
        except (json.JSONDecodeError, ValueError):
            pass

    try:
        await delete_session(session_redis, session_id)
    except HTTPException:
        pass  # Session already gone — that's fine for logout

    response = JSONResponse(content={
        "message": "Logged out",
        "user_info": {"user_id": user_id},
    })
    response.delete_cookie("fitd_session_data")
    return response


# ── Cookie-authenticated user data endpoints ─────────────────────────────
# These replace the auth_backend proxy endpoints. The frontend calls these
# directly with cookies instead of going through auth_backend.

@router.get("/get_just_user_details")
async def user_details(user: User = Depends(get_current_user)):
    """Return basic user info from cookie auth."""
    return {
        "user_id": user.user_id,
        "username": user.username,
        "email": user.email,
        "auth_provider": user.auth_provider,
    }


@router.get("/session")
def get_slim_session_cookie(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    redis_client=Depends(get_redis),
):
    """Cookie-authenticated slim session (same logic as /users/{user_id}/session)."""
    user_id = user.user_id
    cache_key = f"fitd:session:{user_id}"

    if redis_client is not None:
        try:
            raw = redis_client.get(cache_key)
            if raw is not None:
                return SlimSessionResponse.parse_raw(raw)
        except Exception:
            logger.warning(f"Redis GET failed for {cache_key}, falling through to DB")

    incomplete = (
        db.query(Task)
        .filter(Task.user_id == user_id, Task.complete == False)
        .options(joinedload(Task.port))
        .first()
    )

    user_stripe = db.query(UserStripeAccount).filter(
        UserStripeAccount.user_id == user_id
    ).first()

    fulfiller_profile = db.query(FulfillerProfile).filter(
        FulfillerProfile.user_id == user_id
    ).first()

    result = SlimSessionResponse(
        user=UserResponse.from_orm(user),
        stripe_onboarded=bool(user_stripe and user_stripe.onboarding_complete),
        has_fulfiller_profile=bool(fulfiller_profile),
        incomplete_task=IncompleteTaskResponse.from_orm(incomplete) if incomplete else None,
    )

    if redis_client is not None:
        try:
            redis_client.set(cache_key, result.json(), ex=30)
        except Exception:
            logger.warning(f"Redis SET failed for {cache_key}")

    return result


@router.get("/user_basket")
def get_user_basket_cookie(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    redis_client=Depends(get_redis),
):
    """Cookie-authenticated basket endpoint."""
    user_id = user.user_id
    return cached(
        redis_client, f"fitd:basket:{user_id}", ttl=60,
        loader=lambda: [BasketItemResponse.from_orm(b) for b in db.query(BasketItem).filter(BasketItem.user_id == user_id).all()],
        model_class=BasketItemResponse, is_list=True,
    )


@router.get("/user_orders")
def get_user_orders_cookie(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    redis_client=Depends(get_redis),
):
    """Cookie-authenticated orders endpoint."""
    user_id = user.user_id
    return cached(
        redis_client, f"fitd:orders:{user_id}", ttl=120,
        loader=lambda: [_order_to_response(o) for o in db.query(Order).filter(Order.user_id == user_id).all()],
        model_class=OrderResponse, is_list=True,
    )


@router.get("/user_claims")
def get_user_claims_cookie(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    redis_client=Depends(get_redis),
):
    """Cookie-authenticated claims endpoint."""
    user_id = user.user_id
    cache_key = f"fitd:claims:{user_id}"

    if redis_client is not None:
        try:
            raw = redis_client.get(cache_key)
            if raw is not None:
                return [ClaimWithOrderResponse.parse_obj(item) for item in json.loads(raw)]
        except Exception:
            logger.warning(f"Redis GET failed for {cache_key}, falling through to DB")

    claims = (
        db.query(Claim)
        .filter(Claim.claimant_user_id == user_id)
        .options(selectinload(Claim.order))
        .all()
    )
    claims_response = []
    for claim in claims:
        order_data = _order_to_response(claim.order)
        claims_response.append(ClaimWithOrderResponse(
            id=claim.id, order_id=claim.order_id,
            claimant_user_id=claim.claimant_user_id,
            quantity=claim.quantity, status=claim.status,
            created_at=claim.created_at, updated_at=claim.updated_at,
            order=order_data,
        ))

    if redis_client is not None:
        try:
            serialized = json.dumps([c.dict() for c in claims_response], default=str)
            redis_client.set(cache_key, serialized, ex=120)
        except Exception:
            logger.warning(f"Redis SET failed for {cache_key}")

    return claims_response


@router.get("/user_claimable")
def get_user_claimable_cookie(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    redis_client=Depends(get_redis),
):
    """Cookie-authenticated claimable orders endpoint."""
    user_id = user.user_id
    cache_key = f"fitd:claimable:{user_id}"

    if redis_client is not None:
        try:
            raw = redis_client.get(cache_key)
            if raw is not None:
                return [OrderResponse.parse_obj(item) for item in json.loads(raw)]
        except Exception:
            logger.warning(f"Redis GET failed for {cache_key}, falling through to DB")

    all_collaborative = db.query(Order).filter(
        Order.user_id != user_id,
        Order.is_collaborative == True,
    ).all()

    fulfiller_profile = db.query(FulfillerProfile).filter(
        FulfillerProfile.user_id == user_id
    ).first()

    if fulfiller_profile and fulfiller_profile.capabilities:
        cap_lookup = {}
        for cap in fulfiller_profile.capabilities:
            mat_ids = None
            if cap.materials:
                try:
                    parsed = json.loads(cap.materials) if isinstance(cap.materials, str) else cap.materials
                    mat_ids = set(parsed) if parsed else None
                except (ValueError, TypeError):
                    mat_ids = None
            cap_lookup[cap.process_id] = mat_ids

        claimable_orders = []
        for order in all_collaborative:
            if order.process_id is None:
                claimable_orders.append(order)
            elif order.process_id in cap_lookup:
                fulfiller_mats = cap_lookup[order.process_id]
                if fulfiller_mats is None or order.material_id is None or order.material_id in fulfiller_mats:
                    claimable_orders.append(order)
    else:
        claimable_orders = all_collaborative

    claimable_response = [_order_to_response(order) for order in claimable_orders]

    if redis_client is not None:
        try:
            serialized = json.dumps([o.dict() for o in claimable_response], default=str)
            redis_client.set(cache_key, serialized, ex=60)
        except Exception:
            logger.warning(f"Redis SET failed for {cache_key}")

    return claimable_response


@router.get("/user_tasks")
def get_user_tasks_cookie(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    redis_client=Depends(get_redis),
):
    """Cookie-authenticated tasks endpoint."""
    user_id = user.user_id
    return cached(
        redis_client, f"fitd:tasks:{user_id}", ttl=120,
        loader=lambda: [TaskResponse.from_orm(t) for t in db.query(Task).filter(Task.user_id == user_id).options(joinedload(Task.port)).all()],
        model_class=TaskResponse, is_list=True,
    )


# ── SSE Events (cookie-authenticated) ───────────────────────────────────

@router.get("/events")
async def user_events_cookie(
    request: Request,
    user: User = Depends(get_current_user),
):
    """Cookie-authenticated SSE endpoint — directly subscribes to Redis pubsub."""
    import redis.asyncio as aioredis
    from sse_starlette.sse import EventSourceResponse

    user_id = user.user_id
    redis_url = f"redis://{os.getenv('REDIS_HOST', 'localhost')}:{os.getenv('REDIS_PORT', '6379')}"

    async def event_generator():
        redis_async = aioredis.from_url(redis_url, decode_responses=True)
        pubsub = redis_async.pubsub()
        await pubsub.subscribe(f"sse:{user_id}", "sse:global")
        try:
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message["type"] == "message":
                    yield {"data": message["data"]}
                await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            pass
        finally:
            await pubsub.unsubscribe()
            await redis_async.close()

    return EventSourceResponse(event_generator(), ping=30)

"""
Authentication routes — multi-provider OAuth, email auth, verification, password reset.

Provides:
- Google OAuth flow (redirect + callback)
- GitHub OAuth flow (redirect + callback)
- Email registration and login
- Email verification
- Password reset (forgot + reset)
- Logout (session destruction)
- Cookie-authenticated versions of user data endpoints
  (session, basket, orders, claims, claimable, tasks, events, user details)
"""
import os
import uuid
import logging
import asyncio
import json
import random
import string

import bcrypt
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, JSONResponse
from starlette.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload, selectinload

from rate_limit import limiter
from dependencies import get_db, get_redis, get_session_redis, get_current_user
from cache import cached
from helpers import _order_to_response
from utils import check_user_existence, add_user_to_db

from oauth_providers import (
    OAuthUserInfo,
    get_google_authorize_url,
    google_exchange_code,
    google_get_user_info,
    get_github_authorize_url,
    github_exchange_code,
    github_get_user_info,
)
from email_service import (
    generate_verification_token,
    verify_verification_token,
    generate_reset_token,
    verify_reset_token,
    send_verification_email,
    send_reset_email,
)

from fitd_schemas.fitd_db_schemas import (
    User, UserOAuthAccount, Task, BasketItem, Order, UserStripeAccount, Claim, FulfillerProfile,
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


# ── Shared OAuth helpers ─────────────────────────────────────────────────

def _generate_unique_username(db: Session, desired: str) -> str:
    """Return `desired` if available, otherwise append a random suffix."""
    if not desired:
        desired = "user"
    existing = db.query(User).filter(User.username == desired).first()
    if not existing:
        return desired
    # Append random suffix until unique
    for _ in range(10):
        suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=4))
        candidate = f"{desired}_{suffix}"
        if not db.query(User).filter(User.username == candidate).first():
            return candidate
    # Fallback — extremely unlikely
    return f"{desired}_{uuid.uuid4().hex[:8]}"


def _find_or_create_oauth_user(oauth_info: OAuthUserInfo, db: Session) -> User:
    """
    Account linking logic:
    1. Check if this OAuth account is already linked → return that user
    2. If email is verified by provider and matches an existing user → auto-link
    3. Otherwise → create a new user
    """
    # 1. Check existing OAuth link
    existing_link = db.query(UserOAuthAccount).filter(
        UserOAuthAccount.provider == oauth_info.provider,
        UserOAuthAccount.provider_user_id == oauth_info.provider_user_id,
    ).first()
    if existing_link:
        user = db.query(User).filter(User.user_id == existing_link.user_id).first()
        if user:
            return user

    # 2. Check existing user by email (auto-link if email is verified by provider)
    if oauth_info.email and oauth_info.email_verified:
        existing_user = db.query(User).filter(User.email == oauth_info.email).first()
        if existing_user:
            db.add(UserOAuthAccount(
                user_id=existing_user.user_id,
                provider=oauth_info.provider,
                provider_user_id=oauth_info.provider_user_id,
                provider_email=oauth_info.email,
            ))
            if not existing_user.email_verified:
                existing_user.email_verified = True
            db.commit()
            return existing_user

    # 3. New user
    user_id = oauth_info.provider_user_id if oauth_info.provider == "google" else str(uuid.uuid4())
    username = _generate_unique_username(
        db, oauth_info.name or (oauth_info.email.split("@")[0] if oauth_info.email else "user")
    )

    new_user = User(
        user_id=user_id,
        username=username,
        email=oauth_info.email,
        auth_provider=oauth_info.provider,
        email_verified=oauth_info.email_verified,
    )
    db.add(new_user)
    db.add(UserOAuthAccount(
        user_id=user_id,
        provider=oauth_info.provider,
        provider_user_id=oauth_info.provider_user_id,
        provider_email=oauth_info.email,
    ))
    db.commit()
    db.refresh(new_user)
    return new_user


async def _handle_oauth_callback(provider: str, code: str, db: Session, session_redis):
    """Shared logic for Google + GitHub OAuth callbacks."""
    try:
        if provider == "google":
            token_data = await google_exchange_code(code)
            oauth_info = await google_get_user_info(token_data)
        elif provider == "github":
            token_data = await github_exchange_code(code)
            oauth_info = await github_get_user_info(token_data)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=400, detail=f"Failed to authenticate with {provider}")
    except ValueError:
        logger.exception(f"{provider} token verification failed")
        raise HTTPException(status_code=400, detail=f"Invalid or expired {provider} token")

    user = _find_or_create_oauth_user(oauth_info, db)

    session_data = SessionData(user_id=user.user_id)
    session_id = await create_session(session_redis, session_data)

    response = RedirectResponse(url=f"{FRONTEND_URL}/generate")
    _set_session_cookie(response, session_id)
    return response


# ── Google OAuth ─────────────────────────────────────────────────────────

@router.get("/auth/google")
@limiter.limit("10/minute")
def auth_google(request: Request):
    """Redirect to Google OAuth consent screen."""
    return RedirectResponse(get_google_authorize_url())


@router.get("/auth/google/callback")
async def auth_google_callback(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    session_redis=Depends(get_session_redis),
):
    """Handle Google OAuth callback."""
    return await _handle_oauth_callback("google", code, db, session_redis)


# ── GitHub OAuth ─────────────────────────────────────────────────────────

@router.get("/auth/github")
@limiter.limit("10/minute")
def auth_github(request: Request):
    """Redirect to GitHub OAuth consent screen."""
    return RedirectResponse(get_github_authorize_url())


@router.get("/auth/github/callback")
async def auth_github_callback(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    session_redis=Depends(get_session_redis),
):
    """Handle GitHub OAuth callback."""
    return await _handle_oauth_callback("github", code, db, session_redis)


# ── Email Auth ───────────────────────────────────────────────────────────

@router.post("/auth/register")
@limiter.limit("3/minute")
async def email_register(
    request: Request,
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

    user_id = str(uuid.uuid4())
    user = User(
        user_id=user_id,
        username=register_request.username,
        email=register_request.email,
        password_hash=hashed.decode("utf-8"),
        auth_provider="email",
        email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Send verification email (non-fatal — don't block registration if email fails)
    try:
        token = generate_verification_token(user.user_id, user.email)
        await send_verification_email(user.email, token)
    except Exception as e:
        logger.warning(f"Verification email failed for {user.email}: {e}")

    # Create session
    session_data = SessionData(user_id=user.user_id)
    session_id = await create_session(session_redis, session_data)

    resp = JSONResponse(content={
        "message": "Registration successful. Please check your email to verify your account.",
        "user_id": user.user_id,
    })
    _set_session_cookie(resp, session_id)
    return resp


@router.post("/auth/login")
@limiter.limit("5/minute")
async def email_login(
    request: Request,
    login_request: EmailLoginRequest,
    db: Session = Depends(get_db),
    session_redis=Depends(get_session_redis),
):
    """Login with email/password."""
    # Direct DB query for user
    user = db.query(User).filter(User.email == login_request.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Check if this is an OAuth-only account
    if not user.password_hash:
        raise HTTPException(
            status_code=400,
            detail=f"This account uses {user.auth_provider} sign-in. Please log in with {user.auth_provider}.",
        )

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


# ── Email Verification ───────────────────────────────────────────────────

@router.get("/auth/verify-email")
async def verify_email(
    token: str,
    db: Session = Depends(get_db),
):
    """Verify email from token link — redirects to frontend."""
    try:
        payload = verify_verification_token(token)
    except Exception:
        return RedirectResponse(url=f"{FRONTEND_URL}/verify-email?status=invalid")

    user = db.query(User).filter(User.user_id == payload["sub"]).first()
    if not user:
        return RedirectResponse(url=f"{FRONTEND_URL}/verify-email?status=invalid")

    if user.email_verified:
        return RedirectResponse(url=f"{FRONTEND_URL}/verify-email?status=already_verified")

    # Verify the token email matches the user's current email
    if user.email != payload.get("email"):
        return RedirectResponse(url=f"{FRONTEND_URL}/verify-email?status=invalid")

    user.email_verified = True
    db.commit()

    return RedirectResponse(url=f"{FRONTEND_URL}/verify-email?status=success")


@router.post("/auth/resend-verification")
@limiter.limit("2/minute")
async def resend_verification(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Resend verification email for the currently authenticated user."""
    if user.email_verified:
        return JSONResponse(content={"message": "Email already verified"})

    token = generate_verification_token(user.user_id, user.email)
    await send_verification_email(user.email, token)

    return JSONResponse(content={"message": "Verification email sent"})


# ── Password Reset ───────────────────────────────────────────────────────

@router.post("/auth/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    body: dict,
    db: Session = Depends(get_db),
):
    """Send password reset email. Always returns success to prevent email enumeration."""
    email = body.get("email", "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    # Always return success — don't reveal whether account exists
    user = db.query(User).filter(User.email == email).first()
    if user and user.password_hash:
        # Only send reset for accounts that have a password (not OAuth-only)
        token = generate_reset_token(user.user_id, user.email)
        await send_reset_email(user.email, token)

    return JSONResponse(content={
        "message": "If an account exists with that email, a reset link has been sent."
    })


@router.post("/auth/reset-password")
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    body: dict,
    db: Session = Depends(get_db),
    session_redis=Depends(get_session_redis),
):
    """Reset password using a valid reset token."""
    token = body.get("token", "")
    new_password = body.get("password", "")

    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Token and password are required")

    if len(new_password) < 12:
        raise HTTPException(status_code=400, detail="Password must be at least 12 characters")

    try:
        payload = verify_reset_token(token)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user = db.query(User).filter(User.user_id == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    # Verify the token email matches the user's current email
    if user.email != payload.get("email"):
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    # Hash and set new password
    hashed = await asyncio.to_thread(
        bcrypt.hashpw, new_password.encode("utf-8"), bcrypt.gensalt()
    )
    user.password_hash = hashed.decode("utf-8")
    db.commit()

    # Invalidate all existing sessions for this user by scanning Redis
    # (best-effort — if Redis scan fails, user just needs to re-login)
    try:
        cursor = 0
        while True:
            cursor, keys = await session_redis.scan(cursor, match="session:*", count=100)
            for key in keys:
                raw = await session_redis.get(key)
                if raw:
                    try:
                        data = json.loads(raw)
                        if data.get("user_id") == user.user_id:
                            await session_redis.delete(key)
                    except (json.JSONDecodeError, ValueError):
                        pass
            if cursor == 0:
                break
    except Exception:
        logger.warning(f"Failed to invalidate sessions for user {user.user_id} after password reset")

    return JSONResponse(content={"message": "Password reset successful. Please log in."})


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
        "email_verified": getattr(user, "email_verified", False),
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
        email_verified=getattr(user, "email_verified", False),
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

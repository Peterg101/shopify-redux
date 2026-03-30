"""
Centralised FastAPI dependencies for api_service.
"""
import os
import json
import logging
from fastapi import Depends, Request, HTTPException, Cookie, Header
from sqlalchemy.orm import Session
from fitd_schemas.fitd_db_schemas import User
from jose import jwt, JWTError

logger = logging.getLogger(__name__)

JWT_SECRET = os.getenv("JWT_SECRET_KEY", "dev-secret-key")
JWT_ALGORITHM = "HS256"

# Re-export existing deps so route files can import from one place
from db_setup import get_db, get_redis


# Async Redis for sessions (from lifespan via app.state)
async def get_session_redis(request: Request):
    return request.app.state.session_redis


# Current user from cookie — replaces the old auth_backend HTTP call
async def get_current_user(
    fitd_session_data: str = Cookie(None),
    request: Request = None,
    db: Session = Depends(get_db),
):
    """Authenticate user via HttpOnly session cookie + Redis session lookup."""
    if not fitd_session_data:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_redis = request.app.state.session_redis
    session_data = await session_redis.get(f"session:{fitd_session_data}")
    if not session_data:
        raise HTTPException(status_code=401, detail="Session expired")

    parsed = json.loads(session_data)
    user_id = parsed.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session data")

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# Require verified email — for sensitive operations (checkout, claiming)
async def require_verified_email(user: User = Depends(get_current_user)):
    if not getattr(user, "email_verified", False):
        raise HTTPException(
            status_code=403,
            detail="Please verify your email to perform this action",
        )
    return user


# Authenticate mobile user via Bearer JWT token
async def get_mobile_user(
    authorization: str = Header(None),
    db: Session = Depends(get_db),
):
    """Authenticate user via Authorization: Bearer <jwt> header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM], options={"verify_aud": False})
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# Authenticate from either cookie (web) or Bearer token (mobile)
async def get_any_user(
    request: Request,
    fitd_session_data: str = Cookie(None),
    authorization: str = Header(None),
    db: Session = Depends(get_db),
):
    """Try cookie auth first (web), fall back to Bearer token (mobile)."""
    # Try cookie first
    if fitd_session_data:
        session_redis = request.app.state.session_redis
        session_data = await session_redis.get(f"session:{fitd_session_data}")
        if session_data:
            parsed = json.loads(session_data)
            user_id = parsed.get("user_id")
            if user_id:
                user = db.query(User).filter(User.user_id == user_id).first()
                if user:
                    return user

    # Fall back to Bearer token
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM], options={"verify_aud": False})
            user_id = payload.get("user_id")
            if user_id:
                user = db.query(User).filter(User.user_id == user_id).first()
                if user:
                    return user
        except JWTError:
            pass

    raise HTTPException(status_code=401, detail="Not authenticated")


# Media service client (for thumbnail gen, STEP processing)
def get_media_client(request: Request):
    return request.app.state.media_client

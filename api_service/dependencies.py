"""
Centralised FastAPI dependencies for db_service.
"""
import os
import json
import logging
from fastapi import Depends, Request, HTTPException, Cookie
from sqlalchemy.orm import Session
from fitd_schemas.fitd_db_schemas import User

logger = logging.getLogger(__name__)

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


# Media service client (for thumbnail gen, STEP processing)
def get_media_client(request: Request):
    return request.app.state.media_client

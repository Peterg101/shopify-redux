"""Shared utilities used by both Meshy and CAD routes."""
import os
import logging
import httpx
from fastapi import Request, WebSocket
from redis.asyncio import Redis as AsyncRedis

from jwt_auth import generate_token

logger = logging.getLogger(__name__)

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://localhost:2468")
DB_SERVICE_URL = os.getenv("DB_SERVICE_URL", "http://localhost:8000")


# ---------------------------------------------------------------------------
# Redis dependency
# ---------------------------------------------------------------------------

async def get_redis(request: Request) -> AsyncRedis:
    """FastAPI dependency -- returns the app-level Redis connection."""
    return request.app.state.redis


# ---------------------------------------------------------------------------
# Session validation (WebSocket)
# ---------------------------------------------------------------------------

async def validate_session(websocket: WebSocket) -> tuple[bool, str | None]:
    """Validate session from WebSocket cookies.

    Uses the CAD service's cleaner approach: extract the session cookie
    directly from websocket.cookies rather than parsing the raw header.
    """
    session_id = websocket.cookies.get("fitd_session_data")
    if not session_id:
        return False, None

    data = await _http_session_exists(session_id)
    if data:
        user = data.get("user")
        user_id = user.get("user_id") if user else None
        return True, user_id
    return False, None


# ---------------------------------------------------------------------------
# Cookie verification (HTTP endpoints)
# ---------------------------------------------------------------------------

async def cookie_verification(request: Request):
    """Verify session cookie for HTTP endpoints."""
    from fitd_schemas.auth_utils import cookie_verification as _cookie_verification

    return await _cookie_verification(request, _http_session_exists)


# ---------------------------------------------------------------------------
# Session helpers
# ---------------------------------------------------------------------------

async def _http_session_exists(session_id: str):
    """Check if a session exists via the auth service (HTTP).

    Returns the session data dict on success, or None on failure.
    """
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{AUTH_SERVICE_URL}/session",
                cookies={"fitd_session_data": session_id},
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        logger.error(f"Session check error: {e}")
    return None


# ---------------------------------------------------------------------------
# Inter-service HTTP helpers
# ---------------------------------------------------------------------------

async def register_task(
    user_id: str, task_name: str, port_id: str, task_id: str | None = None,
    file_type: str = "obj",
) -> str | None:
    """Register a new task in db_service, returns task_id."""
    import uuid

    if task_id is None:
        task_id = str(uuid.uuid4())

    auth_token = generate_token("generation_service")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}",
    }
    payload = {
        "task_id": task_id,
        "user_id": user_id,
        "task_name": task_name,
        "file_type": file_type,
        "port_id": port_id,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{DB_SERVICE_URL}/tasks", json=payload, headers=headers
            )
            if resp.status_code in (200, 201):
                return task_id
            logger.error(f"register_task failed: {resp.status_code} {resp.text}")
    except Exception as e:
        logger.error(f"register_task error: {e}")
    return None


async def mark_task_complete(task_id: str):
    """Mark a task as complete in db_service (clears incomplete_task flag)."""
    auth_token = generate_token("generation_service")
    headers = {"Authorization": f"Bearer {auth_token}"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.patch(
                f"{DB_SERVICE_URL}/tasks/{task_id}/complete", headers=headers
            )
            if resp.status_code != 200:
                logger.warning(f"mark_task_complete failed: {resp.status_code} {resp.text}")
    except Exception as e:
        logger.warning(f"mark_task_complete error: {e}")


async def publish(redis: AsyncRedis, port_id: str, message: str):
    """Publish a progress message to the Redis channel.

    Also stores terminal states (Completed/Failed) in a Redis key so that
    late-connecting WebSocket clients can retrieve the final status.
    """
    await redis.publish(f"task_progress:{port_id}", message)
    if message.startswith("Task Completed") or message.startswith("Task Failed"):
        await redis.set(f"task_result:{port_id}", message, ex=300)

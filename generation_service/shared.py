"""Shared utilities used by both Meshy and CAD routes."""
import os
import json
import logging
import httpx
from fastapi import Cookie, HTTPException, Request
from redis.asyncio import Redis as AsyncRedis

from jwt_auth import generate_token

logger = logging.getLogger(__name__)

DB_SERVICE_URL = os.getenv("DB_SERVICE_URL", "http://localhost:8000")


# ---------------------------------------------------------------------------
# Redis dependency
# ---------------------------------------------------------------------------

async def get_redis(request: Request) -> AsyncRedis:
    """FastAPI dependency -- returns the app-level Redis connection."""
    return request.app.state.redis


# ---------------------------------------------------------------------------
# Session verification (direct Redis lookup)
# ---------------------------------------------------------------------------

async def get_authenticated_user(
    request: Request,
    fitd_session_data: str = Cookie(None),
) -> dict:
    """Verify session cookie via direct Redis lookup. Returns session dict."""
    if not fitd_session_data:
        raise HTTPException(status_code=401, detail="Not authenticated")

    redis: AsyncRedis = request.app.state.redis
    session_data = await redis.get(f"session:{fitd_session_data}")
    if not session_data:
        raise HTTPException(status_code=401, detail="Session expired")

    parsed = json.loads(session_data)
    if not parsed.get("user_id"):
        raise HTTPException(status_code=401, detail="Invalid session data")

    return parsed


# ---------------------------------------------------------------------------
# Inter-service HTTP helpers
# ---------------------------------------------------------------------------

async def register_task(
    user_id: str, task_name: str, port_id: str, task_id: str | None = None,
    file_type: str = "obj",
) -> str | None:
    """Register a new task in api_service, returns task_id."""
    import uuid

    if task_id is None:
        task_id = str(uuid.uuid4())

    auth_token = generate_token("generation_service", audience="api_service")
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
    """Mark a task as complete in api_service (clears incomplete_task flag)."""
    auth_token = generate_token("generation_service", audience="api_service")
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
    """Publish a progress message and cache the latest state in Redis.

    Every message is cached (not just terminal states) so SSE clients
    can recover progress after a page refresh.
    """
    await redis.publish(f"task_progress:{port_id}", message)
    await redis.set(f"task_state:{port_id}", message, ex=600)  # 10 min TTL

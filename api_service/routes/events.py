"""SSE event stream and health check endpoints."""
import os
import logging
import asyncio

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
import redis.asyncio as aioredis
from sse_starlette.sse import EventSourceResponse

from dependencies import get_db
from jwt_auth import verify_jwt_token

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/events/{user_id}")
async def user_event_stream(
    user_id: str,
    authorization: str = Depends(verify_jwt_token),
):
    """SSE endpoint -- streams real-time events for a specific user."""
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


@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception:
        raise HTTPException(status_code=503, detail={"status": "error", "database": "disconnected"})

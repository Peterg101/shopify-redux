import uuid
from typing import Optional
from models import SessionData
from redis import Redis
from fastapi import HTTPException


async def create_session(redis_session: Redis, session_data: SessionData):
    session_id = str(uuid.uuid4())
    await redis_session.setex(f"session:{session_id}", 3600, session_data.json())
    return session_id


async def get_session(redis_session: Redis, session_id: uuid.UUID) -> Optional[SessionData]:
    session_data = await redis_session.get(f"session:{session_id}")
    if session_data:
        print("SESSION DATAAAA*******************************")
        print(session_data)
        return session_data
    return None


async def delete_session(redis: Redis, session_id: uuid.UUID):
    result = await redis.delete(f"session:{session_id}")
    if result == 0:
        raise HTTPException(status_code=404, detail="Session not found")
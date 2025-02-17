import uuid
from typing import Optional
from models import SessionData
from redis import Redis
from fastapi import HTTPException
import json
from uuid import UUID


async def create_session(redis_session: Redis, session_data: SessionData):
    session_id = str(uuid.uuid4())
    await redis_session.setex(f"session:{session_id}", 3600, session_data.json())
    return session_id


async def get_session(redis_session: Redis, session_id: UUID) -> Optional[SessionData]:
    session_data = await redis_session.get(f"session:{session_id}")
    if session_data:
        print("SESSION DATAAAA*******************************")
        print(session_data)
        
        # If session_data is already a string, parse it as JSON and convert it to a SessionData object
        try:
            if isinstance(session_data, bytes):  # If it's bytes, decode it
                session_data = session_data.decode("utf-8")
            session_dict = json.loads(session_data)  # Parse JSON into a dictionary
            return SessionData(**session_dict)  # Convert dictionary to SessionData
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Error decoding session data: {e}")
            return None
    return None


async def delete_session(redis: Redis, session_id: uuid.UUID):
    result = await redis.delete(f"session:{session_id}")
    if result == 0:
        raise HTTPException(status_code=404, detail="Session not found")
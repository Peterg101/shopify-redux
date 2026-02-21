import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from utils import create_session, get_session, delete_session
from fitd_schemas.fitd_classes import SessionData


class FakeRedis:
    """In-memory fake Redis for testing session operations."""

    def __init__(self):
        self.store = {}

    async def setex(self, key, ttl, value):
        self.store[key] = value

    async def get(self, key):
        return self.store.get(key)

    async def delete(self, key):
        if key in self.store:
            del self.store[key]
            return 1
        return 0


@pytest.fixture
def fake_redis():
    return FakeRedis()


@pytest.mark.asyncio
async def test_create_session(fake_redis):
    session_data = SessionData(user_id="user-123")
    session_id = await create_session(fake_redis, session_data)
    assert session_id is not None
    assert f"session:{session_id}" in fake_redis.store


@pytest.mark.asyncio
async def test_get_session(fake_redis):
    session_data = SessionData(user_id="user-123")
    session_id = await create_session(fake_redis, session_data)
    result = await get_session(fake_redis, session_id)
    assert result is not None
    assert result.user_id == "user-123"


@pytest.mark.asyncio
async def test_get_session_not_found(fake_redis):
    result = await get_session(fake_redis, "nonexistent")
    assert result is None


@pytest.mark.asyncio
async def test_delete_session(fake_redis):
    session_data = SessionData(user_id="user-123")
    session_id = await create_session(fake_redis, session_data)
    await delete_session(fake_redis, session_id)
    result = await get_session(fake_redis, session_id)
    assert result is None


@pytest.mark.asyncio
async def test_delete_session_not_found(fake_redis):
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await delete_session(fake_redis, "nonexistent")
    assert exc_info.value.status_code == 404

import pytest
import bcrypt
from unittest.mock import AsyncMock, patch, MagicMock
from utils import create_session, get_session
from fitd_schemas.fitd_classes import SessionData


class FakeRedis:
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
async def test_email_registration_creates_session(fake_redis):
    """Registering an email user should create a valid Redis session."""
    session_data = SessionData(user_id="email-user-001")
    session_id = await create_session(fake_redis, session_data)
    assert session_id is not None
    assert f"session:{session_id}" in fake_redis.store

    result = await get_session(fake_redis, session_id)
    assert result is not None
    assert result.user_id == "email-user-001"


@pytest.mark.asyncio
async def test_bcrypt_password_hashing():
    """Verify bcrypt hashing and verification works correctly."""
    password = "testpassword123"
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    assert bcrypt.checkpw(password.encode("utf-8"), hashed)
    assert not bcrypt.checkpw("wrongpassword".encode("utf-8"), hashed)

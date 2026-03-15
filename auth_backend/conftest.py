"""
Shared fixtures for auth_backend tests.

Provides a FastAPI TestClient, FakeRedis, and common mock data
used across both utility tests and endpoint tests.

IMPORTANT: The jwt_auth shared package may not be installed in the test
environment. We pre-populate sys.modules with a mock so that
`from jwt_auth import generate_token` in api_calls.py succeeds without
the actual package being installed or JWT_SECRET_KEY being set.
"""
import sys
from unittest.mock import MagicMock

# ---------------------------------------------------------------------------
# Pre-mock jwt_auth before any auth_backend module imports it.
# This must happen at conftest load time (before test collection).
# ---------------------------------------------------------------------------
if "jwt_auth" not in sys.modules or not hasattr(sys.modules["jwt_auth"], "generate_token"):
    _mock_jwt_auth = MagicMock()
    _mock_jwt_auth.generate_token = MagicMock(return_value="mock-jwt-token")
    _mock_jwt_auth.verify_jwt_token = MagicMock(return_value={"sub": "auth_backend"})
    sys.modules["jwt_auth"] = _mock_jwt_auth

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
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

    async def ping(self):
        return True


@pytest.fixture
def fake_redis():
    return FakeRedis()


@pytest.fixture
def test_client():
    """Create a TestClient for auth_backend's FastAPI app.

    We import main lazily so the jwt_auth mock in sys.modules is already
    in place by the time api_calls.py runs ``from jwt_auth import ...``.
    """
    from main import app
    return TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Common mock data
# ---------------------------------------------------------------------------
MOCK_USER_ID = "test-user-123"
MOCK_EMAIL = "test@example.com"
MOCK_USERNAME = "TestUser"
MOCK_SESSION_ID = "fake-session-id-abc"

MOCK_SESSION_DATA = SessionData(user_id=MOCK_USER_ID)

MOCK_USER_RESPONSE = {
    "user_id": MOCK_USER_ID,
    "username": MOCK_USERNAME,
    "email": MOCK_EMAIL,
    "auth_provider": "google",
}

MOCK_USER_DETAILS_RESPONSE = {
    "user_id": MOCK_USER_ID,
    "username": MOCK_USERNAME,
    "email": MOCK_EMAIL,
}

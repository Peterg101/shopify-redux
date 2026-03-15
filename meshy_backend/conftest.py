"""
Root conftest for meshy_backend tests.

Pre-mocks jwt_auth in sys.modules before any service modules import it
(jwt_auth raises RuntimeError at module-level if JWT_SECRET_KEY is not set,
and the root-level tests/conftest.py may have already triggered that failure).
Provides reusable fixtures for the FastAPI TestClient with cookie_verification
overridden.
"""

import sys
from unittest.mock import MagicMock

# Must be done BEFORE importing anything that touches jwt_auth
if "jwt_auth" not in sys.modules or not hasattr(sys.modules["jwt_auth"], "generate_token"):
    _mock_jwt_auth = MagicMock()
    _mock_jwt_auth.generate_token = MagicMock(return_value="mock-jwt-token")
    _mock_jwt_auth.verify_jwt_token = MagicMock(return_value={"sub": "meshy_backend"})
    sys.modules["jwt_auth"] = _mock_jwt_auth

import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

from main import app
from utils import cookie_verification


# ---------------------------------------------------------------------------
# Dependency overrides
# ---------------------------------------------------------------------------

async def _override_cookie_verification():
    """Stub that always passes — cookie_verification returns None on success."""
    return None


async def _override_get_redis():
    """Return a lightweight AsyncMock that behaves like an AsyncRedis client."""
    mock_redis = AsyncMock()
    # pubsub() returns a mock that supports subscribe / listen / unsubscribe / close
    mock_pubsub = AsyncMock()
    mock_redis.pubsub.return_value = mock_pubsub
    return mock_redis


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def client():
    """
    TestClient with cookie_verification AND get_redis overridden.
    Background tasks run synchronously by default in TestClient, but the
    background functions are heavy (call Meshy API, Redis, etc.) so we
    patch them at the module level in individual tests.
    """
    from main import get_redis

    app.dependency_overrides[cookie_verification] = _override_cookie_verification
    app.dependency_overrides[get_redis] = _override_get_redis
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def unauthenticated_client():
    """
    TestClient WITHOUT cookie_verification override — requests that require
    auth will be rejected with 401.  Still overrides get_redis to avoid
    connecting to a real Redis instance.
    """
    from main import get_redis

    app.dependency_overrides.pop(cookie_verification, None)
    app.dependency_overrides[get_redis] = _override_get_redis
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

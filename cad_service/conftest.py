"""Shared fixtures for cad_service tests."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient

from main import app, get_redis
from utils import cookie_verification


# ---------------------------------------------------------------------------
# Auth override — bypass cookie_verification for endpoint tests
# ---------------------------------------------------------------------------

async def _override_cookie_verification():
    """Stub that always succeeds (no real session required)."""
    return None


# ---------------------------------------------------------------------------
# Mock Redis
# ---------------------------------------------------------------------------

def _make_mock_redis():
    """Return a mock AsyncRedis that satisfies both pub/sub and get/set."""
    mock = AsyncMock()
    mock.publish = AsyncMock()
    mock.set = AsyncMock()
    mock.get = AsyncMock(return_value=None)

    # pubsub object
    pubsub = AsyncMock()
    pubsub.subscribe = AsyncMock()
    pubsub.unsubscribe = AsyncMock()
    pubsub.close = AsyncMock()
    mock.pubsub.return_value = pubsub

    return mock


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def mock_redis():
    """Provide a mock AsyncRedis instance."""
    return _make_mock_redis()


@pytest.fixture()
def authed_client(mock_redis):
    """TestClient with cookie auth bypassed and Redis mocked out."""
    app.dependency_overrides[cookie_verification] = _override_cookie_verification
    app.dependency_overrides[get_redis] = lambda: mock_redis

    client = TestClient(app)
    yield client

    app.dependency_overrides.clear()


@pytest.fixture()
def unauthed_client(mock_redis):
    """TestClient with NO auth override — cookie_verification will run and fail."""
    # Remove any leftover overrides, but still mock Redis
    app.dependency_overrides.pop(cookie_verification, None)
    app.dependency_overrides[get_redis] = lambda: mock_redis

    client = TestClient(app)
    yield client

    app.dependency_overrides.clear()

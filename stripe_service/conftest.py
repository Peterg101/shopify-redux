import pytest
from unittest.mock import AsyncMock
from fastapi.testclient import TestClient
from fitd_schemas.fitd_classes import UserInformation
from main import app
from utils import cookie_verification, cookie_verification_user_only
from dependencies import get_db_api


TEST_USER = UserInformation(
    user_id="test-user-123",
    username="testuser",
    email="test@example.com",
)


async def override_cookie_verification():
    return None


async def override_cookie_verification_user_only():
    return TEST_USER


def override_get_db_api():
    """Returns a mock ServiceClient. Tests that need specific behavior
    should mock the api_calls functions directly (they're pure functions
    that take db_api as a parameter)."""
    return AsyncMock()


@pytest.fixture
def client():
    app.dependency_overrides[cookie_verification] = override_cookie_verification
    app.dependency_overrides[cookie_verification_user_only] = override_cookie_verification_user_only
    app.dependency_overrides[get_db_api] = override_get_db_api
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

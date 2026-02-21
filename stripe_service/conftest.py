import pytest
from fastapi.testclient import TestClient
from fitd_schemas.fitd_classes import UserInformation
from main import app
from utils import cookie_verification, cookie_verification_user_only


TEST_USER = UserInformation(
    user_id="test-user-123",
    username="testuser",
    email="test@example.com",
)


async def override_cookie_verification():
    return None


async def override_cookie_verification_user_only():
    return TEST_USER


@pytest.fixture
def client():
    app.dependency_overrides[cookie_verification] = override_cookie_verification
    app.dependency_overrides[cookie_verification_user_only] = override_cookie_verification_user_only
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

import os
import pytest
import httpx
from jwt_auth import generate_token


@pytest.fixture(scope="session")
def base_urls():
    return {
        "db": os.getenv("DB_SERVICE_URL", "http://localhost:8000"),
        "auth": os.getenv("AUTH_SERVICE_URL", "http://localhost:2468"),
        "meshy": os.getenv("MESHY_SERVICE_URL", "http://localhost:1234"),
        "stripe": os.getenv("STRIPE_SERVICE_URL", "http://localhost:100"),
    }


@pytest.fixture(scope="session")
def auth_headers():
    token = generate_token("e2e_test")
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }


@pytest.fixture(scope="session")
def client():
    with httpx.Client(timeout=10.0) as c:
        yield c


@pytest.fixture(scope="session")
def test_user_id():
    return "e2e_test_user_001"

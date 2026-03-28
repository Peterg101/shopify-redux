import os
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-unit-tests")
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fitd_schemas.fitd_db_schemas import Base
from fitd_schemas.fitd_classes import UserInformation
from db_setup import get_db
from main import app
from utils import cookie_verification, cookie_verification_user_only
from jwt_auth import verify_jwt_token
from dependencies import get_current_user, require_verified_email
from db_setup import get_redis
from stripe_utils import validate_stripe_header

# In-memory SQLite for tests — use StaticPool so the same in-memory DB is shared
from sqlalchemy.pool import StaticPool

TEST_DATABASE_URL = "sqlite://"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def override_verify_jwt_token():
    return {"sub": "test_service"}


async def override_cookie_verification():
    return None


TEST_USER = UserInformation(
    user_id="test-user-123",
    username="testuser",
    email="test@example.com",
    email_verified=True,
)

CLAIMANT_USER = UserInformation(
    user_id="claimant-user-456",
    username="claimant",
    email="claimant@example.com",
    email_verified=True,
)


async def override_cookie_verification_user_only():
    return TEST_USER


async def override_cookie_verification_claimant():
    return CLAIMANT_USER


async def override_get_current_user():
    return TEST_USER


async def override_get_current_user_claimant():
    return CLAIMANT_USER


async def override_require_verified_email():
    return TEST_USER


async def override_require_verified_email_claimant():
    return CLAIMANT_USER


def override_get_redis():
    """Return None for Redis in tests — cache/event operations gracefully degrade."""
    return None


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client(setup_db):
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[verify_jwt_token] = override_verify_jwt_token
    app.dependency_overrides[cookie_verification] = override_cookie_verification
    app.dependency_overrides[cookie_verification_user_only] = override_cookie_verification_user_only
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[require_verified_email] = override_require_verified_email
    app.dependency_overrides[get_redis] = override_get_redis
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def claimant_client(setup_db):
    """Client that authenticates as the claimant user."""
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[verify_jwt_token] = override_verify_jwt_token
    app.dependency_overrides[cookie_verification] = override_cookie_verification
    app.dependency_overrides[cookie_verification_user_only] = override_cookie_verification_claimant
    app.dependency_overrides[get_current_user] = override_get_current_user_claimant
    app.dependency_overrides[require_verified_email] = override_require_verified_email_claimant
    app.dependency_overrides[get_redis] = override_get_redis
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def db_session(setup_db):
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def seed_user(client):
    """Create a test user in the DB."""
    response = client.post(
        "/users",
        json={"user_id": "test-user-123", "username": "testuser", "email": "test@example.com"},
        headers={"Authorization": "Bearer fake"},
    )
    return response


@pytest.fixture
def seed_claimant_user(client):
    """Create the claimant user in the DB."""
    response = client.post(
        "/users",
        json={"user_id": "claimant-user-456", "username": "claimant", "email": "claimant@example.com"},
        headers={"Authorization": "Bearer fake"},
    )
    return response


@pytest.fixture
def seed_task(client, seed_user):
    """Create a task for the test user."""
    client.post(
        "/tasks",
        json={
            "task_id": "task-001",
            "user_id": "test-user-123",
            "task_name": "Test Task",
            "port_id": "port-001",
        },
        headers={"Authorization": "Bearer fake"},
    )


@pytest.fixture
def seed_order(client, seed_task, db_session):
    """Create an order directly in the DB."""
    from fitd_schemas.fitd_db_schemas import Order
    from datetime import datetime

    order = Order(
        order_id="order-001",
        task_id="task-001",
        user_id="test-user-123",
        stripe_checkout_session_id="cs_test_123",
        name="Test Print",
        material="PLA Basic",
        technique="FDM",
        sizing=1.0,
        colour="white",
        selectedFile="test.obj",
        selectedFileType="obj",
        price=10.0,
        quantity=5,
        created_at=datetime.utcnow().isoformat(),
        is_collaborative=False,
        status="open",
    )
    db_session.add(order)
    db_session.commit()
    return order


def set_auth_as_buyer():
    """Switch the cookie auth override to the order owner (buyer)."""
    app.dependency_overrides[cookie_verification_user_only] = override_cookie_verification_user_only
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[require_verified_email] = override_require_verified_email


def set_auth_as_claimant():
    """Switch the cookie auth override to the claimant (fulfiller)."""
    app.dependency_overrides[cookie_verification_user_only] = override_cookie_verification_claimant
    app.dependency_overrides[get_current_user] = override_get_current_user_claimant
    app.dependency_overrides[require_verified_email] = override_require_verified_email_claimant

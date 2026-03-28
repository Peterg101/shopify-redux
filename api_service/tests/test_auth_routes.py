"""
Tests for db_service/routes/auth.py — auth endpoints ported from auth_backend.

Covers:
  - Google OAuth redirect + callback
  - Email registration + login
  - Logout
  - Cookie-authenticated proxy endpoints (session, basket, orders)

Key difference from old auth_backend tests: the auth routes now have direct DB
access, so we don't mock HTTP calls to db_service. We only mock:
  - Google OAuth token verification (google.oauth2.id_token)
  - The token-exchange HTTP call (httpx.AsyncClient)
  - Redis session operations (via get_session_redis dependency override)
"""
import json
import pytest
import bcrypt
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from httpx import Request as HttpxRequest, HTTPStatusError

from main import app
from dependencies import get_db, get_session_redis, get_current_user, get_redis
from fitd_schemas.fitd_db_schemas import Base, User, BasketItem, Order
from fitd_schemas.fitd_classes import UserInformation

# Re-use the conftest DB engine / session infrastructure
from conftest import (
    test_engine,
    TestingSessionLocal,
    override_get_db,
    TEST_USER,
)


# ── Fake Redis for session operations ─────────────────────────────────────

class FakeSessionRedis:
    """In-memory fake async Redis that supports the subset used by auth routes."""

    def __init__(self):
        self.store: dict[str, str] = {}

    async def setex(self, key: str, ttl: int, value: str):
        self.store[key] = value

    async def get(self, key: str):
        return self.store.get(key)

    async def delete(self, key: str):
        if key in self.store:
            del self.store[key]
            return 1
        return 0


# ── Fixtures ──────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def setup_db():
    """Create / tear-down tables for every test."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def fake_session_redis():
    return FakeSessionRedis()


@pytest.fixture
def auth_client(setup_db, fake_session_redis):
    """
    TestClient with DB + session-redis overrides, but WITHOUT
    get_current_user overridden — so cookie-auth routes will go through the
    real dependency (or we override it per-test for proxy endpoints).
    """
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_session_redis] = lambda: fake_session_redis
    app.dependency_overrides[get_redis] = lambda: None  # no cache redis needed
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


def _seed_email_user(db_session, email="user@example.com", username="testuser",
                     user_id="email-user-001", password="SecurePassword123"):
    """Insert an email-auth user with a hashed password directly into the DB."""
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    user = User(
        user_id=user_id,
        username=username,
        email=email,
        password_hash=hashed.decode("utf-8"),
        auth_provider="email",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _seed_google_user(db_session, email="guser@gmail.com", username="guser",
                      user_id="google-sub-123"):
    """Insert a Google-auth user (no password) directly into the DB."""
    user = User(
        user_id=user_id,
        username=username,
        email=email,
        password_hash=None,
        auth_provider="google",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


# ── Helper to build a mock httpx token exchange ───────────────────────────

def _mock_httpx_token_exchange(id_token_value="fake-id-token", fail=False):
    """Return a patched httpx.AsyncClient context-manager that returns a token."""
    mock_token_response = MagicMock()
    if fail:
        mock_token_response.status_code = 400
        mock_token_response.raise_for_status.side_effect = HTTPStatusError(
            "Bad Request",
            request=HttpxRequest("POST", "http://mock"),
            response=mock_token_response,
        )
    else:
        mock_token_response.status_code = 200
        mock_token_response.raise_for_status = MagicMock()
        mock_token_response.json.return_value = {"id_token": id_token_value}

    mock_client_instance = AsyncMock()
    mock_client_instance.post.return_value = mock_token_response
    mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_client_instance.__aexit__ = AsyncMock(return_value=False)
    return mock_client_instance


# ===================================================================
# GET /auth/google — OAuth redirect
# ===================================================================

class TestAuthGoogleRedirect:

    def test_google_auth_redirects(self, auth_client):
        """GET /auth/google returns a 307 redirect to Google's OAuth URL."""
        resp = auth_client.get("/auth/google", follow_redirects=False)
        assert resp.status_code == 307
        location = resp.headers["location"]
        assert "accounts.google.com" in location
        assert "response_type=code" in location
        assert "scope=openid" in location


# ===================================================================
# GET /auth/google/callback — OAuth callback
# ===================================================================

class TestAuthGoogleCallback:

    @patch("oauth_providers.httpx.AsyncClient")
    @patch("oauth_providers.google_id_token")
    def test_google_callback_creates_session(
        self, mock_id_token, mock_async_client, auth_client, fake_session_redis, db_session,
    ):
        """
        Valid Google token for a new user: creates user in DB,
        creates Redis session, redirects with cookie.
        """
        mock_async_client.return_value = _mock_httpx_token_exchange()
        mock_id_token.verify_oauth2_token.return_value = {
            "sub": "google-new-user-99",
            "email": "newgoogle@gmail.com",
            "name": "New Google User",
            "email_verified": True,
        }

        resp = auth_client.get(
            "/auth/google/callback", params={"code": "test-auth-code"},
            follow_redirects=False,
        )

        assert resp.status_code == 307
        assert "/generate" in resp.headers["location"]
        assert "fitd_session_data" in resp.cookies

        # User was created in the DB
        user = db_session.query(User).filter(User.user_id == "google-new-user-99").first()
        assert user is not None
        assert user.email == "newgoogle@gmail.com"
        assert user.auth_provider == "google"

        # Session was stored in Redis
        assert len(fake_session_redis.store) == 1

    @patch("oauth_providers.httpx.AsyncClient")
    @patch("oauth_providers.google_id_token")
    def test_google_callback_existing_user(
        self, mock_id_token, mock_async_client, auth_client, fake_session_redis, db_session,
    ):
        """
        Valid Google token for an existing user: no duplicate user created,
        session still created.
        """
        from fitd_schemas.fitd_db_schemas import UserOAuthAccount
        _seed_google_user(db_session, user_id="google-sub-123", email="existing@gmail.com", username="existinguser")
        # Also seed an OAuth link so the lookup finds the existing user
        db_session.add(UserOAuthAccount(
            user_id="google-sub-123",
            provider="google",
            provider_user_id="google-sub-123",
            provider_email="existing@gmail.com",
        ))
        db_session.commit()

        mock_async_client.return_value = _mock_httpx_token_exchange()
        mock_id_token.verify_oauth2_token.return_value = {
            "sub": "google-sub-123",
            "email": "existing@gmail.com",
            "name": "existinguser",
            "email_verified": True,
        }

        resp = auth_client.get(
            "/auth/google/callback", params={"code": "test-auth-code"},
            follow_redirects=False,
        )

        assert resp.status_code == 307
        assert "fitd_session_data" in resp.cookies

        # Still only one user in the DB
        users = db_session.query(User).all()
        assert len(users) == 1

    @patch("oauth_providers.httpx.AsyncClient")
    @patch("oauth_providers.google_id_token")
    def test_google_callback_invalid_token(
        self, mock_id_token, mock_async_client, auth_client,
    ):
        """If Google token verification fails, return 400."""
        mock_async_client.return_value = _mock_httpx_token_exchange()
        mock_id_token.verify_oauth2_token.side_effect = ValueError("Invalid token")

        resp = auth_client.get(
            "/auth/google/callback", params={"code": "bad-code"},
            follow_redirects=False,
        )

        assert resp.status_code == 400
        assert "Invalid or expired google token" in resp.json()["detail"]

    @patch("oauth_providers.httpx.AsyncClient")
    def test_google_callback_token_exchange_fails(self, mock_async_client, auth_client):
        """If the code-for-token HTTP exchange fails, return 400."""
        mock_async_client.return_value = _mock_httpx_token_exchange(fail=True)

        resp = auth_client.get(
            "/auth/google/callback", params={"code": "bad-code"},
            follow_redirects=False,
        )

        assert resp.status_code == 400
        assert "Failed to authenticate with google" in resp.json()["detail"]


# ===================================================================
# POST /auth/register — Email registration
# ===================================================================

class TestEmailRegister:

    def test_register_success(self, auth_client, fake_session_redis, db_session):
        """Valid registration creates user + session + cookie."""
        resp = auth_client.post("/auth/register", json={
            "username": "newuser",
            "email": "new@example.com",
            "password": "SecurePassword123",
        })

        assert resp.status_code == 200
        data = resp.json()
        assert "Registration successful" in data["message"]
        assert "user_id" in data
        assert "fitd_session_data" in resp.cookies

        # User exists in DB with hashed password
        user = db_session.query(User).filter(User.email == "new@example.com").first()
        assert user is not None
        assert user.username == "newuser"
        assert user.auth_provider == "email"
        assert user.password_hash is not None
        assert user.password_hash != "SecurePassword123"  # hashed, not plaintext

        # Session stored in Redis
        assert len(fake_session_redis.store) == 1

    def test_register_duplicate_email(self, auth_client, db_session):
        """Duplicate email returns 409."""
        _seed_email_user(db_session, email="dup@example.com", username="existing")

        resp = auth_client.post("/auth/register", json={
            "username": "different",
            "email": "dup@example.com",
            "password": "SecurePassword123",
        })

        assert resp.status_code == 409
        assert "already" in resp.json()["detail"].lower()

    def test_register_duplicate_username(self, auth_client, db_session):
        """Duplicate username returns 409."""
        _seed_email_user(db_session, email="unique@example.com", username="takenname")

        resp = auth_client.post("/auth/register", json={
            "username": "takenname",
            "email": "other@example.com",
            "password": "SecurePassword123",
        })

        assert resp.status_code == 409
        assert "already" in resp.json()["detail"].lower()

    def test_register_missing_fields(self, auth_client):
        """Missing required fields returns 422."""
        resp = auth_client.post("/auth/register", json={
            "email": "test@example.com",
        })
        assert resp.status_code == 422

    def test_register_invalid_email(self, auth_client):
        """Invalid email format returns 422."""
        resp = auth_client.post("/auth/register", json={
            "username": "valid",
            "email": "not-an-email",
            "password": "SecurePassword123",
        })
        assert resp.status_code == 422


# ===================================================================
# POST /auth/login — Email login
# ===================================================================

class TestEmailLogin:

    def test_login_success(self, auth_client, fake_session_redis, db_session):
        """Valid credentials return 200 with session cookie."""
        _seed_email_user(db_session)

        resp = auth_client.post("/auth/login", json={
            "email": "user@example.com",
            "password": "SecurePassword123",
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "Login successful"
        assert data["user_id"] == "email-user-001"
        assert "fitd_session_data" in resp.cookies

        # Session stored in Redis
        assert len(fake_session_redis.store) == 1

    def test_login_wrong_password(self, auth_client, db_session):
        """Wrong password returns 401."""
        _seed_email_user(db_session)

        resp = auth_client.post("/auth/login", json={
            "email": "user@example.com",
            "password": "wrongpassword1",
        })

        assert resp.status_code == 401
        assert "Invalid email or password" in resp.json()["detail"]

    def test_login_user_not_found(self, auth_client):
        """Nonexistent email returns 401."""
        resp = auth_client.post("/auth/login", json={
            "email": "nobody@example.com",
            "password": "somepassword1",
        })

        assert resp.status_code == 401
        assert "Invalid email or password" in resp.json()["detail"]

    def test_login_google_user_no_password(self, auth_client, db_session):
        """Google-only user trying email login returns 400."""
        _seed_google_user(db_session)

        resp = auth_client.post("/auth/login", json={
            "email": "guser@gmail.com",
            "password": "SecurePassword123",
        })

        assert resp.status_code == 400
        assert "google sign-in" in resp.json()["detail"].lower()

    def test_login_missing_fields(self, auth_client):
        """Missing password returns 422."""
        resp = auth_client.post("/auth/login", json={
            "email": "user@example.com",
        })
        assert resp.status_code == 422

    def test_login_invalid_email(self, auth_client):
        """Invalid email format returns 422."""
        resp = auth_client.post("/auth/login", json={
            "email": "bad-email",
            "password": "SecurePassword123",
        })
        assert resp.status_code == 422


# ===================================================================
# GET /logout — Session destruction
# ===================================================================

class TestLogout:

    def test_logout_clears_session(self, auth_client, fake_session_redis, db_session):
        """
        Logout deletes the Redis session, clears the cookie, returns user info.
        We first register to get a valid session, then logout.
        """
        # Register to get a session
        reg_resp = auth_client.post("/auth/register", json={
            "username": "logoutuser",
            "email": "logout@example.com",
            "password": "SecurePassword123",
        })
        assert reg_resp.status_code == 200
        session_cookie = reg_resp.cookies.get("fitd_session_data")
        assert session_cookie is not None
        assert len(fake_session_redis.store) == 1

        # Now logout
        auth_client.cookies.set("fitd_session_data", session_cookie)
        resp = auth_client.get("/logout")

        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "Logged out"
        assert data["user_info"]["user_id"] is not None

        # Session was deleted from Redis
        assert len(fake_session_redis.store) == 0

    def test_logout_no_cookie(self, auth_client):
        """Logout without a session cookie returns 401."""
        resp = auth_client.get("/logout")
        assert resp.status_code == 401


# ===================================================================
# Cookie-authenticated proxy endpoints
# ===================================================================

class TestCookieProxyEndpoints:
    """
    Tests for /session, /user_basket, /user_orders which depend on
    get_current_user. We override that dependency to return a test user.
    """

    @pytest.fixture(autouse=True)
    def _seed_and_override(self, setup_db, fake_session_redis, db_session):
        """Seed a user in DB and override get_current_user to return them."""
        self.user = User(
            user_id="test-user-123",
            username="testuser",
            email="test@example.com",
            password_hash=None,
            auth_provider="google",
        )
        db_session.add(self.user)
        db_session.commit()
        db_session.refresh(self.user)

        # Store reference for assertions
        self._db_session = db_session
        self._user = self.user

    @pytest.fixture
    def proxy_client(self, setup_db, fake_session_redis):
        """Client with get_current_user overridden to return the seeded user."""
        user_ref = self._user

        async def _override_get_current_user():
            # Re-query within the override-db session to get an attached user
            db = TestingSessionLocal()
            try:
                u = db.query(User).filter(User.user_id == user_ref.user_id).first()
                return u
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_session_redis] = lambda: fake_session_redis
        app.dependency_overrides[get_redis] = lambda: None
        app.dependency_overrides[get_current_user] = _override_get_current_user
        with TestClient(app) as c:
            yield c
        app.dependency_overrides.clear()

    def test_session_endpoint(self, proxy_client):
        """GET /session returns a SlimSessionResponse."""
        resp = proxy_client.get("/session")
        assert resp.status_code == 200
        data = resp.json()
        assert data["user"]["user_id"] == "test-user-123"
        assert data["user"]["username"] == "testuser"
        assert "stripe_onboarded" in data
        assert "has_fulfiller_profile" in data

    def test_user_basket_endpoint(self, proxy_client):
        """GET /user_basket returns an empty list when no basket items."""
        resp = proxy_client.get("/user_basket")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_user_orders_endpoint(self, proxy_client):
        """GET /user_orders returns an empty list when no orders."""
        resp = proxy_client.get("/user_orders")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_user_details_endpoint(self, proxy_client):
        """GET /get_just_user_details returns basic user info."""
        resp = proxy_client.get("/get_just_user_details")
        assert resp.status_code == 200
        data = resp.json()
        assert data["user_id"] == "test-user-123"
        assert data["username"] == "testuser"
        assert data["email"] == "test@example.com"

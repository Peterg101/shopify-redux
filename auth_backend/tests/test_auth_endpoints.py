"""
Comprehensive endpoint tests for auth_backend/main.py.

Tests all 8 endpoints:
  - GET  /auth/google           (OAuth redirect)
  - GET  /auth/google/callback  (OAuth callback)
  - POST /auth/register         (email registration)
  - POST /auth/login            (email login)
  - GET  /logout                (session logout)
  - GET  /get_session           (protected — full user info)
  - GET  /get_just_user_details (protected — user details only)
  - GET  /health                (Redis health check)

All external dependencies (Redis, db_service API calls, Google OAuth) are
mocked so tests run entirely in-process with no network or Redis needed.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from httpx import Response, Request as HttpxRequest, HTTPStatusError
from fitd_schemas.fitd_classes import SessionData

# Import shared fixtures / constants from conftest
from conftest import (
    MOCK_USER_ID,
    MOCK_EMAIL,
    MOCK_USERNAME,
    MOCK_SESSION_ID,
    MOCK_SESSION_DATA,
    MOCK_USER_RESPONSE,
    MOCK_USER_DETAILS_RESPONSE,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_httpx_response(status_code: int, json_body: dict) -> Response:
    """Create a real httpx.Response for mocking api_calls that return raw responses."""
    resp = Response(
        status_code=status_code,
        json=json_body,
        request=HttpxRequest("POST", "http://mock"),
    )
    return resp


def _authenticated_cookies() -> dict:
    """Return cookies dict that simulates a logged-in session."""
    return {"fitd_session_data": MOCK_SESSION_ID}


# ===================================================================
# GET /health
# ===================================================================

class TestHealthEndpoint:
    """Tests for the /health Redis connectivity check."""

    def test_health_redis_connected(self, test_client):
        """When Redis is reachable, /health returns 200 with status ok."""
        with patch("main.redis_session") as mock_redis:
            mock_redis.ping = AsyncMock(return_value=True)
            resp = test_client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["redis"] == "connected"

    def test_health_redis_disconnected(self, test_client):
        """When Redis ping fails, /health returns 503."""
        with patch("main.redis_session") as mock_redis:
            mock_redis.ping = AsyncMock(side_effect=ConnectionError("Redis down"))
            resp = test_client.get("/health")
        assert resp.status_code == 503


# ===================================================================
# GET /auth/google
# ===================================================================

class TestAuthGoogle:
    """Tests for the Google OAuth initiation endpoint."""

    def test_auth_google_redirects(self, test_client):
        """GET /auth/google should return a redirect to Google's OAuth URL."""
        resp = test_client.get("/auth/google", follow_redirects=False)
        assert resp.status_code == 307
        location = resp.headers["location"]
        assert "accounts.google.com" in location
        assert "response_type=code" in location
        assert "scope=openid" in location


# ===================================================================
# GET /auth/google/callback
# ===================================================================

class TestAuthGoogleCallback:
    """Tests for the Google OAuth callback endpoint."""

    @patch("main.create_session", new_callable=AsyncMock)
    @patch("main.create_user", new_callable=AsyncMock)
    @patch("main.check_only_user_exists", new_callable=AsyncMock)
    @patch("main.id_token")
    @patch("main.httpx.AsyncClient")
    def test_callback_new_user(
        self, mock_async_client, mock_id_token, mock_check_user,
        mock_create_user, mock_create_session, test_client,
    ):
        """
        Valid OAuth callback for a new user: exchanges code, verifies token,
        creates user, creates session, redirects with cookie.
        """
        # Mock the token exchange HTTP call
        mock_token_response = MagicMock()
        mock_token_response.status_code = 200
        mock_token_response.raise_for_status = MagicMock()
        mock_token_response.json.return_value = {"id_token": "fake-id-token"}

        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_token_response
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        mock_async_client.return_value = mock_client_instance

        # Mock Google token verification
        mock_id_token.verify_oauth2_token.return_value = {
            "sub": MOCK_USER_ID,
            "email": MOCK_EMAIL,
            "name": MOCK_USERNAME,
        }

        # User does not exist yet
        mock_check_user.return_value = None
        mock_create_user.return_value = {"user_id": MOCK_USER_ID}
        mock_create_session.return_value = MOCK_SESSION_ID

        resp = test_client.get(
            "/auth/google/callback", params={"code": "test-auth-code"},
            follow_redirects=False,
        )

        assert resp.status_code == 307
        assert "/generate" in resp.headers["location"]
        assert "fitd_session_data" in resp.cookies
        mock_create_user.assert_called_once()
        mock_create_session.assert_called_once()

    @patch("main.create_session", new_callable=AsyncMock)
    @patch("main.check_only_user_exists", new_callable=AsyncMock)
    @patch("main.id_token")
    @patch("main.httpx.AsyncClient")
    def test_callback_existing_user(
        self, mock_async_client, mock_id_token, mock_check_user,
        mock_create_session, test_client,
    ):
        """
        Valid OAuth callback for an existing user: does NOT call create_user.
        """
        mock_token_response = MagicMock()
        mock_token_response.status_code = 200
        mock_token_response.raise_for_status = MagicMock()
        mock_token_response.json.return_value = {"id_token": "fake-id-token"}

        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_token_response
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        mock_async_client.return_value = mock_client_instance

        mock_id_token.verify_oauth2_token.return_value = {
            "sub": MOCK_USER_ID,
            "email": MOCK_EMAIL,
            "name": MOCK_USERNAME,
        }

        # User already exists
        mock_check_user.return_value = MOCK_USER_RESPONSE
        mock_create_session.return_value = MOCK_SESSION_ID

        with patch("main.create_user", new_callable=AsyncMock) as mock_create_user:
            resp = test_client.get(
                "/auth/google/callback", params={"code": "test-auth-code"},
                follow_redirects=False,
            )
            mock_create_user.assert_not_called()

        assert resp.status_code == 307
        assert "fitd_session_data" in resp.cookies

    @patch("main.id_token")
    @patch("main.httpx.AsyncClient")
    def test_callback_invalid_token(
        self, mock_async_client, mock_id_token, test_client,
    ):
        """If Google token verification fails, return 400."""
        mock_token_response = MagicMock()
        mock_token_response.status_code = 200
        mock_token_response.raise_for_status = MagicMock()
        mock_token_response.json.return_value = {"id_token": "bad-token"}

        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_token_response
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        mock_async_client.return_value = mock_client_instance

        # Token verification raises ValueError
        mock_id_token.verify_oauth2_token.side_effect = ValueError("Invalid token")

        resp = test_client.get(
            "/auth/google/callback", params={"code": "test-auth-code"},
            follow_redirects=False,
        )

        assert resp.status_code == 400
        assert "Invalid or expired Google token" in resp.json()["detail"]

    @patch("main.httpx.AsyncClient")
    def test_callback_missing_id_token_in_response(
        self, mock_async_client, test_client,
    ):
        """If the token exchange response has no id_token, return 400."""
        mock_token_response = MagicMock()
        mock_token_response.status_code = 200
        mock_token_response.raise_for_status = MagicMock()
        # Missing "id_token" key
        mock_token_response.json.return_value = {"access_token": "something"}

        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_token_response
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        mock_async_client.return_value = mock_client_instance

        resp = test_client.get(
            "/auth/google/callback", params={"code": "test-auth-code"},
            follow_redirects=False,
        )

        assert resp.status_code == 400
        assert "Missing id_token" in resp.json()["detail"]

    @patch("main.httpx.AsyncClient")
    def test_callback_token_exchange_fails(
        self, mock_async_client, test_client,
    ):
        """If the code-for-token exchange HTTP call fails, return 400."""
        mock_token_response = MagicMock()
        mock_token_response.status_code = 400
        mock_token_response.raise_for_status.side_effect = HTTPStatusError(
            "Bad Request",
            request=HttpxRequest("POST", "http://mock"),
            response=mock_token_response,
        )

        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_token_response
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        mock_async_client.return_value = mock_client_instance

        resp = test_client.get(
            "/auth/google/callback", params={"code": "bad-code"},
            follow_redirects=False,
        )

        assert resp.status_code == 400
        assert "Failed to retrieve token" in resp.json()["detail"]


# ===================================================================
# POST /auth/register
# ===================================================================

class TestEmailRegister:
    """Tests for the email registration endpoint."""

    @patch("main.create_session", new_callable=AsyncMock)
    @patch("main.register_email_user", new_callable=AsyncMock)
    def test_register_success(self, mock_register, mock_create_session, test_client):
        """Valid registration creates user and session, sets cookie."""
        mock_register.return_value = _make_httpx_response(
            200, {"user_id": MOCK_USER_ID, "username": MOCK_USERNAME}
        )
        mock_create_session.return_value = MOCK_SESSION_ID

        resp = test_client.post("/auth/register", json={
            "username": MOCK_USERNAME,
            "email": MOCK_EMAIL,
            "password": "securepassword123",
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "Registration successful"
        assert data["user_id"] == MOCK_USER_ID
        assert "fitd_session_data" in resp.cookies
        mock_register.assert_called_once()
        mock_create_session.assert_called_once()

    @patch("main.register_email_user", new_callable=AsyncMock)
    def test_register_duplicate_email(self, mock_register, test_client):
        """Registration with an existing email returns 409."""
        mock_register.return_value = _make_httpx_response(
            409, {"detail": "Email already registered"}
        )

        resp = test_client.post("/auth/register", json={
            "username": MOCK_USERNAME,
            "email": MOCK_EMAIL,
            "password": "securepassword123",
        })

        assert resp.status_code == 409
        assert "Already exists" in resp.json()["detail"] or "already" in resp.json()["detail"].lower()

    @patch("main.register_email_user", new_callable=AsyncMock)
    def test_register_db_service_error(self, mock_register, test_client):
        """When db_service returns a non-200/non-409 status, return 500."""
        mock_register.return_value = _make_httpx_response(
            500, {"detail": "Internal server error"}
        )

        resp = test_client.post("/auth/register", json={
            "username": MOCK_USERNAME,
            "email": MOCK_EMAIL,
            "password": "securepassword123",
        })

        assert resp.status_code == 500
        assert "Registration failed" in resp.json()["detail"]

    def test_register_missing_fields(self, test_client):
        """Missing required fields should return 422 validation error."""
        resp = test_client.post("/auth/register", json={
            "email": MOCK_EMAIL,
            # missing username and password
        })
        assert resp.status_code == 422

    def test_register_invalid_email_format(self, test_client):
        """Invalid email format should return 422 validation error."""
        resp = test_client.post("/auth/register", json={
            "username": MOCK_USERNAME,
            "email": "not-an-email",
            "password": "securepassword123",
        })
        assert resp.status_code == 422

    def test_register_password_too_short(self, test_client):
        """Password under 8 characters should return 422 validation error."""
        resp = test_client.post("/auth/register", json={
            "username": MOCK_USERNAME,
            "email": MOCK_EMAIL,
            "password": "short",
        })
        assert resp.status_code == 422

    def test_register_username_too_short(self, test_client):
        """Username under 2 characters should return 422 validation error."""
        resp = test_client.post("/auth/register", json={
            "username": "A",
            "email": MOCK_EMAIL,
            "password": "securepassword123",
        })
        assert resp.status_code == 422


# ===================================================================
# POST /auth/login
# ===================================================================

class TestEmailLogin:
    """Tests for the email login endpoint."""

    @patch("main.create_session", new_callable=AsyncMock)
    @patch("main.verify_user_password", new_callable=AsyncMock)
    def test_login_success(self, mock_verify, mock_create_session, test_client):
        """Valid credentials return 200 with session cookie."""
        mock_verify.return_value = {"verified": True, "user_id": MOCK_USER_ID}
        mock_create_session.return_value = MOCK_SESSION_ID

        resp = test_client.post("/auth/login", json={
            "email": MOCK_EMAIL,
            "password": "securepassword123",
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "Login successful"
        assert data["user_id"] == MOCK_USER_ID
        assert "fitd_session_data" in resp.cookies

    @patch("main.verify_user_password", new_callable=AsyncMock)
    def test_login_wrong_password(self, mock_verify, test_client):
        """Wrong password (verified=False) returns 401."""
        mock_verify.return_value = {"verified": False, "user_id": MOCK_USER_ID}

        resp = test_client.post("/auth/login", json={
            "email": MOCK_EMAIL,
            "password": "wrongpassword1",
        })

        assert resp.status_code == 401
        assert "Invalid email or password" in resp.json()["detail"]

    @patch("main.verify_user_password", new_callable=AsyncMock)
    def test_login_user_not_found(self, mock_verify, test_client):
        """Non-existent user (404 from db_service) returns 401."""
        error_response = _make_httpx_response(404, {"detail": "User not found"})
        mock_verify.side_effect = HTTPStatusError(
            "Not Found",
            request=HttpxRequest("POST", "http://mock"),
            response=error_response,
        )

        resp = test_client.post("/auth/login", json={
            "email": "nobody@example.com",
            "password": "somepassword1",
        })

        assert resp.status_code == 401
        assert "Invalid email or password" in resp.json()["detail"]

    @patch("main.verify_user_password", new_callable=AsyncMock)
    def test_login_google_user_attempts_email_login(self, mock_verify, test_client):
        """User with Google auth attempting email login returns 400."""
        error_response = _make_httpx_response(400, {"detail": "Google sign-in user"})
        mock_verify.side_effect = HTTPStatusError(
            "Bad Request",
            request=HttpxRequest("POST", "http://mock"),
            response=error_response,
        )

        resp = test_client.post("/auth/login", json={
            "email": MOCK_EMAIL,
            "password": "securepassword123",
        })

        assert resp.status_code == 400
        assert "Google sign-in" in resp.json()["detail"]

    @patch("main.verify_user_password", new_callable=AsyncMock)
    def test_login_db_service_error(self, mock_verify, test_client):
        """Unexpected db_service error returns 500."""
        error_response = _make_httpx_response(500, {"detail": "Internal error"})
        mock_verify.side_effect = HTTPStatusError(
            "Server Error",
            request=HttpxRequest("POST", "http://mock"),
            response=error_response,
        )

        resp = test_client.post("/auth/login", json={
            "email": MOCK_EMAIL,
            "password": "securepassword123",
        })

        assert resp.status_code == 500
        assert "Authentication service error" in resp.json()["detail"]

    def test_login_missing_fields(self, test_client):
        """Missing required fields should return 422."""
        resp = test_client.post("/auth/login", json={
            "email": MOCK_EMAIL,
            # missing password
        })
        assert resp.status_code == 422

    def test_login_invalid_email_format(self, test_client):
        """Invalid email format should return 422."""
        resp = test_client.post("/auth/login", json={
            "email": "bad-email",
            "password": "securepassword123",
        })
        assert resp.status_code == 422



# GET /get_session removed — replaced by GET /session (slim session endpoint)


# ===================================================================
# GET /get_just_user_details (protected)
# ===================================================================

class TestGetJustUserDetails:
    """Tests for the /get_just_user_details protected endpoint."""

    @patch("main.check_only_user_exists", new_callable=AsyncMock)
    @patch("main.cookie_verification", new_callable=AsyncMock)
    def test_get_user_details_success(self, mock_cookie, mock_check_only, test_client):
        """With a valid session, returns user details."""
        mock_cookie.return_value = (MOCK_SESSION_DATA, MOCK_SESSION_ID)
        mock_check_only.return_value = MOCK_USER_DETAILS_RESPONSE

        resp = test_client.get(
            "/get_just_user_details",
            cookies=_authenticated_cookies(),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["user_id"] == MOCK_USER_ID
        assert data["username"] == MOCK_USERNAME

    @patch("main.cookie_verification", new_callable=AsyncMock)
    def test_get_user_details_no_cookie(self, mock_cookie, test_client):
        """Without a session cookie, returns 401."""
        from fastapi import HTTPException
        mock_cookie.side_effect = HTTPException(status_code=401, detail="Not authenticated")

        resp = test_client.get("/get_just_user_details")

        assert resp.status_code == 401

    @patch("main.check_only_user_exists", new_callable=AsyncMock)
    @patch("main.cookie_verification", new_callable=AsyncMock)
    def test_get_user_details_user_not_in_db(self, mock_cookie, mock_check_only, test_client):
        """Valid session but user deleted from DB returns None."""
        mock_cookie.return_value = (MOCK_SESSION_DATA, MOCK_SESSION_ID)
        mock_check_only.return_value = None

        resp = test_client.get(
            "/get_just_user_details",
            cookies=_authenticated_cookies(),
        )

        assert resp.status_code == 200
        assert resp.json() is None


# ===================================================================
# GET /logout
# ===================================================================

class TestLogout:
    """Tests for the /logout endpoint."""

    @patch("main.delete_session", new_callable=AsyncMock)
    @patch("main.cookie_verification", new_callable=AsyncMock)
    def test_logout_success(self, mock_cookie, mock_delete, test_client):
        """Valid session logout: deletes session, returns success message."""
        mock_cookie.return_value = (MOCK_SESSION_DATA, MOCK_SESSION_ID)
        mock_delete.return_value = None

        resp = test_client.get(
            "/logout",
            cookies=_authenticated_cookies(),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "Logged out"
        assert data["user_info"]["user_id"] == MOCK_USER_ID
        mock_delete.assert_called_once()

    @patch("main.cookie_verification", new_callable=AsyncMock)
    def test_logout_no_cookie(self, mock_cookie, test_client):
        """Without a session cookie, returns 401."""
        from fastapi import HTTPException
        mock_cookie.side_effect = HTTPException(status_code=401, detail="Not authenticated")

        resp = test_client.get("/logout")

        assert resp.status_code == 401

    @patch("main.delete_session", new_callable=AsyncMock)
    @patch("main.cookie_verification", new_callable=AsyncMock)
    def test_logout_delete_session_called_with_correct_id(
        self, mock_cookie, mock_delete, test_client,
    ):
        """Verifies delete_session is called with the correct redis_session and session_id."""
        mock_cookie.return_value = (MOCK_SESSION_DATA, MOCK_SESSION_ID)
        mock_delete.return_value = None

        test_client.get("/logout", cookies=_authenticated_cookies())

        # delete_session is called with (redis_session, session_id)
        args = mock_delete.call_args
        assert args[0][1] == MOCK_SESSION_ID  # second positional arg is session_id

"""
Tests for mobile auth endpoints (/auth/mobile/*).

These endpoints return JWT access + refresh tokens instead of cookies.
"""
import bcrypt
from fitd_schemas.fitd_db_schemas import User


def _create_email_user(db_session, email="mobile@test.com", username="mobileuser", password="TestPass123!"):
    """Create a test user with email/password auth."""
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user = User(
        user_id="mobile-user-1",
        username=username,
        email=email,
        password_hash=hashed,
        auth_provider="email",
        email_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    return user


class TestMobileLogin:
    def test_login_success(self, client, db_session):
        _create_email_user(db_session)
        resp = client.post("/auth/mobile/login", json={
            "email": "mobile@test.com",
            "password": "TestPass123!",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert "refresh_token" in data
        assert data["user"]["user_id"] == "mobile-user-1"
        assert data["user"]["username"] == "mobileuser"
        assert data["user"]["email"] == "mobile@test.com"
        assert data["email_verified"] is True

    def test_login_wrong_password(self, client, db_session):
        _create_email_user(db_session)
        resp = client.post("/auth/mobile/login", json={
            "email": "mobile@test.com",
            "password": "WrongPassword",
        })
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client):
        resp = client.post("/auth/mobile/login", json={
            "email": "nobody@test.com",
            "password": "whatever",
        })
        assert resp.status_code == 401

    def test_login_oauth_only_user(self, client, db_session):
        """Users who signed up via OAuth have no password — mobile login should fail with helpful message."""
        user = User(
            user_id="oauth-user-1",
            username="oauthuser",
            email="oauth@test.com",
            password_hash=None,
            auth_provider="google",
        )
        db_session.add(user)
        db_session.commit()

        resp = client.post("/auth/mobile/login", json={
            "email": "oauth@test.com",
            "password": "anything",
        })
        assert resp.status_code == 400
        assert "google" in resp.json()["detail"].lower()


class TestMobileRegister:
    def test_register_success(self, client):
        resp = client.post("/auth/mobile/register", json={
            "username": "newmobile",
            "email": "new@test.com",
            "password": "TestPass123!",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert "refresh_token" in data
        assert data["user"]["username"] == "newmobile"
        assert data["email_verified"] is False

    def test_register_duplicate_email(self, client, db_session):
        _create_email_user(db_session)
        resp = client.post("/auth/mobile/register", json={
            "username": "other",
            "email": "mobile@test.com",
            "password": "TestPass123!",
        })
        assert resp.status_code == 409

    def test_register_duplicate_username(self, client, db_session):
        _create_email_user(db_session)
        resp = client.post("/auth/mobile/register", json={
            "username": "mobileuser",
            "email": "other@test.com",
            "password": "TestPass123!",
        })
        assert resp.status_code == 409


class TestMobileRefresh:
    def test_refresh_success(self, client, db_session):
        _create_email_user(db_session)
        # Login to get refresh token
        login_resp = client.post("/auth/mobile/login", json={
            "email": "mobile@test.com",
            "password": "TestPass123!",
        })
        refresh_token = login_resp.json()["refresh_token"]

        # Use refresh token to get new access token
        resp = client.post("/auth/mobile/refresh", json={
            "refresh_token": refresh_token,
        })
        assert resp.status_code == 200
        assert "token" in resp.json()

    def test_refresh_invalid_token(self, client):
        resp = client.post("/auth/mobile/refresh", json={
            "refresh_token": "invalid-token",
        })
        assert resp.status_code == 401

    def test_refresh_missing_token(self, client):
        resp = client.post("/auth/mobile/refresh", json={})
        assert resp.status_code == 400

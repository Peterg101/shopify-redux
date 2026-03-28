import pytest
import bcrypt


def _create_email_user(client, db_session):
    """Helper: create a user with a bcrypt password hash."""
    password = "securepassword123"
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    client.post(
        "/users/register",
        json={
            "user_id": "email-user-sec",
            "username": "secuser",
            "email": "secuser@example.com",
            "password_hash": password_hash,
            "auth_provider": "email",
        },
        headers={"Authorization": "Bearer fake"},
    )
    return password, password_hash


def test_verify_password_correct(client, seed_user, db_session):
    """verify_password returns verified: True for correct password."""
    password, _ = _create_email_user(client, db_session)

    response = client.post(
        "/auth/verify_password",
        json={"email": "secuser@example.com", "password": password},
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verified"] is True
    assert data["user_id"] == "email-user-sec"
    assert data["username"] == "secuser"
    assert data["email"] == "secuser@example.com"


def test_verify_password_wrong(client, seed_user, db_session):
    """verify_password returns verified: False for wrong password."""
    _create_email_user(client, db_session)

    response = client.post(
        "/auth/verify_password",
        json={"email": "secuser@example.com", "password": "wrongpassword"},
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verified"] is False


def test_verify_password_user_not_found(client, seed_user):
    """verify_password returns 404 for nonexistent user."""
    response = client.post(
        "/auth/verify_password",
        json={"email": "nobody@example.com", "password": "anything"},
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 404


def test_verify_password_no_password_set(client, seed_user):
    """verify_password returns 400 when user has no password hash (e.g. Google OAuth user)."""
    response = client.post(
        "/auth/verify_password",
        json={"email": "test@example.com", "password": "anything"},
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 400
    assert "No password set" in response.json()["detail"]


def test_get_user_by_email_no_password_hash(client, seed_user):
    """GET /users/by_email should NOT include password_hash in the response."""
    response = client.get(
        "/users/by_email/test@example.com",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "password_hash" not in data
    assert "user_id" in data
    assert "email" in data


def test_health_check(client):
    """GET /health returns ok status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"

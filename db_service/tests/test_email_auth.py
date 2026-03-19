import pytest


def test_register_user(client, seed_user):
    """Register a new email user successfully."""
    response = client.post(
        "/users/register",
        json={
            "user_id": "email-user-001",
            "username": "emailuser",
            "email": "emailuser@example.com",
            "password_hash": "$2b$12$hashedpasswordvalue",
            "auth_provider": "email",
        },
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["user_id"] == "email-user-001"
    assert data["username"] == "emailuser"
    assert data["email"] == "emailuser@example.com"


def test_register_duplicate_email_returns_409(client, seed_user):
    """Reject registration with an existing email."""
    response = client.post(
        "/users/register",
        json={
            "user_id": "dup-user-001",
            "username": "dupuser",
            "email": "test@example.com",  # already exists from seed_user
            "password_hash": "$2b$12$hashedpasswordvalue",
            "auth_provider": "email",
        },
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 409


def test_register_duplicate_username_returns_409(client, seed_user):
    """Reject registration with an existing username."""
    response = client.post(
        "/users/register",
        json={
            "user_id": "dup-user-002",
            "username": "testuser",  # already exists from seed_user
            "email": "unique@example.com",
            "password_hash": "$2b$12$hashedpasswordvalue",
            "auth_provider": "email",
        },
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 409


def test_get_user_by_email(client, seed_user):
    """Fetch user by email returns user data."""
    response = client.get(
        "/users/by_email/test@example.com",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == "test-user-123"
    assert data["email"] == "test@example.com"
    assert data["auth_provider"] == "google"


def test_get_user_by_email_not_found(client, seed_user):
    """Return 404 for nonexistent email."""
    response = client.get(
        "/users/by_email/nonexistent@example.com",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 404

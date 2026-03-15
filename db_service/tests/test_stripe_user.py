"""Tests for Stripe user account endpoints:
- GET  /user_onboarded_with_stripe/{user_id}
- POST /generate_user_stripe_account_in_db/{user_id}
"""

import pytest
from fitd_schemas.fitd_db_schemas import UserStripeAccount


# ── GET /user_onboarded_with_stripe/{user_id} ────────────────────────────


def test_stripe_onboarded_returns_204_when_no_account(client, seed_user):
    """Returns 204 No Content when user has no Stripe account."""
    response = client.get(
        "/user_onboarded_with_stripe/test-user-123",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 204
    # 204 responses have no body
    assert response.content == b""


def test_stripe_onboarded_returns_account_info(client, seed_user, db_session):
    """Returns Stripe account details when account exists."""
    # Seed a Stripe account record
    stripe_account = UserStripeAccount(
        user_id="test-user-123",
        stripe_account_id="acct_test_123",
        onboarding_complete=True,
    )
    db_session.add(stripe_account)
    db_session.commit()

    response = client.get(
        "/user_onboarded_with_stripe/test-user-123",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["stripe_account_id"] == "acct_test_123"
    assert data["onboarding_complete"] is True


def test_stripe_onboarded_not_complete(client, seed_user, db_session):
    """Returns onboarding_complete=False when account exists but not onboarded."""
    stripe_account = UserStripeAccount(
        user_id="test-user-123",
        stripe_account_id="acct_test_456",
        onboarding_complete=False,
    )
    db_session.add(stripe_account)
    db_session.commit()

    response = client.get(
        "/user_onboarded_with_stripe/test-user-123",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["stripe_account_id"] == "acct_test_456"
    assert data["onboarding_complete"] is False


def test_stripe_onboarded_nonexistent_user(client):
    """Returns 204 when querying a user_id that has no Stripe account."""
    response = client.get(
        "/user_onboarded_with_stripe/nonexistent-user",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 204


# ── POST /generate_user_stripe_account_in_db/{user_id} ──────────────────


def test_generate_stripe_account_creates_record(client, seed_user, db_session):
    """Creates a new UserStripeAccount record."""
    response = client.post(
        "/generate_user_stripe_account_in_db/test-user-123",
        json={"stripe_account_id": "acct_new_789"},
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Stripe account created"
    assert data["user_id"] == "test-user-123"
    assert data["stripe_account_id"] == "acct_new_789"

    # Verify in DB
    record = db_session.query(UserStripeAccount).filter_by(user_id="test-user-123").first()
    assert record is not None
    assert record.stripe_account_id == "acct_new_789"
    assert record.onboarding_complete is False


def test_generate_stripe_account_updates_existing(client, seed_user, db_session):
    """Updates the stripe_account_id when a record already exists for the user."""
    # Create initial record
    existing = UserStripeAccount(
        user_id="test-user-123",
        stripe_account_id="acct_old_111",
        onboarding_complete=False,
    )
    db_session.add(existing)
    db_session.commit()

    response = client.post(
        "/generate_user_stripe_account_in_db/test-user-123",
        json={"stripe_account_id": "acct_updated_222"},
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Stripe account updated"

    # Verify the record was updated, not duplicated
    db_session.expire_all()
    records = db_session.query(UserStripeAccount).filter_by(user_id="test-user-123").all()
    assert len(records) == 1
    assert records[0].stripe_account_id == "acct_updated_222"


def test_generate_stripe_account_missing_stripe_id(client, seed_user):
    """Returns 400 when stripe_account_id is missing from payload."""
    response = client.post(
        "/generate_user_stripe_account_in_db/test-user-123",
        json={},
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 400
    assert "Missing stripe_account_id" in response.json()["detail"]


def test_generate_stripe_account_empty_stripe_id(client, seed_user):
    """Returns 400 when stripe_account_id is an empty string."""
    response = client.post(
        "/generate_user_stripe_account_in_db/test-user-123",
        json={"stripe_account_id": ""},
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 400

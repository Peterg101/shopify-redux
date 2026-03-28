def test_generate_stripe_account_in_db(client, seed_user):
    response = client.post(
        "/generate_user_stripe_account_in_db/test-user-123",
        json={"stripe_account_id": "acct_test_123"},
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Stripe account created"


def test_generate_stripe_account_update_existing(client, seed_user):
    client.post(
        "/generate_user_stripe_account_in_db/test-user-123",
        json={"stripe_account_id": "acct_test_123"},
        headers={"Authorization": "Bearer fake"},
    )
    response = client.post(
        "/generate_user_stripe_account_in_db/test-user-123",
        json={"stripe_account_id": "acct_test_456"},
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Stripe account updated"


def test_check_user_onboarded_no_account(client, seed_user):
    response = client.get(
        "/user_onboarded_with_stripe/test-user-123",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 204


def test_check_user_onboarded_with_account(client, seed_user):
    client.post(
        "/generate_user_stripe_account_in_db/test-user-123",
        json={"stripe_account_id": "acct_test_123"},
        headers={"Authorization": "Bearer fake"},
    )
    response = client.get(
        "/user_onboarded_with_stripe/test-user-123",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["stripe_account_id"] == "acct_test_123"
    assert data["onboarding_complete"] is False


def test_confirm_onboarding(client, seed_user):
    client.post(
        "/generate_user_stripe_account_in_db/test-user-123",
        json={"stripe_account_id": "acct_test_123"},
        headers={"Authorization": "Bearer fake"},
    )
    response = client.post(
        "/stripe/confirm_onboarding/acct_test_123",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200

    # Verify it's now complete
    check = client.get(
        "/user_onboarded_with_stripe/test-user-123",
        headers={"Authorization": "Bearer fake"},
    )
    assert check.json()["onboarding_complete"] is True


def test_confirm_onboarding_not_found(client):
    response = client.post(
        "/stripe/confirm_onboarding/nonexistent",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 404


def test_user_hydration_includes_stripe_status(client, seed_user):
    # Without Stripe account
    response = client.get(
        "/users/test-user-123",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.json()["stripe_onboarded"] is False

    # With Stripe account (not complete)
    client.post(
        "/generate_user_stripe_account_in_db/test-user-123",
        json={"stripe_account_id": "acct_test_123"},
        headers={"Authorization": "Bearer fake"},
    )
    response = client.get(
        "/users/test-user-123",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.json()["stripe_onboarded"] is False

    # After confirming onboarding
    client.post(
        "/stripe/confirm_onboarding/acct_test_123",
        headers={"Authorization": "Bearer fake"},
    )
    response = client.get(
        "/users/test-user-123",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.json()["stripe_onboarded"] is True

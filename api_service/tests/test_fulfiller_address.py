def test_update_fulfiller_address(client, seed_user, db_session):
    """PUT /users/{user_id}/fulfiller_address stores address on UserStripeAccount."""
    from fitd_schemas.fitd_db_schemas import UserStripeAccount

    # Create a Stripe account record first
    stripe_account = UserStripeAccount(
        user_id="test-user-123",
        stripe_account_id="acct_test_addr",
        onboarding_complete=True,
    )
    db_session.add(stripe_account)
    db_session.commit()

    response = client.put(
        "/users/test-user-123/fulfiller_address",
        json={
            "name": "Test Fulfiller",
            "line1": "123 Print Street",
            "line2": "Unit 4",
            "city": "London",
            "postal_code": "E1 6AN",
            "country": "GB",
        },
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Fulfiller address updated"

    db_session.expire_all()
    updated = db_session.query(UserStripeAccount).filter(
        UserStripeAccount.user_id == "test-user-123"
    ).first()
    assert updated.address_name == "Test Fulfiller"
    assert updated.address_line1 == "123 Print Street"
    assert updated.address_line2 == "Unit 4"
    assert updated.address_city == "London"
    assert updated.address_postal_code == "E1 6AN"
    assert updated.address_country == "GB"


def test_get_fulfiller_address(client, seed_user, db_session):
    """GET /users/{user_id}/fulfiller_address returns stored address."""
    from fitd_schemas.fitd_db_schemas import UserStripeAccount

    stripe_account = UserStripeAccount(
        user_id="test-user-123",
        stripe_account_id="acct_test_get",
        onboarding_complete=True,
        address_name="Get Test",
        address_line1="456 Maker Lane",
        address_city="Bristol",
        address_postal_code="BS1 1AA",
        address_country="GB",
    )
    db_session.add(stripe_account)
    db_session.commit()

    response = client.get(
        "/users/test-user-123/fulfiller_address",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Get Test"
    assert data["line1"] == "456 Maker Lane"
    assert data["city"] == "Bristol"


def test_get_fulfiller_address_not_found(client, seed_user, db_session):
    """GET /users/{user_id}/fulfiller_address returns 404 if no address."""
    response = client.get(
        "/users/test-user-123/fulfiller_address",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 404


def test_update_fulfiller_address_unauthorized(client, seed_user, seed_claimant_user, db_session):
    """Cannot update another user's fulfiller address."""
    from fitd_schemas.fitd_db_schemas import UserStripeAccount

    stripe_account = UserStripeAccount(
        user_id="claimant-user-456",
        stripe_account_id="acct_test_unauth",
        onboarding_complete=True,
    )
    db_session.add(stripe_account)
    db_session.commit()

    # client is authenticated as test-user-123, trying to update claimant-user-456's address
    response = client.put(
        "/users/claimant-user-456/fulfiller_address",
        json={
            "name": "Hacker",
            "line1": "1 Evil St",
            "city": "Nowhere",
            "postal_code": "XX1 1XX",
            "country": "GB",
        },
    )
    assert response.status_code == 403


def test_update_fulfiller_address_no_stripe_account(client, seed_user):
    """Cannot update address without a Stripe account."""
    response = client.put(
        "/users/test-user-123/fulfiller_address",
        json={
            "name": "Test",
            "line1": "1 Test St",
            "city": "London",
            "postal_code": "E1 1AA",
            "country": "GB",
        },
    )
    assert response.status_code == 404
    assert "Stripe" in response.json()["detail"]

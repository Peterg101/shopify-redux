from unittest.mock import patch, AsyncMock
import pytest


@pytest.mark.asyncio
@patch("routes.onboard.check_user_stripe_onboarded", new_callable=AsyncMock)
@patch("routes.onboard.generate_stripe_account", new_callable=AsyncMock)
@patch("routes.onboard.generate_stripe_account_in_db", new_callable=AsyncMock)
@patch("routes.onboard.generate_account_link", new_callable=AsyncMock)
def test_onboard_new_user(mock_link, mock_db, mock_create, mock_check, client):
    mock_check.return_value = None
    mock_create.return_value = {"id": "acct_new_123"}
    mock_db.return_value = {"message": "created"}
    mock_link.return_value = {"onboarding_url": "https://connect.stripe.com/setup/e/test"}

    response = client.post("/stripe/onboard")
    assert response.status_code == 200
    data = response.json()
    assert "onboarding_url" in data


@pytest.mark.asyncio
@patch("routes.onboard.check_user_stripe_onboarded", new_callable=AsyncMock)
def test_onboard_existing_complete_user(mock_check, client):
    mock_check.return_value = {
        "stripe_account_id": "acct_existing",
        "onboarding_complete": True,
    }

    response = client.post("/stripe/onboard")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "User already onboarded"


@pytest.mark.asyncio
@patch("routes.onboard.check_user_stripe_onboarded", new_callable=AsyncMock)
@patch("routes.onboard.generate_account_link", new_callable=AsyncMock)
def test_onboard_existing_incomplete_user(mock_link, mock_check, client):
    mock_check.return_value = {
        "stripe_account_id": "acct_incomplete",
        "onboarding_complete": False,
    }
    mock_link.return_value = {"onboarding_url": "https://connect.stripe.com/setup/e/resume"}

    response = client.post("/stripe/onboard")
    assert response.status_code == 200
    data = response.json()
    assert "onboarding_url" in data

from unittest.mock import patch, AsyncMock, MagicMock
import pytest
from fastapi.testclient import TestClient
from main import app
from utils import validate_stripe_header


def make_account_updated_event(charges_enabled, payouts_enabled):
    return {
        "type": "account.updated",
        "data": {
            "object": {
                "id": "acct_test_123",
                "charges_enabled": charges_enabled,
                "payouts_enabled": payouts_enabled,
            }
        }
    }


async def override_validate_stripe_header_ready():
    return make_account_updated_event(True, True)


async def override_validate_stripe_header_not_ready():
    return make_account_updated_event(False, False)


@patch("routes.webhooks.httpx.AsyncClient")
def test_webhook_account_updated_ready(mock_client_class):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_async_client = AsyncMock()
    mock_async_client.post.return_value = mock_response
    mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
    mock_async_client.__aexit__ = AsyncMock(return_value=None)
    mock_client_class.return_value = mock_async_client

    app.dependency_overrides[validate_stripe_header] = override_validate_stripe_header_ready
    with TestClient(app) as client:
        response = client.post("/webhook/confirm_user_onboarded")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "onboarding_confirmed"


def test_webhook_account_updated_not_ready():
    app.dependency_overrides[validate_stripe_header] = override_validate_stripe_header_not_ready
    with TestClient(app) as client:
        response = client.post("/webhook/confirm_user_onboarded")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "event_received"

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


# ── Checkout completed webhook tests ──


def make_checkout_completed_event(payment_status="paid", user_id="test-user-123"):
    return {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_webhook_123",
                "payment_status": payment_status,
                "metadata": {"user_id": user_id},
            }
        }
    }


async def override_checkout_completed_paid():
    return make_checkout_completed_event("paid")


async def override_checkout_completed_unpaid():
    return make_checkout_completed_event("unpaid")


@patch("routes.webhooks.create_orders_from_checkout", new_callable=AsyncMock)
@patch("routes.webhooks.stripe")
def test_checkout_completed_creates_orders(mock_stripe, mock_create_orders):
    # Mock the Stripe session retrieve with expanded line items
    mock_product = MagicMock()
    mock_product.name = "Test Print"
    mock_product.metadata = {
        "task_id": "task-001",
        "user_id": "test-user-123",
        "material": "PLA",
        "technique": "FDM",
        "sizing": "1.0",
        "colour": "white",
        "selectedFile": "test.obj",
        "selectedFileType": "obj",
    }

    mock_price = MagicMock()
    mock_price.product = mock_product

    mock_line_item = MagicMock()
    mock_line_item.price = mock_price
    mock_line_item.amount_total = 1999
    mock_line_item.quantity = 2

    mock_address = MagicMock()
    mock_address.line1 = "42 Test Street"
    mock_address.line2 = "Flat 3"
    mock_address.city = "London"
    mock_address.postal_code = "E1 6AN"
    mock_address.country = "GB"

    mock_shipping = MagicMock()
    mock_shipping.name = "John Doe"
    mock_shipping.address = mock_address

    mock_session = MagicMock()
    mock_session.line_items.data = [mock_line_item]
    mock_session.shipping_details = mock_shipping
    mock_stripe.checkout.Session.retrieve.return_value = mock_session

    mock_create_orders.return_value = {"status": "success", "order_count": 1}

    app.dependency_overrides[validate_stripe_header] = override_checkout_completed_paid
    with TestClient(app) as client:
        response = client.post("/webhook/checkout_completed")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "orders_created"

    # Verify create_orders_from_checkout was called with correct payload
    call_args = mock_create_orders.call_args[0][0]
    assert call_args["stripe_checkout_session_id"] == "cs_test_webhook_123"
    assert call_args["user_id"] == "test-user-123"
    assert len(call_args["line_items"]) == 1
    assert call_args["line_items"][0]["price"] == 19.99

    # Verify shipping address was extracted
    assert call_args["shipping_address"] is not None
    assert call_args["shipping_address"]["name"] == "John Doe"
    assert call_args["shipping_address"]["line1"] == "42 Test Street"
    assert call_args["shipping_address"]["city"] == "London"


def test_checkout_completed_ignores_unpaid():
    app.dependency_overrides[validate_stripe_header] = override_checkout_completed_unpaid
    with TestClient(app) as client:
        response = client.post("/webhook/checkout_completed")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "not_paid"

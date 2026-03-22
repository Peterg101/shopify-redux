from unittest.mock import patch, AsyncMock, MagicMock, ANY
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


@patch("routes.webhooks.confirm_onboarding", new_callable=AsyncMock)
def test_webhook_account_updated_ready(mock_confirm):
    mock_confirm.return_value = {"message": "Onboarding confirmed"}

    app.dependency_overrides[validate_stripe_header] = override_validate_stripe_header_ready
    with TestClient(app) as client:
        response = client.post("/webhook")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "onboarding_confirmed"
    mock_confirm.assert_called_once_with(ANY, "acct_test_123")


def test_webhook_account_updated_not_ready():
    app.dependency_overrides[validate_stripe_header] = override_validate_stripe_header_not_ready
    with TestClient(app) as client:
        response = client.post("/webhook")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "event_received"


@patch("routes.webhooks.confirm_onboarding", new_callable=AsyncMock)
def test_webhook_account_updated_db_service_error(mock_confirm):
    """When confirm_onboarding returns None, should return error status."""
    mock_confirm.return_value = None

    app.dependency_overrides[validate_stripe_header] = override_validate_stripe_header_ready
    with TestClient(app) as client:
        response = client.post("/webhook")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "error"
    assert "failed" in data["detail"].lower()


# ── Checkout completed webhook tests ──


def make_checkout_completed_event(payment_status="paid", user_id="test-user-123", is_collaborative=False):
    return {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_webhook_123",
                "payment_status": payment_status,
                "payment_intent": "pi_test_123",
                "metadata": {"user_id": user_id, "is_collaborative": str(is_collaborative)},
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

    mock_pi = MagicMock()
    mock_pi.transfer_group = "tg_abc123"
    mock_stripe.PaymentIntent.retrieve.return_value = mock_pi

    mock_create_orders.return_value = {"status": "success", "order_count": 1}

    app.dependency_overrides[validate_stripe_header] = override_checkout_completed_paid
    with TestClient(app) as client:
        response = client.post("/webhook")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "orders_created"

    # call_args[0][0] is db_api, [0][1] is the payload
    call_args = mock_create_orders.call_args[0][1]
    assert call_args["stripe_checkout_session_id"] == "cs_test_webhook_123"
    assert call_args["user_id"] == "test-user-123"
    assert call_args["payment_intent"] == "pi_test_123"
    assert call_args["transfer_group"] == "tg_abc123"
    assert len(call_args["line_items"]) == 1
    assert call_args["line_items"][0]["price"] == 10.0

    assert call_args["shipping_address"] is not None
    assert call_args["shipping_address"]["name"] == "John Doe"
    assert call_args["shipping_address"]["line1"] == "42 Test Street"
    assert call_args["shipping_address"]["city"] == "London"
    assert call_args["is_collaborative"] is False


@patch("routes.webhooks.create_orders_from_checkout", new_callable=AsyncMock)
@patch("routes.webhooks.stripe")
def test_checkout_completed_community_order(mock_stripe, mock_create_orders):
    """Community checkout should pass is_collaborative=True to order creation."""
    mock_product = MagicMock()
    mock_product.name = "Community Part"
    mock_product.metadata = {
        "task_id": "task-comm", "user_id": "test-user-123",
        "material": "PLA", "technique": "FDM", "sizing": "1.0",
        "colour": "white", "selectedFile": "part.obj", "selectedFileType": "obj",
    }
    mock_price = MagicMock()
    mock_price.product = mock_product
    mock_line_item = MagicMock()
    mock_line_item.price = mock_price
    mock_line_item.amount_total = 1500
    mock_line_item.quantity = 1

    mock_session = MagicMock()
    mock_session.line_items.data = [mock_line_item]
    mock_session.shipping_details = None
    mock_stripe.checkout.Session.retrieve.return_value = mock_session

    mock_pi = MagicMock()
    mock_pi.transfer_group = "tg_comm123"
    mock_stripe.PaymentIntent.retrieve.return_value = mock_pi

    mock_create_orders.return_value = {"status": "success", "order_count": 1}

    async def override_community():
        return make_checkout_completed_event("paid", is_collaborative=True)

    app.dependency_overrides[validate_stripe_header] = override_community
    with TestClient(app) as client:
        response = client.post("/webhook")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    call_args = mock_create_orders.call_args[0][1]
    assert call_args["is_collaborative"] is True


def test_checkout_completed_ignores_unpaid():
    app.dependency_overrides[validate_stripe_header] = override_checkout_completed_unpaid
    with TestClient(app) as client:
        response = client.post("/webhook")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "not_paid"


def test_checkout_completed_missing_user_id_in_metadata():
    async def override_missing_user_id():
        return {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_no_user",
                    "payment_status": "paid",
                    "metadata": {},
                }
            }
        }

    app.dependency_overrides[validate_stripe_header] = override_missing_user_id
    with TestClient(app) as client:
        response = client.post("/webhook")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "error"
    assert "user_id" in data["detail"].lower()


def test_webhook_ignores_unknown_event():
    async def override_unknown():
        return {
            "type": "payment_intent.succeeded",
            "data": {"object": {"id": "pi_test_unrelated"}}
        }

    app.dependency_overrides[validate_stripe_header] = override_unknown
    with TestClient(app) as client:
        response = client.post("/webhook")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "event_ignored"


# ── New event handler tests ──


@patch("routes.webhooks.update_orders_by_payment_intent", new_callable=AsyncMock)
def test_webhook_payment_intent_failed(mock_update):
    mock_update.return_value = {"status": "updated", "count": 1}

    async def override():
        return {
            "type": "payment_intent.payment_failed",
            "data": {"object": {"id": "pi_failed_123"}}
        }

    app.dependency_overrides[validate_stripe_header] = override
    with TestClient(app) as client:
        response = client.post("/webhook")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "payment_failure_recorded"
    mock_update.assert_called_once_with(ANY, "pi_failed_123", "payment_failed")


@patch("routes.webhooks.freeze_disbursements_by_payment_intent", new_callable=AsyncMock)
def test_webhook_charge_dispute_created(mock_freeze):
    mock_freeze.return_value = {"status": "frozen", "count": 2}

    async def override():
        return {
            "type": "charge.dispute.created",
            "data": {"object": {"id": "dp_123", "payment_intent": "pi_disputed_456"}}
        }

    app.dependency_overrides[validate_stripe_header] = override
    with TestClient(app) as client:
        response = client.post("/webhook")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "disbursements_frozen"
    mock_freeze.assert_called_once_with(ANY, "pi_disputed_456")


@patch("routes.webhooks.update_orders_by_payment_intent", new_callable=AsyncMock)
def test_webhook_charge_refunded(mock_update):
    mock_update.return_value = {"status": "updated", "count": 1}

    async def override():
        return {
            "type": "charge.refunded",
            "data": {"object": {"id": "ch_123", "payment_intent": "pi_refunded_789"}}
        }

    app.dependency_overrides[validate_stripe_header] = override
    with TestClient(app) as client:
        response = client.post("/webhook")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "refund_recorded"
    mock_update.assert_called_once_with(ANY, "pi_refunded_789", "refunded")

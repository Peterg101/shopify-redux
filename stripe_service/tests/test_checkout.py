from unittest.mock import patch, AsyncMock, MagicMock
import pytest


@pytest.mark.asyncio
@patch("routes.checkout.get_all_basket_items", new_callable=AsyncMock)
@patch("routes.checkout.stripe")
def test_checkout_creates_session(mock_stripe, mock_basket, client):
    mock_basket.return_value = [
        {
            "task_id": "task-001",
            "user_id": "test-user-123",
            "name": "Test Print",
            "material": "PLA",
            "technique": "FDM",
            "sizing": 1.0,
            "colour": "white",
            "selectedFile": "test.obj",
            "selectedFileType": "obj",
            "price": 19.99,
            "quantity": 2,
        }
    ]

    mock_session = MagicMock()
    mock_session.url = "https://checkout.stripe.com/pay/cs_test_123"
    mock_stripe.checkout.Session.create.return_value = mock_session

    response = client.post("/stripe/checkout")
    assert response.status_code == 200
    data = response.json()
    assert data["checkout_url"] == "https://checkout.stripe.com/pay/cs_test_123"

    # Verify Stripe was called with correct unit_amount (pence)
    call_kwargs = mock_stripe.checkout.Session.create.call_args[1]
    assert call_kwargs["line_items"][0]["price_data"]["unit_amount"] == 1999
    assert call_kwargs["line_items"][0]["quantity"] == 2
    assert call_kwargs["mode"] == "payment"


@pytest.mark.asyncio
@patch("routes.checkout.get_all_basket_items", new_callable=AsyncMock)
def test_checkout_empty_basket_400(mock_basket, client):
    mock_basket.return_value = []

    response = client.post("/stripe/checkout")
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


@pytest.mark.asyncio
@patch("routes.checkout.get_all_basket_items", new_callable=AsyncMock)
@patch("routes.checkout.stripe")
def test_checkout_price_conversion(mock_stripe, mock_basket, client):
    """Verify that price 19.99 converts to unit_amount 1999 (pence)."""
    mock_basket.return_value = [
        {
            "task_id": "task-002",
            "user_id": "test-user-123",
            "name": "Price Test",
            "material": "PETG",
            "technique": "FDM",
            "sizing": 0.5,
            "colour": "red",
            "selectedFile": "model.obj",
            "selectedFileType": "obj",
            "price": 19.99,
            "quantity": 1,
        }
    ]

    mock_session = MagicMock()
    mock_session.url = "https://checkout.stripe.com/pay/cs_test_price"
    mock_stripe.checkout.Session.create.return_value = mock_session

    response = client.post("/stripe/checkout")
    assert response.status_code == 200

    call_kwargs = mock_stripe.checkout.Session.create.call_args[1]
    assert call_kwargs["line_items"][0]["price_data"]["unit_amount"] == 1999
    assert call_kwargs["line_items"][0]["price_data"]["currency"] == "gbp"


@pytest.mark.asyncio
@patch("routes.checkout.get_all_basket_items", new_callable=AsyncMock)
@patch("routes.checkout.stripe")
def test_checkout_includes_shipping_collection(mock_stripe, mock_basket, client):
    """Verify shipping_address_collection is set on checkout session."""
    mock_basket.return_value = [
        {
            "task_id": "task-003",
            "user_id": "test-user-123",
            "name": "Ship Test",
            "material": "PLA",
            "technique": "FDM",
            "sizing": 1.0,
            "colour": "green",
            "selectedFile": "test.obj",
            "selectedFileType": "obj",
            "price": 10.0,
            "quantity": 1,
        }
    ]

    mock_session = MagicMock()
    mock_session.url = "https://checkout.stripe.com/pay/cs_test_ship"
    mock_stripe.checkout.Session.create.return_value = mock_session

    response = client.post("/stripe/checkout")
    assert response.status_code == 200

    call_kwargs = mock_stripe.checkout.Session.create.call_args[1]
    assert "shipping_address_collection" in call_kwargs
    assert call_kwargs["shipping_address_collection"]["allowed_countries"] == ["GB"]

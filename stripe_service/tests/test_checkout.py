from unittest.mock import patch, AsyncMock, MagicMock



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
    assert response.status_code == 201
    data = response.json()
    assert data["checkout_url"] == "https://checkout.stripe.com/pay/cs_test_123"

    # Verify Stripe was called with correct unit_amount (pence)
    call_kwargs = mock_stripe.checkout.Session.create.call_args[1]
    assert call_kwargs["line_items"][0]["price_data"]["unit_amount"] == 1999
    assert call_kwargs["line_items"][0]["quantity"] == 2
    assert call_kwargs["mode"] == "payment"

    # Verify payment_intent_data includes transfer_group
    assert "payment_intent_data" in call_kwargs
    assert call_kwargs["payment_intent_data"]["transfer_group"].startswith("tg_")



@patch("routes.checkout.get_all_basket_items", new_callable=AsyncMock)
def test_checkout_empty_basket_400(mock_basket, client):
    mock_basket.return_value = []

    response = client.post("/stripe/checkout")
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()



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
    assert response.status_code == 201

    call_kwargs = mock_stripe.checkout.Session.create.call_args[1]
    assert call_kwargs["line_items"][0]["price_data"]["unit_amount"] == 1999
    assert call_kwargs["line_items"][0]["price_data"]["currency"] == "gbp"



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
    assert response.status_code == 201

    call_kwargs = mock_stripe.checkout.Session.create.call_args[1]
    assert "shipping_address_collection" in call_kwargs
    assert call_kwargs["shipping_address_collection"]["allowed_countries"] == ["GB"]


# ── Additional edge case tests ──


@patch("routes.checkout.get_all_basket_items", new_callable=AsyncMock)
@patch("routes.checkout.stripe")
def test_checkout_multiple_items(mock_stripe, mock_basket, client):
    """Multiple items in basket should produce multiple line_items in Stripe call."""
    mock_basket.return_value = [
        {
            "task_id": "task-multi-1",
            "user_id": "test-user-123",
            "name": "Part A",
            "material": "PLA",
            "technique": "FDM",
            "sizing": 1.0,
            "colour": "white",
            "selectedFile": "partA.obj",
            "selectedFileType": "obj",
            "price": 10.00,
            "quantity": 1,
        },
        {
            "task_id": "task-multi-2",
            "user_id": "test-user-123",
            "name": "Part B",
            "material": "PETG",
            "technique": "SLA",
            "sizing": 0.5,
            "colour": "black",
            "selectedFile": "partB.stl",
            "selectedFileType": "stl",
            "price": 25.50,
            "quantity": 3,
        },
        {
            "task_id": "task-multi-3",
            "user_id": "test-user-123",
            "name": "Part C",
            "material": "Nylon",
            "technique": "SLS",
            "sizing": 2.0,
            "colour": "grey",
            "selectedFile": "partC.step",
            "selectedFileType": "step",
            "price": 99.99,
            "quantity": 1,
        },
    ]

    mock_session = MagicMock()
    mock_session.url = "https://checkout.stripe.com/pay/cs_test_multi"
    mock_stripe.checkout.Session.create.return_value = mock_session

    response = client.post("/stripe/checkout")
    assert response.status_code == 201

    call_kwargs = mock_stripe.checkout.Session.create.call_args[1]
    line_items = call_kwargs["line_items"]
    assert len(line_items) == 3

    # Verify each item's unit_amount and quantity
    assert line_items[0]["price_data"]["unit_amount"] == 1000
    assert line_items[0]["quantity"] == 1
    assert line_items[1]["price_data"]["unit_amount"] == 2550
    assert line_items[1]["quantity"] == 3
    assert line_items[2]["price_data"]["unit_amount"] == 9999
    assert line_items[2]["quantity"] == 1

    # Verify product names match
    assert line_items[0]["price_data"]["product_data"]["name"] == "Part A"
    assert line_items[1]["price_data"]["product_data"]["name"] == "Part B"
    assert line_items[2]["price_data"]["product_data"]["name"] == "Part C"


@patch("routes.checkout.get_all_basket_items", new_callable=AsyncMock)
@patch("routes.checkout.stripe")
def test_checkout_zero_price_item(mock_stripe, mock_basket, client):
    """An item with price 0.00 should produce unit_amount 0."""
    mock_basket.return_value = [
        {
            "task_id": "task-free",
            "user_id": "test-user-123",
            "name": "Free Sample",
            "material": "PLA",
            "technique": "FDM",
            "sizing": 1.0,
            "colour": "white",
            "selectedFile": "sample.obj",
            "selectedFileType": "obj",
            "price": 0.00,
            "quantity": 1,
        }
    ]

    mock_session = MagicMock()
    mock_session.url = "https://checkout.stripe.com/pay/cs_test_free"
    mock_stripe.checkout.Session.create.return_value = mock_session

    response = client.post("/stripe/checkout")
    assert response.status_code == 201

    call_kwargs = mock_stripe.checkout.Session.create.call_args[1]
    assert call_kwargs["line_items"][0]["price_data"]["unit_amount"] == 0


@patch("routes.checkout.get_all_basket_items", new_callable=AsyncMock)
@patch("routes.checkout.stripe")
def test_checkout_metadata_includes_manufacturing_fields(mock_stripe, mock_basket, client):
    """Verify product metadata includes material, technique, sizing, colour, and CAD-specific fields."""
    mock_basket.return_value = [
        {
            "task_id": "task-meta",
            "user_id": "test-user-123",
            "name": "CAD Part",
            "material": "Aluminium 6061",
            "technique": "CNC",
            "sizing": 1.5,
            "colour": "natural",
            "selectedFile": "bracket.step",
            "selectedFileType": "step",
            "price": 149.99,
            "quantity": 1,
            "process_id": "proc-cnc-001",
            "material_id": "mat-al6061",
            "tolerance_mm": 0.05,
            "surface_finish": "anodized",
        }
    ]

    mock_session = MagicMock()
    mock_session.url = "https://checkout.stripe.com/pay/cs_test_meta"
    mock_stripe.checkout.Session.create.return_value = mock_session

    response = client.post("/stripe/checkout")
    assert response.status_code == 201

    call_kwargs = mock_stripe.checkout.Session.create.call_args[1]
    metadata = call_kwargs["line_items"][0]["price_data"]["product_data"]["metadata"]

    # Core manufacturing fields
    assert metadata["task_id"] == "task-meta"
    assert metadata["material"] == "Aluminium 6061"
    assert metadata["technique"] == "CNC"
    assert metadata["sizing"] == "1.5"
    assert metadata["colour"] == "natural"
    assert metadata["selectedFile"] == "bracket.step"
    assert metadata["selectedFileType"] == "step"

    # CAD/STEP-specific manufacturing fields
    assert metadata["process_id"] == "proc-cnc-001"
    assert metadata["material_id"] == "mat-al6061"
    assert metadata["tolerance_mm"] == "0.05"
    assert metadata["surface_finish"] == "anodized"

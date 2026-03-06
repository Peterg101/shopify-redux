from unittest.mock import patch, AsyncMock, MagicMock



@patch("routes.shipping.update_claim_shipping", new_callable=AsyncMock)
@patch("routes.shipping.create_shipping_label", new_callable=AsyncMock)
@patch("routes.shipping.get_claim_detail", new_callable=AsyncMock)
@patch("routes.shipping.get_fulfiller_address", new_callable=AsyncMock)
def test_create_label_calls_shipengine(
    mock_fulfiller_addr, mock_claim_detail, mock_create_label, mock_update_shipping, client
):
    mock_claim_detail.return_value = {
        "claim_id": "claim-001",
        "claimant_user_id": "test-user-123",
        "status": "qa_check",
        "order_id": "order-001",
        "ship_to": {
            "name": "John Doe",
            "line1": "42 Test Street",
            "line2": None,
            "city": "London",
            "postal_code": "E1 6AN",
            "country": "GB",
        },
    }

    mock_fulfiller_addr.return_value = {
        "name": "Fulfiller Name",
        "line1": "123 Print Street",
        "line2": None,
        "city": "Manchester",
        "postal_code": "M1 1AA",
        "country": "GB",
    }

    mock_create_label.return_value = {
        "label_url": "https://api.shipengine.com/v1/labels/mock-label.pdf",
        "tracking_number": "TRACK123",
        "carrier_code": "evri",
        "shipment_id": "se-12345",
    }

    mock_update_shipping.return_value = {"message": "ok"}

    response = client.post("/shipping/create_label/claim-001")
    assert response.status_code == 200
    data = response.json()
    assert data["tracking_number"] == "TRACK123"
    assert data["label_url"] == "https://api.shipengine.com/v1/labels/mock-label.pdf"
    assert data["carrier_code"] == "evri"

    # Verify ShipEngine was called with correct addresses
    mock_create_label.assert_called_once()
    call_kwargs = mock_create_label.call_args[1]
    assert call_kwargs["ship_to"]["name"] == "John Doe"
    assert call_kwargs["ship_from"]["name"] == "Fulfiller Name"

    # Verify claim shipping was updated
    mock_update_shipping.assert_called_once()



@patch("routes.shipping.get_claim_detail", new_callable=AsyncMock)
@patch("routes.shipping.get_fulfiller_address", new_callable=AsyncMock)
def test_create_label_missing_fulfiller_address(mock_fulfiller_addr, mock_claim_detail, client):
    mock_claim_detail.return_value = {
        "claim_id": "claim-002",
        "claimant_user_id": "test-user-123",
        "status": "qa_check",
        "order_id": "order-002",
        "ship_to": {
            "name": "Buyer",
            "line1": "1 High St",
            "city": "London",
            "postal_code": "E1 1AA",
            "country": "GB",
        },
    }
    mock_fulfiller_addr.return_value = None

    response = client.post("/shipping/create_label/claim-002")
    assert response.status_code == 400
    assert "address" in response.json()["detail"].lower()



@patch("routes.shipping.get_claim_detail", new_callable=AsyncMock)
def test_create_label_missing_buyer_address(mock_claim_detail, client):
    mock_claim_detail.return_value = {
        "claim_id": "claim-003",
        "claimant_user_id": "test-user-123",
        "status": "qa_check",
        "order_id": "order-003",
        "ship_to": {
            "name": None,
            "line1": None,
            "city": None,
            "postal_code": None,
            "country": None,
        },
    }

    response = client.post("/shipping/create_label/claim-003")
    assert response.status_code == 400
    assert "shipping address" in response.json()["detail"].lower()

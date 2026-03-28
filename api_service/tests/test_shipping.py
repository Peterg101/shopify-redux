"""Tests for claim shipping endpoints:
- GET   /claims/{claim_id}/shipping_context
- PATCH /claims/{claim_id}/shipping
"""

import pytest
import uuid
from fitd_schemas.fitd_db_schemas import Claim, Order


def _seed_claim(db_session, seed_order):
    """Helper: create a claim in the DB and return it."""
    claim = Claim(
        id="claim-ship-001",
        order_id="order-001",
        claimant_user_id="test-user-123",
        quantity=2,
        status="printing",
    )
    db_session.add(claim)
    db_session.commit()
    db_session.refresh(claim)
    return claim


# ── GET /claims/{claim_id}/shipping_context ──────────────────────────────


def test_shipping_context_success(client, seed_order, db_session):
    """Returns claim + order shipping details."""
    # Add shipping address to the order
    order = db_session.query(Order).filter(Order.order_id == "order-001").first()
    order.shipping_name = "John Doe"
    order.shipping_line1 = "123 Test St"
    order.shipping_line2 = "Apt 4"
    order.shipping_city = "London"
    order.shipping_postal_code = "SW1A 1AA"
    order.shipping_country = "GB"
    db_session.commit()

    claim = _seed_claim(db_session, seed_order)

    response = client.get(
        f"/claims/{claim.id}/shipping_context",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["claim_id"] == "claim-ship-001"
    assert data["claimant_user_id"] == "test-user-123"
    assert data["status"] == "printing"
    assert data["order_id"] == "order-001"

    ship_to = data["ship_to"]
    assert ship_to["name"] == "John Doe"
    assert ship_to["line1"] == "123 Test St"
    assert ship_to["line2"] == "Apt 4"
    assert ship_to["city"] == "London"
    assert ship_to["postal_code"] == "SW1A 1AA"
    assert ship_to["country"] == "GB"


def test_shipping_context_no_shipping_address(client, seed_order, db_session):
    """Returns null shipping fields when order has no shipping address."""
    claim = _seed_claim(db_session, seed_order)

    response = client.get(
        f"/claims/{claim.id}/shipping_context",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["ship_to"]["name"] is None
    assert data["ship_to"]["line1"] is None


def test_shipping_context_claim_not_found(client, seed_user):
    """Returns 404 when claim does not exist."""
    response = client.get(
        "/claims/nonexistent-claim/shipping_context",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 404
    assert "Claim not found" in response.json()["detail"]


# ── PATCH /claims/{claim_id}/shipping ────────────────────────────────────


def test_update_shipping_success(client, seed_order, db_session):
    """Updates claim with shipping tracking info."""
    claim = _seed_claim(db_session, seed_order)

    response = client.patch(
        f"/claims/{claim.id}/shipping",
        json={
            "tracking_number": "1Z999AA10123456784",
            "label_url": "https://labels.example.com/label.pdf",
            "carrier_code": "ups",
            "shipment_id": "ship_abc123",
        },
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Shipping info updated"
    assert data["claim_id"] == "claim-ship-001"

    # Verify DB was updated
    db_session.expire_all()
    updated = db_session.query(Claim).filter(Claim.id == "claim-ship-001").first()
    assert updated.tracking_number == "1Z999AA10123456784"
    assert updated.label_url == "https://labels.example.com/label.pdf"
    assert updated.carrier_code == "ups"
    assert updated.shipment_id == "ship_abc123"


def test_update_shipping_overwrites_existing(client, seed_order, db_session):
    """Overwrites previously set shipping info."""
    claim = _seed_claim(db_session, seed_order)
    claim.tracking_number = "OLD_TRACKING"
    claim.carrier_code = "usps"
    db_session.commit()

    response = client.patch(
        f"/claims/{claim.id}/shipping",
        json={
            "tracking_number": "NEW_TRACKING_123",
            "label_url": "https://labels.example.com/new.pdf",
            "carrier_code": "fedex",
            "shipment_id": "ship_new_456",
        },
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200

    db_session.expire_all()
    updated = db_session.query(Claim).filter(Claim.id == "claim-ship-001").first()
    assert updated.tracking_number == "NEW_TRACKING_123"
    assert updated.carrier_code == "fedex"


def test_update_shipping_claim_not_found(client, seed_user):
    """Returns 404 when claim does not exist."""
    response = client.patch(
        "/claims/nonexistent-claim/shipping",
        json={
            "tracking_number": "1Z999AA10123456784",
            "label_url": "https://labels.example.com/label.pdf",
            "carrier_code": "ups",
            "shipment_id": "ship_abc123",
        },
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 404
    assert "Claim not found" in response.json()["detail"]

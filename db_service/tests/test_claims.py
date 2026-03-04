import pytest


def test_claim_order(claimant_client, seed_order, seed_claimant_user):
    response = claimant_client.post(
        "/claims/claim_order",
        json={"order_id": "order-001", "quantity": 2, "status": "pending"},
    )
    assert response.status_code == 200


def test_duplicate_claim_returns_409(claimant_client, seed_order, seed_claimant_user):
    claimant_client.post(
        "/claims/claim_order",
        json={"order_id": "order-001", "quantity": 2, "status": "pending"},
    )
    response = claimant_client.post(
        "/claims/claim_order",
        json={"order_id": "order-001", "quantity": 1, "status": "pending"},
    )
    assert response.status_code == 409


def test_claim_exceeds_quantity_returns_400(claimant_client, seed_order, seed_claimant_user):
    response = claimant_client.post(
        "/claims/claim_order",
        json={"order_id": "order-001", "quantity": 100, "status": "pending"},
    )
    assert response.status_code == 400


def test_update_claim_status_valid_transition(claimant_client, seed_order, seed_claimant_user, db_session):
    # Create a claim first
    claimant_client.post(
        "/claims/claim_order",
        json={"order_id": "order-001", "quantity": 2, "status": "pending"},
    )
    # Get the claim ID from DB
    from fitd_schemas.fitd_db_schemas import Claim
    claim = db_session.query(Claim).first()
    assert claim is not None

    # Transition pending -> in_progress
    response = claimant_client.patch(
        f"/claims/{claim.id}/status",
        json={"status": "in_progress"},
    )
    assert response.status_code == 200
    assert response.json()["new_status"] == "in_progress"


def test_update_claim_status_invalid_transition(claimant_client, seed_order, seed_claimant_user, db_session):
    claimant_client.post(
        "/claims/claim_order",
        json={"order_id": "order-001", "quantity": 2, "status": "pending"},
    )
    from fitd_schemas.fitd_db_schemas import Claim
    claim = db_session.query(Claim).first()

    # Try invalid transition: pending -> delivered
    response = claimant_client.patch(
        f"/claims/{claim.id}/status",
        json={"status": "delivered"},
    )
    assert response.status_code == 400


def test_update_claim_status_unauthorized(client, seed_order, db_session):
    # Insert a claim directly in the DB as a different user (claimant-user-456)
    from fitd_schemas.fitd_db_schemas import Claim
    import uuid

    claim = Claim(
        id=str(uuid.uuid4()),
        order_id="order-001",
        claimant_user_id="claimant-user-456",
        quantity=2,
        status="pending",
    )
    db_session.add(claim)
    db_session.commit()

    # Try to update as test-user-123 (the `client` fixture user) — should be 403
    response = client.patch(
        f"/claims/{claim.id}/status",
        json={"status": "in_progress"},
    )
    assert response.status_code == 403


def test_update_claim_status_not_found(claimant_client):
    response = claimant_client.patch(
        "/claims/nonexistent-id/status",
        json={"status": "in_progress"},
    )
    assert response.status_code == 404


def test_claim_accepted_creates_disbursement(claimant_client, seed_order, seed_claimant_user, db_session):
    """Full new lifecycle: pending -> in_progress -> printing -> shipped -> delivered -> accepted (buyer)."""
    from conftest import set_auth_as_buyer, set_auth_as_claimant

    # Fulfiller creates claim (auth is currently set to claimant via seed_order -> client)
    set_auth_as_claimant()
    claimant_client.post(
        "/claims/claim_order",
        json={"order_id": "order-001", "quantity": 2, "status": "pending"},
    )
    from fitd_schemas.fitd_db_schemas import Claim, Disbursement
    claim = db_session.query(Claim).first()

    # Fulfiller transitions through to delivered
    claimant_client.patch(f"/claims/{claim.id}/status", json={"status": "in_progress"})
    claimant_client.patch(f"/claims/{claim.id}/status", json={"status": "printing"})
    claimant_client.patch(f"/claims/{claim.id}/status", json={"status": "qa_check"})
    claimant_client.patch(f"/claims/{claim.id}/status", json={"status": "shipped"})
    claimant_client.patch(f"/claims/{claim.id}/status", json={"status": "delivered"})

    # Swap to buyer (test-user-123, who owns order-001) for acceptance
    set_auth_as_buyer()
    response = claimant_client.patch(f"/claims/{claim.id}/status", json={"status": "accepted"})
    assert response.status_code == 200

    db_session.expire_all()
    disbursement = db_session.query(Disbursement).filter(Disbursement.claim_id == claim.id).first()
    assert disbursement is not None
    assert disbursement.status == "pending"
    assert disbursement.amount_cents > 0


def test_claim_delivered_requires_buyer(claimant_client, seed_order, seed_claimant_user, db_session):
    """Fulfiller cannot accept their own delivered claim - only the buyer can."""
    from conftest import set_auth_as_claimant

    set_auth_as_claimant()
    claimant_client.post(
        "/claims/claim_order",
        json={"order_id": "order-001", "quantity": 2, "status": "pending"},
    )
    from fitd_schemas.fitd_db_schemas import Claim
    claim = db_session.query(Claim).first()

    claimant_client.patch(f"/claims/{claim.id}/status", json={"status": "in_progress"})
    claimant_client.patch(f"/claims/{claim.id}/status", json={"status": "printing"})
    claimant_client.patch(f"/claims/{claim.id}/status", json={"status": "qa_check"})
    claimant_client.patch(f"/claims/{claim.id}/status", json={"status": "shipped"})
    claimant_client.patch(f"/claims/{claim.id}/status", json={"status": "delivered"})

    # Fulfiller tries to accept - should be 403 (only buyer can accept)
    response = claimant_client.patch(f"/claims/{claim.id}/status", json={"status": "accepted"})
    assert response.status_code == 403


def test_update_claim_quantity(claimant_client, seed_order, seed_claimant_user, db_session):
    """Fulfiller can adjust quantity while claim is pending."""
    from conftest import set_auth_as_claimant

    set_auth_as_claimant()
    claimant_client.post(
        "/claims/claim_order",
        json={"order_id": "order-001", "quantity": 2, "status": "pending"},
    )
    from fitd_schemas.fitd_db_schemas import Claim
    claim = db_session.query(Claim).first()

    response = claimant_client.patch(
        f"/claims/{claim.id}/quantity",
        json={"quantity": 3},
    )
    assert response.status_code == 200
    assert response.json()["new_quantity"] == 3


def test_update_claim_quantity_invalid(claimant_client, seed_order, seed_claimant_user, db_session):
    """Cannot adjust quantity to 0 or exceed available."""
    from conftest import set_auth_as_claimant

    set_auth_as_claimant()
    claimant_client.post(
        "/claims/claim_order",
        json={"order_id": "order-001", "quantity": 2, "status": "pending"},
    )
    from fitd_schemas.fitd_db_schemas import Claim
    claim = db_session.query(Claim).first()

    # quantity <= 0
    response = claimant_client.patch(f"/claims/{claim.id}/quantity", json={"quantity": 0})
    assert response.status_code == 400

    # exceeds available
    response = claimant_client.patch(f"/claims/{claim.id}/quantity", json={"quantity": 100})
    assert response.status_code == 400


def test_update_claim_quantity_not_pending(claimant_client, seed_order, seed_claimant_user, db_session):
    """Cannot adjust quantity after claim moves past pending."""
    from conftest import set_auth_as_claimant

    set_auth_as_claimant()
    claimant_client.post(
        "/claims/claim_order",
        json={"order_id": "order-001", "quantity": 2, "status": "pending"},
    )
    from fitd_schemas.fitd_db_schemas import Claim
    claim = db_session.query(Claim).first()

    claimant_client.patch(f"/claims/{claim.id}/status", json={"status": "in_progress"})
    response = claimant_client.patch(f"/claims/{claim.id}/quantity", json={"quantity": 3})
    assert response.status_code == 400


def test_status_history_recorded(claimant_client, seed_order, seed_claimant_user, db_session):
    """Every status transition should create a ClaimStatusHistory entry."""
    claimant_client.post(
        "/claims/claim_order",
        json={"order_id": "order-001", "quantity": 2, "status": "pending"},
    )
    from fitd_schemas.fitd_db_schemas import Claim, ClaimStatusHistory
    claim = db_session.query(Claim).first()

    claimant_client.patch(f"/claims/{claim.id}/status", json={"status": "in_progress"})
    claimant_client.patch(f"/claims/{claim.id}/status", json={"status": "printing"})

    db_session.expire_all()
    history = db_session.query(ClaimStatusHistory).filter(
        ClaimStatusHistory.claim_id == claim.id
    ).all()
    assert len(history) == 2
    assert history[0].previous_status == "pending"
    assert history[0].new_status == "in_progress"
    assert history[1].previous_status == "in_progress"
    assert history[1].new_status == "printing"


def test_claim_shipping_update(client, seed_order, db_session):
    """PATCH /claims/{id}/shipping sets tracking_number, label_url, carrier_code."""
    from fitd_schemas.fitd_db_schemas import Claim
    import uuid

    claim = Claim(
        id="claim-ship-001",
        order_id="order-001",
        claimant_user_id="test-user-123",
        quantity=1,
        status="shipped",
    )
    db_session.add(claim)
    db_session.commit()

    response = client.patch(
        "/claims/claim-ship-001/shipping",
        json={
            "tracking_number": "TRACK123",
            "label_url": "https://labels.shipengine.com/test.pdf",
            "carrier_code": "evri",
            "shipment_id": "se-12345",
        },
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200

    db_session.expire_all()
    updated = db_session.query(Claim).filter(Claim.id == "claim-ship-001").first()
    assert updated.tracking_number == "TRACK123"
    assert updated.label_url == "https://labels.shipengine.com/test.pdf"
    assert updated.carrier_code == "evri"
    assert updated.shipment_id == "se-12345"


def test_claim_response_includes_shipping(claimant_client, seed_order, seed_claimant_user, db_session):
    """Claim responses include tracking_number, label_url, carrier_code."""
    from fitd_schemas.fitd_db_schemas import Claim

    claim = Claim(
        id="claim-ship-resp",
        order_id="order-001",
        claimant_user_id="claimant-user-456",
        quantity=1,
        status="shipped",
        tracking_number="TRACK789",
        label_url="https://labels.test/label.pdf",
        carrier_code="royal_mail",
    )
    db_session.add(claim)
    db_session.commit()

    # Check via order detail
    response = claimant_client.get("/orders/order-001/detail")
    assert response.status_code == 200
    claim_data = response.json()["claims"][0]
    assert claim_data["tracking_number"] == "TRACK789"
    assert claim_data["label_url"] == "https://labels.test/label.pdf"
    assert claim_data["carrier_code"] == "royal_mail"

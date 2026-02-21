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

    # Try invalid transition: pending -> completed
    response = claimant_client.patch(
        f"/claims/{claim.id}/status",
        json={"status": "completed"},
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


def test_claim_completed_creates_disbursement(claimant_client, seed_order, seed_claimant_user, db_session):
    # Create claim
    claimant_client.post(
        "/claims/claim_order",
        json={"order_id": "order-001", "quantity": 2, "status": "pending"},
    )
    from fitd_schemas.fitd_db_schemas import Claim, Disbursement
    claim = db_session.query(Claim).first()

    # Transition through: pending -> in_progress -> completed
    claimant_client.patch(f"/claims/{claim.id}/status", json={"status": "in_progress"})
    claimant_client.patch(f"/claims/{claim.id}/status", json={"status": "completed"})

    db_session.expire_all()
    disbursement = db_session.query(Disbursement).filter(Disbursement.claim_id == claim.id).first()
    assert disbursement is not None
    assert disbursement.status == "pending"
    assert disbursement.amount_cents > 0

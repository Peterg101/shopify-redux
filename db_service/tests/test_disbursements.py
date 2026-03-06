import pytest
from conftest import set_auth_as_buyer, set_auth_as_claimant


def _create_accepted_claim(claimant_client, db_session):
    """Helper: create a claim and advance it through to 'accepted' to trigger a disbursement."""
    set_auth_as_claimant()
    claimant_client.post(
        "/claims/claim_order",
        json={"order_id": "order-001", "quantity": 2, "status": "pending"},
    )
    from fitd_schemas.fitd_db_schemas import Claim
    claim = db_session.query(Claim).first()

    # Claimant advances through fulfillment stages
    for s in ["in_progress", "printing", "qa_check", "shipped", "delivered"]:
        claimant_client.patch(f"/claims/{claim.id}/status", json={"status": s})

    # Buyer accepts the delivery — this creates a pending disbursement
    set_auth_as_buyer()
    claimant_client.patch(f"/claims/{claim.id}/status", json={"status": "accepted"})

    db_session.expire_all()
    return claim


def test_mark_disbursement_paid_happy_path(claimant_client, seed_order, seed_claimant_user, db_session):
    """Mark a pending disbursement as paid with a stripe_transfer_id — should persist both fields."""
    from fitd_schemas.fitd_db_schemas import Disbursement

    claim = _create_accepted_claim(claimant_client, db_session)

    disbursement = db_session.query(Disbursement).filter(
        Disbursement.claim_id == claim.id,
        Disbursement.status == "pending",
    ).first()
    assert disbursement is not None

    response = claimant_client.patch(
        f"/disbursements/{disbursement.id}/paid",
        json={"stripe_transfer_id": "tr_abc123"},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Disbursement marked as paid"

    db_session.expire_all()
    updated = db_session.query(Disbursement).filter(Disbursement.id == disbursement.id).first()
    assert updated.status == "paid"
    assert updated.stripe_transfer_id == "tr_abc123"


def test_mark_disbursement_paid_missing_transfer_id_returns_422(claimant_client, seed_order, seed_claimant_user, db_session):
    """Omitting stripe_transfer_id should return 422 (Pydantic validation)."""
    from fitd_schemas.fitd_db_schemas import Disbursement

    claim = _create_accepted_claim(claimant_client, db_session)

    disbursement = db_session.query(Disbursement).filter(
        Disbursement.claim_id == claim.id,
        Disbursement.status == "pending",
    ).first()
    assert disbursement is not None

    response = claimant_client.patch(
        f"/disbursements/{disbursement.id}/paid",
        json={},
    )
    assert response.status_code == 422


def test_mark_disbursement_paid_nonexistent_returns_404(claimant_client, seed_order, seed_claimant_user):
    """Marking a non-existent disbursement as paid should return 404."""
    response = claimant_client.patch(
        "/disbursements/nonexistent-id/paid",
        json={"stripe_transfer_id": "tr_abc123"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Disbursement not found"

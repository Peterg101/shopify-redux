import pytest


def test_get_claim_history(claimant_client, client, seed_order, seed_claimant_user, db_session):
    """Fetch status change history for a claim."""
    claimant_client.post(
        "/claims/claim_order",
        json={"order_id": "order-001", "quantity": 2, "status": "pending"},
    )
    from fitd_schemas.fitd_db_schemas import Claim
    claim = db_session.query(Claim).first()

    claimant_client.patch(f"/claims/{claim.id}/status", json={"status": "in_progress"})
    claimant_client.patch(f"/claims/{claim.id}/status", json={"status": "printing"})
    claimant_client.patch(f"/claims/{claim.id}/status", json={"status": "shipped"})

    response = client.get(f"/claims/{claim.id}/history")
    assert response.status_code == 200
    history = response.json()
    assert len(history) == 3
    assert history[0]["previous_status"] == "pending"
    assert history[0]["new_status"] == "in_progress"
    assert history[2]["previous_status"] == "printing"
    assert history[2]["new_status"] == "shipped"


def test_get_claim_history_empty(client, seed_order, seed_claimant_user, db_session):
    """No history for a freshly created claim."""
    from fitd_schemas.fitd_db_schemas import Claim
    import uuid

    claim = Claim(
        id=str(uuid.uuid4()),
        order_id="order-001",
        claimant_user_id="claimant-user-456",
        quantity=1,
        status="pending",
    )
    db_session.add(claim)
    db_session.commit()

    response = client.get(f"/claims/{claim.id}/history")
    assert response.status_code == 200
    assert response.json() == []

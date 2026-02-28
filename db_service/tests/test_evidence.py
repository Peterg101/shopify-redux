import pytest
import base64


def test_upload_claim_evidence(claimant_client, seed_order, seed_claimant_user, db_session):
    """Upload base64 image evidence for a claim."""
    claimant_client.post(
        "/claims/claim_order",
        json={"order_id": "order-001", "quantity": 2, "status": "pending"},
    )
    from fitd_schemas.fitd_db_schemas import Claim, ClaimEvidence
    claim = db_session.query(Claim).first()

    image_data = base64.b64encode(b"fake-image-data").decode("utf-8")
    response = claimant_client.post(
        f"/claims/{claim.id}/evidence",
        json={"image_data": image_data, "description": "Test photo"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["claim_id"] == claim.id
    assert data["description"] == "Test photo"

    db_session.expire_all()
    evidence = db_session.query(ClaimEvidence).filter(ClaimEvidence.claim_id == claim.id).first()
    assert evidence is not None


def test_get_claim_evidence(claimant_client, client, seed_order, seed_claimant_user, db_session):
    """Fetch evidence for a claim."""
    claimant_client.post(
        "/claims/claim_order",
        json={"order_id": "order-001", "quantity": 2, "status": "pending"},
    )
    from fitd_schemas.fitd_db_schemas import Claim
    claim = db_session.query(Claim).first()

    image_data = base64.b64encode(b"fake-image-data").decode("utf-8")
    claimant_client.post(
        f"/claims/{claim.id}/evidence",
        json={"image_data": image_data, "description": "Photo 1"},
    )

    response = client.get(f"/claims/{claim.id}/evidence")
    assert response.status_code == 200
    evidence_list = response.json()
    assert len(evidence_list) == 1
    assert evidence_list[0]["description"] == "Photo 1"


def test_upload_evidence_unauthorized(client, seed_order, db_session):
    """Only the fulfiller can upload evidence."""
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

    image_data = base64.b64encode(b"fake-image-data").decode("utf-8")
    response = client.post(
        f"/claims/{claim.id}/evidence",
        json={"image_data": image_data, "description": "Unauthorized"},
    )
    assert response.status_code == 403

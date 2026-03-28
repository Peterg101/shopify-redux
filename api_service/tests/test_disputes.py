import pytest
from datetime import datetime, timedelta


def _create_delivered_claim(claimant_client, db_session):
    """Helper: create a claim and advance it to 'delivered' status."""
    from conftest import set_auth_as_claimant, set_auth_as_buyer

    set_auth_as_claimant()
    claimant_client.post(
        "/claims/claim_order",
        json={"order_id": "order-001", "quantity": 2, "status": "pending"},
    )
    from fitd_schemas.fitd_db_schemas import Claim
    claim = db_session.query(Claim).first()

    for s in ["in_progress", "printing", "qa_check", "shipped", "delivered"]:
        claimant_client.patch(f"/claims/{claim.id}/status", json={"status": s})

    db_session.expire_all()
    return claim


def test_dispute_creates_held_disbursement(claimant_client, seed_order, seed_claimant_user, db_session):
    """Disputing a delivered claim should create a held disbursement and a dispute record."""
    from conftest import set_auth_as_buyer
    from fitd_schemas.fitd_db_schemas import Disbursement, Dispute

    claim = _create_delivered_claim(claimant_client, db_session)

    set_auth_as_buyer()
    response = claimant_client.patch(
        f"/claims/{claim.id}/status",
        json={"status": "disputed", "reason": "Item damaged"},
    )
    assert response.status_code == 200

    db_session.expire_all()
    disbursement = db_session.query(Disbursement).filter(
        Disbursement.claim_id == claim.id, Disbursement.status == "held"
    ).first()
    assert disbursement is not None
    assert disbursement.amount_cents > 0

    dispute = db_session.query(Dispute).filter(Dispute.claim_id == claim.id).first()
    assert dispute is not None
    assert dispute.status == "open"
    assert dispute.reason == "Item damaged"


def test_dispute_requires_reason(claimant_client, seed_order, seed_claimant_user, db_session):
    """Disputing without a reason should return 400."""
    from conftest import set_auth_as_buyer

    claim = _create_delivered_claim(claimant_client, db_session)

    set_auth_as_buyer()
    response = claimant_client.patch(
        f"/claims/{claim.id}/status",
        json={"status": "disputed"},
    )
    assert response.status_code == 400


def test_fulfiller_respond_to_dispute(claimant_client, seed_order, seed_claimant_user, db_session):
    """Fulfiller should be able to respond to an open dispute."""
    from conftest import set_auth_as_buyer, set_auth_as_claimant
    from fitd_schemas.fitd_db_schemas import Dispute

    claim = _create_delivered_claim(claimant_client, db_session)

    set_auth_as_buyer()
    claimant_client.patch(
        f"/claims/{claim.id}/status",
        json={"status": "disputed", "reason": "Wrong colour"},
    )

    db_session.expire_all()
    dispute = db_session.query(Dispute).filter(Dispute.claim_id == claim.id).first()

    set_auth_as_claimant()
    response = claimant_client.post(
        f"/disputes/{dispute.id}/respond",
        json={"response_text": "The colour matches the order specification."},
    )
    assert response.status_code == 200

    db_session.expire_all()
    dispute = db_session.query(Dispute).filter(Dispute.id == dispute.id).first()
    assert dispute.status == "responded"
    assert dispute.fulfiller_response is not None
    assert dispute.buyer_deadline is not None


def test_buyer_resolve_accepted(claimant_client, seed_order, seed_claimant_user, db_session):
    """Buyer resolves by accepting — full payment released."""
    from conftest import set_auth_as_buyer, set_auth_as_claimant
    from fitd_schemas.fitd_db_schemas import Dispute, Disbursement, Claim

    claim = _create_delivered_claim(claimant_client, db_session)

    set_auth_as_buyer()
    claimant_client.patch(
        f"/claims/{claim.id}/status",
        json={"status": "disputed", "reason": "Testing"},
    )
    db_session.expire_all()
    dispute = db_session.query(Dispute).filter(Dispute.claim_id == claim.id).first()

    response = claimant_client.post(
        f"/disputes/{dispute.id}/resolve",
        json={"resolution": "accepted"},
    )
    assert response.status_code == 200

    db_session.expire_all()
    disbursement = db_session.query(Disbursement).filter(Disbursement.claim_id == claim.id).first()
    assert disbursement.status == "pending"

    claim = db_session.query(Claim).filter(Claim.id == claim.id).first()
    assert claim.status == "resolved_accepted"


def test_buyer_resolve_partial(claimant_client, seed_order, seed_claimant_user, db_session):
    """Buyer resolves with partial refund — reduced amount released."""
    from conftest import set_auth_as_buyer, set_auth_as_claimant
    from fitd_schemas.fitd_db_schemas import Dispute, Disbursement, Claim

    claim = _create_delivered_claim(claimant_client, db_session)

    set_auth_as_buyer()
    claimant_client.patch(
        f"/claims/{claim.id}/status",
        json={"status": "disputed", "reason": "Partial damage"},
    )
    db_session.expire_all()
    dispute = db_session.query(Dispute).filter(Dispute.claim_id == claim.id).first()

    response = claimant_client.post(
        f"/disputes/{dispute.id}/resolve",
        json={"resolution": "partial", "partial_amount_cents": 200},
    )
    assert response.status_code == 200

    db_session.expire_all()
    disbursement = db_session.query(Disbursement).filter(Disbursement.claim_id == claim.id).first()
    assert disbursement.status == "pending"
    assert disbursement.amount_cents == 200

    claim = db_session.query(Claim).filter(Claim.id == claim.id).first()
    assert claim.status == "resolved_partial"


def test_buyer_resolve_rejected(claimant_client, seed_order, seed_claimant_user, db_session):
    """Buyer rejects — disbursement cancelled."""
    from conftest import set_auth_as_buyer, set_auth_as_claimant
    from fitd_schemas.fitd_db_schemas import Dispute, Disbursement, Claim

    claim = _create_delivered_claim(claimant_client, db_session)

    set_auth_as_buyer()
    claimant_client.patch(
        f"/claims/{claim.id}/status",
        json={"status": "disputed", "reason": "Completely wrong"},
    )
    db_session.expire_all()
    dispute = db_session.query(Dispute).filter(Dispute.claim_id == claim.id).first()

    response = claimant_client.post(
        f"/disputes/{dispute.id}/resolve",
        json={"resolution": "rejected"},
    )
    assert response.status_code == 200

    db_session.expire_all()
    disbursement = db_session.query(Disbursement).filter(Disbursement.claim_id == claim.id).first()
    assert disbursement.status == "cancelled"

    claim = db_session.query(Claim).filter(Claim.id == claim.id).first()
    assert claim.status == "resolved_rejected"


def test_auto_resolve_fulfiller_inactive(claimant_client, seed_order, seed_claimant_user, db_session):
    """If fulfiller misses the deadline, buyer wins (rejected) on next access."""
    from conftest import set_auth_as_buyer
    from fitd_schemas.fitd_db_schemas import Dispute, Disbursement, Claim

    claim = _create_delivered_claim(claimant_client, db_session)

    set_auth_as_buyer()
    claimant_client.patch(
        f"/claims/{claim.id}/status",
        json={"status": "disputed", "reason": "No response expected"},
    )

    db_session.expire_all()
    dispute = db_session.query(Dispute).filter(Dispute.claim_id == claim.id).first()
    # Manually expire the fulfiller deadline
    dispute.fulfiller_deadline = datetime.utcnow() - timedelta(hours=1)
    db_session.commit()

    # GET dispute triggers lazy auto-resolve
    response = claimant_client.get(f"/disputes/{claim.id}")
    assert response.status_code == 200

    db_session.expire_all()
    dispute = db_session.query(Dispute).filter(Dispute.claim_id == claim.id).first()
    assert dispute.status == "resolved"
    assert dispute.resolution == "rejected"
    assert dispute.resolved_by == "auto"

    disbursement = db_session.query(Disbursement).filter(Disbursement.claim_id == claim.id).first()
    assert disbursement.status == "cancelled"


def test_auto_resolve_buyer_inactive(claimant_client, seed_order, seed_claimant_user, db_session):
    """If buyer misses the review deadline after fulfiller responds, fulfiller wins (accepted)."""
    from conftest import set_auth_as_buyer, set_auth_as_claimant
    from fitd_schemas.fitd_db_schemas import Dispute, Disbursement, Claim

    claim = _create_delivered_claim(claimant_client, db_session)

    set_auth_as_buyer()
    claimant_client.patch(
        f"/claims/{claim.id}/status",
        json={"status": "disputed", "reason": "Testing auto-resolve"},
    )

    db_session.expire_all()
    dispute = db_session.query(Dispute).filter(Dispute.claim_id == claim.id).first()

    # Fulfiller responds
    set_auth_as_claimant()
    claimant_client.post(
        f"/disputes/{dispute.id}/respond",
        json={"response_text": "Everything was correct"},
    )

    # Expire buyer deadline
    db_session.expire_all()
    dispute = db_session.query(Dispute).filter(Dispute.id == dispute.id).first()
    dispute.buyer_deadline = datetime.utcnow() - timedelta(hours=1)
    db_session.commit()

    # GET dispute triggers lazy auto-resolve
    set_auth_as_buyer()
    response = claimant_client.get(f"/disputes/{claim.id}")
    assert response.status_code == 200

    db_session.expire_all()
    dispute = db_session.query(Dispute).filter(Dispute.id == dispute.id).first()
    assert dispute.status == "resolved"
    assert dispute.resolution == "accepted"
    assert dispute.resolved_by == "auto"

    disbursement = db_session.query(Disbursement).filter(Disbursement.claim_id == claim.id).first()
    assert disbursement.status == "pending"


def test_fulfiller_cannot_resolve(claimant_client, seed_order, seed_claimant_user, db_session):
    """Fulfiller should not be able to resolve a dispute — only the buyer can."""
    from conftest import set_auth_as_buyer, set_auth_as_claimant
    from fitd_schemas.fitd_db_schemas import Dispute

    claim = _create_delivered_claim(claimant_client, db_session)

    set_auth_as_buyer()
    claimant_client.patch(
        f"/claims/{claim.id}/status",
        json={"status": "disputed", "reason": "Test"},
    )

    db_session.expire_all()
    dispute = db_session.query(Dispute).filter(Dispute.claim_id == claim.id).first()

    # Try to resolve as fulfiller
    set_auth_as_claimant()
    response = claimant_client.post(
        f"/disputes/{dispute.id}/resolve",
        json={"resolution": "accepted"},
    )
    assert response.status_code == 403

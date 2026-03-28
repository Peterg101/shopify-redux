"""Tests for Phase 4: capability matching in claimable_orders and claim validation."""
import json
from datetime import datetime

import pytest
from fitd_schemas.fitd_db_schemas import (
    ManufacturingProcess, ManufacturingMaterial,
    FulfillerProfile, FulfillerCapability,
    Order, User, Task,
)
from conftest import set_auth_as_buyer, set_auth_as_claimant


# ── Helpers ─────────────────────────────────────────────────────────────────

def _seed_manufacturing_data(db):
    """Insert minimal reference data for tests."""
    fdm = ManufacturingProcess(id="proc-fdm", family="3d_printing", name="FDM", display_name="FDM")
    sla = ManufacturingProcess(id="proc-sla", family="3d_printing", name="SLA", display_name="SLA")
    cnc = ManufacturingProcess(id="proc-cnc", family="cnc", name="3-axis CNC", display_name="3-axis CNC")
    pla = ManufacturingMaterial(id="mat-pla", category="thermoplastic", name="PLA", process_family="3d_printing")
    abs_m = ManufacturingMaterial(id="mat-abs", category="thermoplastic", name="ABS", process_family="3d_printing")
    alu = ManufacturingMaterial(id="mat-alu", category="metal", name="Aluminum 6061", process_family="cnc")
    for obj in [fdm, sla, cnc, pla, abs_m, alu]:
        db.add(obj)
    db.commit()
    return {"fdm": fdm, "sla": sla, "cnc": cnc, "pla": pla, "abs": abs_m, "alu": alu}


def _seed_claimant_and_task(db):
    """Create claimant user + task directly in DB so hydration can look them up."""
    user = db.query(User).filter(User.user_id == "claimant-user-456").first()
    if not user:
        user = User(user_id="claimant-user-456", username="claimant", email="claimant@example.com")
        db.add(user)
    task = db.query(Task).filter(Task.task_id == "claimant-task-001").first()
    if not task:
        task = Task(task_id="claimant-task-001", user_id="claimant-user-456", task_name="Claimant Task")
        db.add(task)
    db.commit()


def _create_collaborative_order(db, order_id, user_id, task_id, process_id=None, material_id=None):
    """Create a collaborative order, optionally with manufacturing spec."""
    order = Order(
        order_id=order_id,
        task_id=task_id,
        user_id=user_id,
        name=f"Order {order_id}",
        material="PLA Basic",
        technique="FDM",
        sizing=1.0,
        colour="white",
        selectedFile="test.obj",
        selectedFileType="obj",
        price=10.0,
        quantity=5,
        created_at=datetime.utcnow().isoformat(),
        is_collaborative=True,
        status="open",
        process_id=process_id,
        material_id=material_id,
    )
    db.add(order)
    db.commit()
    return order


def _create_fulfiller_profile(db, user_id, capabilities):
    """Create a fulfiller profile with given capabilities.
    capabilities: list of dicts with process_id and optional materials (list of IDs)
    """
    profile = FulfillerProfile(
        user_id=user_id,
        business_name="Test Shop",
        is_active=True,
    )
    db.add(profile)
    db.flush()
    for cap_data in capabilities:
        cap = FulfillerCapability(
            profile_id=profile.id,
            process_id=cap_data["process_id"],
            materials=json.dumps(cap_data.get("materials")) if cap_data.get("materials") else None,
        )
        db.add(cap)
    db.commit()
    return profile


# ── Capability Filtering Tests ──────────────────────────────────────────────

class TestCapabilityFiltering:
    """Test that claimable_orders in get_user respects fulfiller capabilities."""

    def test_no_profile_sees_all_collaborative_orders(self, client, seed_user, seed_task, db_session):
        """User without fulfiller profile sees all collaborative orders."""
        mfg = _seed_manufacturing_data(db_session)
        _seed_claimant_and_task(db_session)

        # Create orders: one with process_id, one without (legacy)
        _create_collaborative_order(db_session, "order-spec", "claimant-user-456", "claimant-task-001",
                                    process_id="proc-fdm", material_id="mat-pla")
        _create_collaborative_order(db_session, "order-legacy", "claimant-user-456", "claimant-task-001")

        # Hydrate as buyer (no fulfiller profile)
        resp = client.get("/users/test-user-123", headers={"Authorization": "Bearer fake"})
        assert resp.status_code == 200
        claimable = resp.json()["claimable_orders"]
        ids = [o["order_id"] for o in claimable]
        assert "order-spec" in ids
        assert "order-legacy" in ids

    def test_matching_capability_sees_order(self, client, seed_user, seed_task, db_session):
        """Fulfiller with matching FDM capability sees FDM order."""
        mfg = _seed_manufacturing_data(db_session)
        _seed_claimant_and_task(db_session)

        _create_collaborative_order(db_session, "order-fdm", "claimant-user-456", "claimant-task-001",
                                    process_id="proc-fdm", material_id="mat-pla")

        # Create fulfiller profile for buyer with FDM + PLA capability
        _create_fulfiller_profile(db_session, "test-user-123", [
            {"process_id": "proc-fdm", "materials": ["mat-pla", "mat-abs"]}
        ])

        resp = client.get("/users/test-user-123", headers={"Authorization": "Bearer fake"})
        assert resp.status_code == 200
        claimable = resp.json()["claimable_orders"]
        assert len(claimable) == 1
        assert claimable[0]["order_id"] == "order-fdm"

    def test_nonmatching_process_hides_order(self, client, seed_user, seed_task, db_session):
        """Fulfiller with only CNC capability does not see FDM order."""
        mfg = _seed_manufacturing_data(db_session)
        _seed_claimant_and_task(db_session)

        _create_collaborative_order(db_session, "order-fdm", "claimant-user-456", "claimant-task-001",
                                    process_id="proc-fdm", material_id="mat-pla")

        _create_fulfiller_profile(db_session, "test-user-123", [
            {"process_id": "proc-cnc", "materials": ["mat-alu"]}
        ])

        resp = client.get("/users/test-user-123", headers={"Authorization": "Bearer fake"})
        claimable = resp.json()["claimable_orders"]
        assert len(claimable) == 0

    def test_legacy_order_visible_with_profile(self, client, seed_user, seed_task, db_session):
        """Legacy orders (no process_id) visible even when fulfiller has profile."""
        _seed_manufacturing_data(db_session)
        _seed_claimant_and_task(db_session)

        _create_collaborative_order(db_session, "order-legacy", "claimant-user-456", "claimant-task-001")

        _create_fulfiller_profile(db_session, "test-user-123", [
            {"process_id": "proc-fdm", "materials": ["mat-pla"]}
        ])

        resp = client.get("/users/test-user-123", headers={"Authorization": "Bearer fake"})
        claimable = resp.json()["claimable_orders"]
        assert len(claimable) == 1
        assert claimable[0]["order_id"] == "order-legacy"

    def test_material_mismatch_hides_order(self, client, seed_user, seed_task, db_session):
        """Order requires ABS but fulfiller only supports PLA — hidden."""
        _seed_manufacturing_data(db_session)
        _seed_claimant_and_task(db_session)

        _create_collaborative_order(db_session, "order-abs", "claimant-user-456", "claimant-task-001",
                                    process_id="proc-fdm", material_id="mat-abs")

        _create_fulfiller_profile(db_session, "test-user-123", [
            {"process_id": "proc-fdm", "materials": ["mat-pla"]}
        ])

        resp = client.get("/users/test-user-123", headers={"Authorization": "Bearer fake"})
        claimable = resp.json()["claimable_orders"]
        assert len(claimable) == 0

    def test_no_material_constraint_shows_order(self, client, seed_user, seed_task, db_session):
        """Fulfiller with FDM capability but no material list sees all FDM orders."""
        _seed_manufacturing_data(db_session)
        _seed_claimant_and_task(db_session)

        _create_collaborative_order(db_session, "order-fdm", "claimant-user-456", "claimant-task-001",
                                    process_id="proc-fdm", material_id="mat-abs")

        _create_fulfiller_profile(db_session, "test-user-123", [
            {"process_id": "proc-fdm"}  # no materials constraint
        ])

        resp = client.get("/users/test-user-123", headers={"Authorization": "Bearer fake"})
        claimable = resp.json()["claimable_orders"]
        assert len(claimable) == 1

    def test_order_fields_include_manufacturing_spec(self, client, seed_user, seed_task, db_session):
        """Order response includes process_id, material_id, tolerance, etc."""
        _seed_manufacturing_data(db_session)
        _seed_claimant_and_task(db_session)

        order = Order(
            order_id="order-spec",
            task_id="claimant-task-001",
            user_id="claimant-user-456",
            name="Spec Order",
            material="PLA Basic", technique="FDM",
            sizing=1.0, colour="white",
            selectedFile="test.obj", selectedFileType="obj",
            price=10.0, quantity=1,
            created_at=datetime.utcnow().isoformat(),
            is_collaborative=True, status="open",
            process_id="proc-fdm", material_id="mat-pla",
            tolerance_mm=0.1, surface_finish="smooth",
            special_requirements="Food safe",
        )
        db_session.add(order)
        db_session.commit()

        resp = client.get("/users/test-user-123", headers={"Authorization": "Bearer fake"})
        claimable = resp.json()["claimable_orders"]
        assert len(claimable) == 1
        o = claimable[0]
        assert o["process_id"] == "proc-fdm"
        assert o["material_id"] == "mat-pla"
        assert o["tolerance_mm"] == 0.1
        assert o["surface_finish"] == "smooth"
        assert o["special_requirements"] == "Food safe"


# ── Claim Validation Tests ──────────────────────────────────────────────────

class TestClaimValidation:
    """Test that claim_order validates fulfiller capability."""

    def test_claim_allowed_for_legacy_order(self, client, seed_user, seed_task, seed_claimant_user, db_session):
        """Legacy order (no process_id) can be claimed by anyone."""
        _create_collaborative_order(db_session, "order-legacy", "test-user-123", "task-001")

        set_auth_as_claimant()
        resp = client.post("/claims/claim_order", json={
            "order_id": "order-legacy", "quantity": 1, "status": "pending"
        })
        assert resp.status_code == 201
        set_auth_as_buyer()

    def test_claim_rejected_no_profile(self, client, seed_user, seed_task, seed_claimant_user, db_session):
        """Claim rejected if order has process_id but fulfiller has no profile."""
        _seed_manufacturing_data(db_session)
        _create_collaborative_order(db_session, "order-fdm", "test-user-123", "task-001",
                                    process_id="proc-fdm")

        set_auth_as_claimant()
        resp = client.post("/claims/claim_order", json={
            "order_id": "order-fdm", "quantity": 1, "status": "pending"
        })
        assert resp.status_code == 403
        assert "fulfiller profile" in resp.json()["detail"].lower()
        set_auth_as_buyer()

    def test_claim_rejected_wrong_process(self, client, seed_user, seed_task, seed_claimant_user, db_session):
        """Claim rejected if fulfiller has wrong process."""
        _seed_manufacturing_data(db_session)
        _create_collaborative_order(db_session, "order-fdm", "test-user-123", "task-001",
                                    process_id="proc-fdm")

        _create_fulfiller_profile(db_session, "claimant-user-456", [
            {"process_id": "proc-cnc"}
        ])

        set_auth_as_claimant()
        resp = client.post("/claims/claim_order", json={
            "order_id": "order-fdm", "quantity": 1, "status": "pending"
        })
        assert resp.status_code == 403
        assert "process" in resp.json()["detail"].lower()
        set_auth_as_buyer()

    def test_claim_rejected_wrong_material(self, client, seed_user, seed_task, seed_claimant_user, db_session):
        """Claim rejected if fulfiller has right process but wrong material."""
        _seed_manufacturing_data(db_session)
        _create_collaborative_order(db_session, "order-abs", "test-user-123", "task-001",
                                    process_id="proc-fdm", material_id="mat-abs")

        _create_fulfiller_profile(db_session, "claimant-user-456", [
            {"process_id": "proc-fdm", "materials": ["mat-pla"]}
        ])

        set_auth_as_claimant()
        resp = client.post("/claims/claim_order", json={
            "order_id": "order-abs", "quantity": 1, "status": "pending"
        })
        assert resp.status_code == 403
        assert "material" in resp.json()["detail"].lower()
        set_auth_as_buyer()

    def test_claim_allowed_matching_capability(self, client, seed_user, seed_task, seed_claimant_user, db_session):
        """Claim succeeds when fulfiller has matching process + material."""
        _seed_manufacturing_data(db_session)
        _create_collaborative_order(db_session, "order-fdm-pla", "test-user-123", "task-001",
                                    process_id="proc-fdm", material_id="mat-pla")

        _create_fulfiller_profile(db_session, "claimant-user-456", [
            {"process_id": "proc-fdm", "materials": ["mat-pla", "mat-abs"]}
        ])

        set_auth_as_claimant()
        resp = client.post("/claims/claim_order", json={
            "order_id": "order-fdm-pla", "quantity": 1, "status": "pending"
        })
        assert resp.status_code == 201
        set_auth_as_buyer()

    def test_claim_allowed_no_material_constraint(self, client, seed_user, seed_task, seed_claimant_user, db_session):
        """Claim succeeds when fulfiller capability has no material restriction."""
        _seed_manufacturing_data(db_session)
        _create_collaborative_order(db_session, "order-fdm", "test-user-123", "task-001",
                                    process_id="proc-fdm", material_id="mat-abs")

        _create_fulfiller_profile(db_session, "claimant-user-456", [
            {"process_id": "proc-fdm"}  # no materials — accepts all
        ])

        set_auth_as_claimant()
        resp = client.post("/claims/claim_order", json={
            "order_id": "order-fdm", "quantity": 1, "status": "pending"
        })
        assert resp.status_code == 201
        set_auth_as_buyer()

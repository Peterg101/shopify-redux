"""Tests for manufacturing processes, materials, and fulfiller profile endpoints."""
import json
import pytest

from conftest import set_auth_as_buyer, set_auth_as_claimant


# ── Helpers ──────────────────────────────────────────────────────────

def seed_processes(client):
    """Seed DB and return list of processes."""
    resp = client.get("/manufacturing/processes")
    # Processes are seeded by table creation (migration seed data isn't used in
    # in-memory tests, so we seed them manually here).
    return resp


def _seed_manufacturing_data(db_session):
    """Insert reference data into the in-memory test DB."""
    from fitd_schemas.fitd_db_schemas import ManufacturingProcess, ManufacturingMaterial

    processes = [
        ManufacturingProcess(id="proc-fdm", family="3d_printing", name="FDM", display_name="Fused Deposition Modeling (FDM)"),
        ManufacturingProcess(id="proc-sla", family="3d_printing", name="SLA", display_name="Stereolithography (SLA)"),
        ManufacturingProcess(id="proc-cnc3", family="cnc", name="3-axis CNC", display_name="3-Axis CNC Milling"),
        ManufacturingProcess(id="proc-laser", family="sheet_metal", name="Laser Cutting", display_name="Laser Cutting"),
    ]
    materials = [
        ManufacturingMaterial(id="mat-pla", category="thermoplastic", name="PLA", process_family="3d_printing"),
        ManufacturingMaterial(id="mat-abs", category="thermoplastic", name="ABS", process_family="3d_printing"),
        ManufacturingMaterial(id="mat-al6061", category="metal", name="Aluminum 6061", process_family="cnc"),
        ManufacturingMaterial(id="mat-steel", category="sheet_metal", name="Mild Steel Sheet", process_family="sheet_metal"),
    ]
    db_session.add_all(processes + materials)
    db_session.commit()


@pytest.fixture
def seed_manufacturing(db_session):
    _seed_manufacturing_data(db_session)


# ── Manufacturing Processes ──────────────────────────────────────────

class TestManufacturingProcesses:
    def test_list_processes(self, client, seed_manufacturing):
        resp = client.get("/manufacturing/processes")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 4
        families = {p["family"] for p in data}
        assert "3d_printing" in families
        assert "cnc" in families

    def test_list_processes_has_correct_fields(self, client, seed_manufacturing):
        resp = client.get("/manufacturing/processes")
        assert resp.status_code == 200
        proc = resp.json()[0]
        assert "id" in proc
        assert "family" in proc
        assert "name" in proc
        assert "display_name" in proc


# ── Manufacturing Materials ──────────────────────────────────────────

class TestManufacturingMaterials:
    def test_list_all_materials(self, client, seed_manufacturing):
        resp = client.get("/manufacturing/materials")
        assert resp.status_code == 200
        assert len(resp.json()) == 4

    def test_filter_materials_by_process_family(self, client, seed_manufacturing):
        resp = client.get("/manufacturing/materials?process_family=3d_printing")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert all(m["process_family"] == "3d_printing" for m in data)

    def test_filter_materials_empty_result(self, client, seed_manufacturing):
        resp = client.get("/manufacturing/materials?process_family=injection_molding")
        assert resp.status_code == 200
        assert resp.json() == []


# ── Fulfiller Profile CRUD ───────────────────────────────────────────

class TestFulfillerProfileCreate:
    def test_create_profile_minimal(self, client, seed_user, seed_manufacturing):
        resp = client.post("/fulfiller_profile", json={
            "business_name": "Test Workshop",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["business_name"] == "Test Workshop"
        assert data["user_id"] == "test-user-123"
        assert data["is_active"] is True
        assert data["capabilities"] == []

    def test_create_profile_with_capabilities(self, client, seed_user, seed_manufacturing):
        resp = client.post("/fulfiller_profile", json={
            "business_name": "Full Workshop",
            "description": "We do everything",
            "max_build_volume_x": 300.0,
            "max_build_volume_y": 300.0,
            "max_build_volume_z": 400.0,
            "min_tolerance_mm": 0.1,
            "lead_time_days_min": 2,
            "lead_time_days_max": 7,
            "certifications": ["ISO 9001"],
            "post_processing": ["sanding", "painting"],
            "capabilities": [
                {"process_id": "proc-fdm", "materials": ["mat-pla", "mat-abs"], "notes": "Up to 300mm"},
                {"process_id": "proc-cnc3", "materials": ["mat-al6061"]},
            ],
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["business_name"] == "Full Workshop"
        assert data["max_build_volume_x"] == 300.0
        assert data["certifications"] == ["ISO 9001"]
        assert data["post_processing"] == ["sanding", "painting"]
        assert len(data["capabilities"]) == 2
        fdm_cap = next(c for c in data["capabilities"] if c["process_id"] == "proc-fdm")
        assert fdm_cap["materials"] == ["mat-pla", "mat-abs"]
        assert fdm_cap["notes"] == "Up to 300mm"
        assert fdm_cap["process"]["name"] == "FDM"

    def test_create_profile_duplicate_returns_409(self, client, seed_user, seed_manufacturing):
        client.post("/fulfiller_profile", json={"business_name": "First"})
        resp = client.post("/fulfiller_profile", json={"business_name": "Second"})
        assert resp.status_code == 409

    def test_create_profile_invalid_process_returns_400(self, client, seed_user, seed_manufacturing):
        resp = client.post("/fulfiller_profile", json={
            "business_name": "Bad Workshop",
            "capabilities": [{"process_id": "nonexistent", "materials": []}],
        })
        assert resp.status_code == 400
        assert "Invalid process_id" in resp.json()["detail"]


class TestFulfillerProfileGet:
    def test_get_profile(self, client, seed_user, seed_manufacturing):
        client.post("/fulfiller_profile", json={"business_name": "My Shop"})
        resp = client.get("/fulfiller_profile/test-user-123")
        assert resp.status_code == 200
        assert resp.json()["business_name"] == "My Shop"

    def test_get_profile_not_found(self, client, seed_user):
        resp = client.get("/fulfiller_profile/test-user-123")
        assert resp.status_code == 404


class TestFulfillerProfileUpdate:
    def test_update_profile(self, client, seed_user, seed_manufacturing):
        client.post("/fulfiller_profile", json={
            "business_name": "Old Name",
            "capabilities": [{"process_id": "proc-fdm"}],
        })
        resp = client.put("/fulfiller_profile", json={
            "business_name": "New Name",
            "description": "Updated description",
            "capabilities": [
                {"process_id": "proc-sla", "materials": ["mat-pla"]},
            ],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["business_name"] == "New Name"
        assert data["description"] == "Updated description"
        assert len(data["capabilities"]) == 1
        assert data["capabilities"][0]["process"]["name"] == "SLA"

    def test_update_profile_not_found(self, client, seed_user):
        resp = client.put("/fulfiller_profile", json={"business_name": "Nope"})
        assert resp.status_code == 404


class TestFulfillerProfileInHydration:
    def test_hydration_includes_profile(self, client, seed_user, seed_manufacturing):
        client.post("/fulfiller_profile", json={
            "business_name": "Hydration Shop",
            "capabilities": [{"process_id": "proc-fdm"}],
        })
        resp = client.get("/users/test-user-123")
        assert resp.status_code == 200
        data = resp.json()
        assert data["fulfiller_profile"] is not None
        assert data["fulfiller_profile"]["business_name"] == "Hydration Shop"

    def test_hydration_without_profile(self, client, seed_user):
        resp = client.get("/users/test-user-123")
        assert resp.status_code == 200
        assert resp.json()["fulfiller_profile"] is None


class TestFulfillerProfileAuth:
    def test_claimant_can_create_own_profile(self, client, seed_manufacturing):
        """Use the buyer client to create the claimant user, then switch auth."""
        # Seed claimant user
        client.post(
            "/users",
            json={"user_id": "claimant-user-456", "username": "claimant", "email": "claimant@example.com"},
            headers={"Authorization": "Bearer fake"},
        )
        # Switch auth to claimant
        set_auth_as_claimant()
        resp = client.post("/fulfiller_profile", json={"business_name": "Claimant Shop"})
        assert resp.status_code == 201
        assert resp.json()["user_id"] == "claimant-user-456"
        # Restore auth
        set_auth_as_buyer()

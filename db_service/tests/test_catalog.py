"""Tests for the parts catalog endpoints."""
import pytest
from conftest import set_auth_as_buyer, set_auth_as_claimant


@pytest.fixture
def seed_part(client, seed_task):
    """Create a published part."""
    resp = client.post("/parts", json={
        "name": "Test Bracket",
        "description": "A simple L-bracket",
        "category": "hardware",
        "tags": ["bracket", "mounting"],
        "task_id": "task-001",
        "file_type": "stl",
        "recommended_process": "FDM",
        "recommended_material": "PLA",
        "status": "published",
    })
    assert resp.status_code == 201
    return resp.json()


class TestCreatePart:
    def test_create_part_minimal(self, client, seed_task):
        resp = client.post("/parts", json={
            "name": "Simple Part",
            "task_id": "task-001",
            "file_type": "stl",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Simple Part"
        assert data["publisher_user_id"] == "test-user-123"
        assert data["status"] == "published"
        assert data["is_public"] is True
        assert data["download_count"] == 0

    def test_create_part_full(self, client, seed_task):
        resp = client.post("/parts", json={
            "name": "Full Part",
            "description": "Detailed description",
            "category": "mechanical",
            "tags": ["gear", "planetary"],
            "task_id": "task-001",
            "file_type": "obj",
            "bounding_box_x": 50.0,
            "bounding_box_y": 50.0,
            "bounding_box_z": 30.0,
            "volume_cm3": 12.5,
            "surface_area_cm2": 85.3,
            "recommended_process": "SLA",
            "recommended_material": "Tough Resin",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["tags"] == ["gear", "planetary"]
        assert data["bounding_box_x"] == 50.0
        assert data["volume_cm3"] == 12.5

    def test_create_part_invalid_task(self, client, seed_user):
        resp = client.post("/parts", json={
            "name": "Bad Part",
            "task_id": "nonexistent",
            "file_type": "stl",
        })
        assert resp.status_code == 404

    def test_create_part_other_users_task(self, client, seed_task):
        # Switch to claimant user
        client.post(
            "/users",
            json={"user_id": "claimant-user-456", "username": "claimant", "email": "claimant@example.com"},
            headers={"Authorization": "Bearer fake"},
        )
        set_auth_as_claimant()
        resp = client.post("/parts", json={
            "name": "Stolen Part",
            "task_id": "task-001",
            "file_type": "stl",
        })
        assert resp.status_code == 403
        set_auth_as_buyer()

    def test_create_part_invalid_file_type(self, client, seed_task):
        resp = client.post("/parts", json={
            "name": "Bad Type",
            "task_id": "task-001",
            "file_type": "exe",
        })
        assert resp.status_code == 422


class TestGetPart:
    def test_get_part(self, client, seed_part):
        resp = client.get(f"/parts/{seed_part['id']}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Test Bracket"

    def test_get_part_not_found(self, client, seed_user):
        resp = client.get("/parts/nonexistent")
        assert resp.status_code == 404


class TestListParts:
    def test_list_parts_empty(self, client, seed_user):
        resp = client.get("/parts")
        assert resp.status_code == 200
        data = resp.json()
        assert data["parts"] == []
        assert data["total"] == 0

    def test_list_parts(self, client, seed_part):
        resp = client.get("/parts")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["parts"][0]["name"] == "Test Bracket"

    def test_list_parts_search(self, client, seed_part):
        resp = client.get("/parts?q=Bracket")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

        resp = client.get("/parts?q=nonexistent")
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    def test_list_parts_filter_category(self, client, seed_part):
        resp = client.get("/parts?category=hardware")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

        resp = client.get("/parts?category=other")
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    def test_list_parts_filter_file_type(self, client, seed_part):
        resp = client.get("/parts?file_type=stl")
        assert resp.json()["total"] == 1

        resp = client.get("/parts?file_type=obj")
        assert resp.json()["total"] == 0

    def test_list_parts_excludes_archived(self, client, seed_part):
        client.delete(f"/parts/{seed_part['id']}")
        resp = client.get("/parts")
        assert resp.json()["total"] == 0

    def test_list_parts_pagination(self, client, seed_task):
        for i in range(5):
            client.post("/parts", json={
                "name": f"Part {i}",
                "task_id": "task-001",
                "file_type": "stl",
            })
        resp = client.get("/parts?page=1&page_size=2")
        data = resp.json()
        assert len(data["parts"]) == 2
        assert data["total"] == 5


class TestUpdatePart:
    def test_update_part(self, client, seed_part):
        resp = client.put(f"/parts/{seed_part['id']}", json={
            "name": "Updated Bracket",
            "description": "Updated description",
        })
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Bracket"

    def test_update_part_unauthorized(self, client, seed_part):
        client.post(
            "/users",
            json={"user_id": "claimant-user-456", "username": "claimant", "email": "claimant@example.com"},
            headers={"Authorization": "Bearer fake"},
        )
        set_auth_as_claimant()
        resp = client.put(f"/parts/{seed_part['id']}", json={"name": "Hacked"})
        assert resp.status_code == 403
        set_auth_as_buyer()

    def test_update_part_not_found(self, client, seed_user):
        resp = client.put("/parts/nonexistent", json={"name": "Nope"})
        assert resp.status_code == 404


class TestDeletePart:
    def test_delete_part_soft_deletes(self, client, seed_part):
        resp = client.delete(f"/parts/{seed_part['id']}")
        assert resp.status_code == 200

        # Part still exists but is archived
        resp = client.get(f"/parts/{seed_part['id']}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "archived"

    def test_delete_part_unauthorized(self, client, seed_part):
        client.post(
            "/users",
            json={"user_id": "claimant-user-456", "username": "claimant", "email": "claimant@example.com"},
            headers={"Authorization": "Bearer fake"},
        )
        set_auth_as_claimant()
        resp = client.delete(f"/parts/{seed_part['id']}")
        assert resp.status_code == 403
        set_auth_as_buyer()


class TestOrderFromPart:
    def test_order_from_part(self, client, seed_part):
        resp = client.post(f"/parts/{seed_part['id']}/order", json={
            "material": "ABS",
            "technique": "FDM",
            "quantity": 2,
            "price": 5.99,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "basket_task_id" in data

        # Verify download_count incremented
        part_resp = client.get(f"/parts/{seed_part['id']}")
        assert part_resp.json()["download_count"] == 1

    def test_order_from_part_defaults(self, client, seed_part):
        resp = client.post(f"/parts/{seed_part['id']}/order", json={})
        assert resp.status_code == 200

    def test_order_from_archived_part(self, client, seed_part):
        client.delete(f"/parts/{seed_part['id']}")
        resp = client.post(f"/parts/{seed_part['id']}/order", json={})
        assert resp.status_code == 404

    def test_order_invalid_quantity(self, client, seed_part):
        resp = client.post(f"/parts/{seed_part['id']}/order", json={"quantity": 0})
        assert resp.status_code == 400

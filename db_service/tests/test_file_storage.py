"""Tests for file upload/download endpoints:
- POST /file_upload           (Meshy text-to-3D result)
- POST /file_upload_from_image (Meshy image-to-3D result)
- GET  /file_storage/{file_id} (download file)
- POST /file_storage           (basket item file upload)
"""

import pytest
import base64
import os
from unittest.mock import patch, mock_open
from fitd_schemas.fitd_db_schemas import Task, PortID, BasketItem


# ── Helpers ──────────────────────────────────────────────────────────────

_SENTINEL = object()

SMALL_OBJ_CONTENT = b"v 0.0 0.0 0.0\nv 1.0 0.0 0.0\nv 0.0 1.0 0.0\nf 1 2 3\n"
SMALL_OBJ_B64 = base64.b64encode(SMALL_OBJ_CONTENT).decode("utf-8")


def _meshy_task_payload(task_id="task-001", obj_blob=None):
    """Build a valid MeshyTaskStatusResponse body."""
    return {
        "id": task_id,
        "mode": "preview",
        "name": "Test Model",
        "seed": 42,
        "art_style": "realistic",
        "texture_richness": "high",
        "prompt": "a cube",
        "negative_prompt": "",
        "status": "SUCCEEDED",
        "created_at": 1700000000,
        "progress": 100,
        "started_at": 1700000001,
        "finished_at": 1700000100,
        "thumbnail_url": "https://example.com/thumb.png",
        "video_url": "https://example.com/video.mp4",
        "obj_file_blob": obj_blob,
    }


def _image_to_3d_payload(task_id="task-001", obj_blob=None):
    """Build a valid ImageTo3DMeshyTaskStatusResponse body."""
    return {
        "id": task_id,
        "progress": 100,
        "started_at": 1700000001,
        "created_at": 1700000000,
        "expires_at": 1700100000,
        "finished_at": 1700000100,
        "status": "SUCCEEDED",
        "obj_file_blob": obj_blob,
    }


# ── POST /file_upload ───────────────────────────────────────────────────


def test_file_upload_saves_file(client, seed_task, db_session):
    """POST /file_upload decodes base64, saves .obj, marks task complete."""
    payload = _meshy_task_payload(task_id="task-001", obj_blob=SMALL_OBJ_B64)

    with patch("builtins.open", mock_open()) as mocked_file:
        response = client.post(
            "/file_upload",
            json=payload,
            headers={"Authorization": "Bearer fake"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "File saved successfully."
    assert "task-001" in data["file_name"]

    # Task should be marked complete
    db_session.expire_all()
    task = db_session.query(Task).filter(Task.task_id == "task-001").first()
    assert task.complete is True

    # Port should be deleted
    port = db_session.query(PortID).filter(PortID.task_id == "task-001").first()
    assert port is None


def test_file_upload_no_blob(client, seed_task):
    """POST /file_upload with no obj_file_blob returns a message without saving."""
    payload = _meshy_task_payload(task_id="task-001", obj_blob=None)

    response = client.post(
        "/file_upload",
        json=payload,
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "No OBJ file blob provided."


def test_file_upload_oversized_returns_413(client, seed_task):
    """POST /file_upload returns 413 when file exceeds 50MB base64 limit."""
    # MAX_FILE_SIZE_B64 = 50 * 1024 * 1024 * 4 // 3 ≈ 69,905,067
    oversized_blob = "A" * (50 * 1024 * 1024 * 4 // 3 + 1)
    payload = _meshy_task_payload(task_id="task-001", obj_blob=oversized_blob)

    response = client.post(
        "/file_upload",
        json=payload,
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 413
    assert "50MB" in response.json()["detail"]


# ── POST /file_upload_from_image ────────────────────────────────────────


def test_file_upload_from_image_saves_file(client, seed_task, db_session):
    """POST /file_upload_from_image decodes base64, saves .obj, marks task complete."""
    payload = _image_to_3d_payload(task_id="task-001", obj_blob=SMALL_OBJ_B64)

    with patch("builtins.open", mock_open()) as mocked_file:
        response = client.post(
            "/file_upload_from_image",
            json=payload,
            headers={"Authorization": "Bearer fake"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "File saved successfully."
    assert "task-001" in data["file_name"]

    # Task should be marked complete
    db_session.expire_all()
    task = db_session.query(Task).filter(Task.task_id == "task-001").first()
    assert task.complete is True


def test_file_upload_from_image_no_blob(client, seed_task):
    """POST /file_upload_from_image with no blob returns message."""
    payload = _image_to_3d_payload(task_id="task-001", obj_blob=None)

    response = client.post(
        "/file_upload_from_image",
        json=payload,
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "No OBJ file blob provided."


def test_file_upload_from_image_oversized_returns_413(client, seed_task):
    """POST /file_upload_from_image returns 413 for oversized files."""
    oversized_blob = "A" * (50 * 1024 * 1024 * 4 // 3 + 1)
    payload = _image_to_3d_payload(task_id="task-001", obj_blob=oversized_blob)

    response = client.post(
        "/file_upload_from_image",
        json=payload,
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 413


# ── GET /file_storage/{file_id} ─────────────────────────────────────────


def test_get_file_from_storage_success(client, seed_user):
    """GET /file_storage/{file_id} returns base64-encoded file data."""
    with patch("os.path.exists", return_value=True), \
         patch("builtins.open", mock_open(read_data=SMALL_OBJ_CONTENT)):
        response = client.get("/file_storage/test-file-001")

    assert response.status_code == 200
    data = response.json()
    assert data["file_id"] == "test-file-001"
    assert data["file_data"] == SMALL_OBJ_B64


def test_get_file_from_storage_not_found(client, seed_user):
    """GET /file_storage/{file_id} returns 404 when file does not exist."""
    with patch("os.path.exists", return_value=False):
        response = client.get("/file_storage/nonexistent-file")

    assert response.status_code == 404
    assert "File not found" in response.json()["detail"]


# ── POST /file_storage ──────────────────────────────────────────────────


def _basket_item_payload(task_id="task-001", user_id="test-user-123", file_blob=_SENTINEL):
    """Build a valid BasketItemInformation body."""
    return {
        "task_id": task_id,
        "user_id": user_id,
        "name": "Test Part",
        "material": "PLA",
        "technique": "FDM",
        "sizing": 1.0,
        "colour": "white",
        "selected_file": "test.obj",
        "selectedFileType": "obj",
        "price": 9.99,
        "quantity": 1,
        "file_blob": SMALL_OBJ_B64 if file_blob is _SENTINEL else file_blob,
    }


def test_post_file_storage_success(client, seed_task, db_session):
    """POST /file_storage saves the file and creates a basket item."""
    payload = _basket_item_payload()

    with patch("utils.check_file_exists", return_value=False), \
         patch("builtins.open", mock_open()):
        response = client.post("/file_storage", json=payload)

    assert response.status_code == 200
    assert response.json()["message"] == "File successfully saved"

    # Verify basket item in DB
    basket_item = db_session.query(BasketItem).filter(
        BasketItem.task_id == "task-001"
    ).first()
    assert basket_item is not None
    assert basket_item.name == "Test Part"
    assert basket_item.material == "PLA"
    assert basket_item.quantity == 1


def test_post_file_storage_user_not_found(client):
    """POST /file_storage returns 404 when user does not exist."""
    payload = _basket_item_payload(user_id="nonexistent-user")

    response = client.post("/file_storage", json=payload)
    assert response.status_code == 404
    assert "User not found" in response.json()["detail"]


def test_post_file_storage_no_file_blob(client, seed_user):
    """POST /file_storage returns 400 when file_blob is empty."""
    payload = _basket_item_payload(file_blob="")

    response = client.post("/file_storage", json=payload)
    assert response.status_code == 400
    assert "File blob not provided" in response.json()["detail"]


def test_post_file_storage_oversized_returns_413(client, seed_task):
    """POST /file_storage returns 413 for oversized files."""
    oversized_blob = "A" * (50 * 1024 * 1024 * 4 // 3 + 1)
    payload = _basket_item_payload(file_blob=oversized_blob)

    response = client.post("/file_storage", json=payload)
    assert response.status_code == 413
    assert "50MB" in response.json()["detail"]


def test_post_file_storage_updates_existing_basket_item(client, seed_task, db_session):
    """POST /file_storage updates an existing basket item if task_id already exists."""
    payload = _basket_item_payload()

    with patch("utils.check_file_exists", return_value=False), \
         patch("builtins.open", mock_open()):
        # First upload
        response = client.post("/file_storage", json=payload)
        assert response.status_code == 200

    # Second upload with different material
    payload["material"] = "ABS"
    payload["price"] = 14.99

    with patch("utils.check_file_exists", return_value=True):
        # File already exists so decode_file skips writing
        response = client.post("/file_storage", json=payload)
        assert response.status_code == 200

    # Verify only one basket item exists, with updated fields
    items = db_session.query(BasketItem).filter(BasketItem.task_id == "task-001").all()
    assert len(items) == 1
    assert items[0].material == "ABS"
    assert items[0].price == 14.99

"""Tests for file storage endpoints:
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
        "selectedFile": "test.obj",
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

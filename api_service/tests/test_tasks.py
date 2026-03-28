"""Tests for POST /tasks and PATCH /tasks/{task_id}/complete endpoints."""

import pytest
from fitd_schemas.fitd_db_schemas import Task, PortID


def test_create_task_success(client, seed_user, db_session):
    """POST /tasks creates a Task + PortID row when user exists."""
    response = client.post(
        "/tasks",
        json={
            "task_id": "task-new-001",
            "user_id": "test-user-123",
            "task_name": "My New Task",
            "port_id": "port-new-001",
        },
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 201

    # Verify task was created in DB
    task = db_session.query(Task).filter(Task.task_id == "task-new-001").first()
    assert task is not None
    assert task.user_id == "test-user-123"
    assert task.task_name == "My New Task"
    assert task.complete is False

    # Verify port was created
    port = db_session.query(PortID).filter(PortID.task_id == "task-new-001").first()
    assert port is not None
    assert port.port_id == "port-new-001"


def test_create_task_with_file_type(client, seed_user, db_session):
    """POST /tasks respects the file_type field."""
    response = client.post(
        "/tasks",
        json={
            "task_id": "task-step-001",
            "user_id": "test-user-123",
            "task_name": "STEP Task",
            "file_type": "step",
            "port_id": "port-step-001",
        },
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 201

    task = db_session.query(Task).filter(Task.task_id == "task-step-001").first()
    assert task is not None
    assert task.file_type == "step"


def test_create_task_defaults_file_type_to_obj(client, seed_user, db_session):
    """POST /tasks defaults file_type to 'obj' when not provided."""
    response = client.post(
        "/tasks",
        json={
            "task_id": "task-default-001",
            "user_id": "test-user-123",
            "task_name": "Default Type Task",
            "port_id": "port-default-001",
        },
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 201

    task = db_session.query(Task).filter(Task.task_id == "task-default-001").first()
    assert task is not None
    assert task.file_type == "obj"


def test_create_task_user_not_found(client, db_session):
    """POST /tasks does nothing when user does not exist."""
    response = client.post(
        "/tasks",
        json={
            "task_id": "task-orphan-001",
            "user_id": "nonexistent-user",
            "task_name": "Orphan Task",
            "port_id": "port-orphan-001",
        },
        headers={"Authorization": "Bearer fake"},
    )
    # Endpoint returns 201 with empty string regardless
    assert response.status_code == 201

    # But no task should be created
    task = db_session.query(Task).filter(Task.task_id == "task-orphan-001").first()
    assert task is None


def test_create_task_missing_port_id(client, seed_user, db_session):
    """POST /tasks does nothing when port_id is missing/None."""
    response = client.post(
        "/tasks",
        json={
            "task_id": "task-noport-001",
            "user_id": "test-user-123",
            "task_name": "No Port Task",
        },
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 201

    # No task should be created because port_id is None
    task = db_session.query(Task).filter(Task.task_id == "task-noport-001").first()
    assert task is None


def test_create_task_missing_task_id(client, seed_user, db_session):
    """POST /tasks does nothing when task_id is missing/None."""
    response = client.post(
        "/tasks",
        json={
            "user_id": "test-user-123",
            "task_name": "No TaskID Task",
            "port_id": "port-notaskid-001",
        },
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 201

    # No task should be created because task_id is None
    port = db_session.query(PortID).filter(PortID.port_id == "port-notaskid-001").first()
    assert port is None


# ── PATCH /tasks/{task_id}/complete ──────────────────────────────────────


def test_complete_task_success(client, seed_user, db_session):
    """PATCH /tasks/{task_id}/complete marks task as complete and removes port."""
    # First create a task
    client.post(
        "/tasks",
        json={
            "task_id": "task-complete-001",
            "user_id": "test-user-123",
            "task_name": "Task To Complete",
            "port_id": "port-complete-001",
        },
        headers={"Authorization": "Bearer fake"},
    )

    # Verify task is incomplete
    task = db_session.query(Task).filter(Task.task_id == "task-complete-001").first()
    assert task is not None
    assert task.complete is False

    # Verify port exists
    port = db_session.query(PortID).filter(PortID.task_id == "task-complete-001").first()
    assert port is not None

    # Complete the task
    response = client.patch(
        "/tasks/task-complete-001/complete",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Task marked as complete"

    # Verify task is now complete
    db_session.expire_all()
    task = db_session.query(Task).filter(Task.task_id == "task-complete-001").first()
    assert task.complete is True

    # Verify port was deleted
    port = db_session.query(PortID).filter(PortID.task_id == "task-complete-001").first()
    assert port is None


def test_complete_task_already_seeded(client, seed_task, db_session):
    """PATCH /tasks/{task_id}/complete works with the seed_task fixture."""
    response = client.patch(
        "/tasks/task-001/complete",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200

    db_session.expire_all()
    task = db_session.query(Task).filter(Task.task_id == "task-001").first()
    assert task.complete is True

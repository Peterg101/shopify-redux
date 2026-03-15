"""
Comprehensive endpoint tests for meshy_backend.

Tests cover all HTTP endpoints (POST /start_task/, POST /start_image_to_3d_task/,
POST /start_refine_task/, GET /health) and the WebSocket endpoint (/ws/{port_id}).

Background task functions are patched so they never execute — we only verify
that the endpoints schedule them correctly and return the right responses.
"""

import os

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-meshy")

import asyncio
import json
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient


# ============================================================================
# Helper payloads
# ============================================================================

def _text_to_3d_payload():
    """Valid body for POST /start_task/."""
    return {
        "port_id": "port-abc-123",
        "user_id": "user-test-001",
        "meshy_payload": {
            "mode": "preview",
            "prompt": "a small gear",
            "art_style": "realistic",
            "negative_prompt": "blurry",
            "ai_model": "meshy-4",
        },
    }


def _image_to_3d_payload():
    """Valid body for POST /start_image_to_3d_task/."""
    return {
        "port_id": "port-img-456",
        "user_id": "user-test-002",
        "meshy_image_to_3d_payload": {
            "image_url": "https://example.com/photo.png",
            "enable_pbr": True,
            "should_remesh": True,
            "should_texture": True,
            "ai_model": "meshy-4",
        },
        "filename": "photo.png",
    }


def _refine_payload():
    """Valid body for POST /start_refine_task/."""
    return {
        "port_id": "port-ref-789",
        "user_id": "user-test-003",
        "meshy_refine_payload": {
            "mode": "refine",
            "preview_task_id": "task-preview-111",
        },
    }


# ============================================================================
# GET /health
# ============================================================================

class TestHealthEndpoint:
    """GET /health — lightweight liveness probe."""

    def test_health_returns_ok(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    def test_health_does_not_require_auth(self, unauthenticated_client):
        """Health check should work without any authentication."""
        response = unauthenticated_client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


# ============================================================================
# POST /start_task/  (text-to-3D)
# ============================================================================

class TestStartTask:
    """POST /start_task/ — initiates text-to-3D generation."""

    @patch(
        "main.generate_task_and_check_for_response_decoupled_ws",
        new_callable=AsyncMock,
    )
    def test_valid_request_returns_200(self, mock_bg_task, client):
        payload = _text_to_3d_payload()
        response = client.post("/start_task/", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Task started!"
        assert data["task_id"] == payload["port_id"]

    @patch(
        "main.generate_task_and_check_for_response_decoupled_ws",
        new_callable=AsyncMock,
    )
    def test_background_task_is_scheduled(self, mock_bg_task, client):
        """The background task function should be called once after the
        endpoint returns (TestClient executes background tasks synchronously)."""
        payload = _text_to_3d_payload()
        client.post("/start_task/", json=payload)

        mock_bg_task.assert_called_once()
        # First positional arg is the TaskRequest pydantic model
        call_args = mock_bg_task.call_args
        task_request = call_args[0][0]
        assert task_request.port_id == "port-abc-123"
        assert task_request.user_id == "user-test-001"
        assert task_request.meshy_payload.prompt == "a small gear"

    @patch(
        "main.generate_task_and_check_for_response_decoupled_ws",
        new_callable=AsyncMock,
    )
    def test_missing_prompt_returns_422(self, mock_bg_task, client):
        """Omitting required fields in meshy_payload triggers validation error."""
        payload = {
            "port_id": "p1",
            "user_id": "u1",
            "meshy_payload": {
                "mode": "preview",
                # prompt is missing
                "art_style": "realistic",
                "negative_prompt": "",
                "ai_model": "meshy-4",
            },
        }
        response = client.post("/start_task/", json=payload)
        assert response.status_code == 422

    @patch(
        "main.generate_task_and_check_for_response_decoupled_ws",
        new_callable=AsyncMock,
    )
    def test_missing_meshy_payload_returns_422(self, mock_bg_task, client):
        """Omitting meshy_payload entirely triggers validation error."""
        payload = {"port_id": "p1", "user_id": "u1"}
        response = client.post("/start_task/", json=payload)
        assert response.status_code == 422

    @patch(
        "main.generate_task_and_check_for_response_decoupled_ws",
        new_callable=AsyncMock,
    )
    def test_empty_body_returns_422(self, mock_bg_task, client):
        response = client.post("/start_task/", json={})
        assert response.status_code == 422

    def test_unauthenticated_request_returns_401(self, unauthenticated_client):
        """Without the cookie_verification override, requests must be rejected."""
        payload = _text_to_3d_payload()
        response = unauthenticated_client.post("/start_task/", json=payload)
        assert response.status_code == 401

    @patch(
        "main.generate_task_and_check_for_response_decoupled_ws",
        new_callable=AsyncMock,
    )
    def test_optional_fields_accepted(self, mock_bg_task, client):
        """Optional fields (topology, target_polycount, symmetry_mode) are accepted."""
        payload = _text_to_3d_payload()
        payload["meshy_payload"]["topology"] = "quad"
        payload["meshy_payload"]["target_polycount"] = 50000
        payload["meshy_payload"]["symmetry_mode"] = "auto"

        response = client.post("/start_task/", json=payload)
        assert response.status_code == 200

        call_args = mock_bg_task.call_args
        task_request = call_args[0][0]
        assert task_request.meshy_payload.topology == "quad"
        assert task_request.meshy_payload.target_polycount == 50000
        assert task_request.meshy_payload.symmetry_mode == "auto"


# ============================================================================
# POST /start_image_to_3d_task/  (image-to-3D)
# ============================================================================

class TestStartImageTo3DTask:
    """POST /start_image_to_3d_task/ — initiates image-to-3D generation."""

    @patch(
        "main.generate_image_to_3d_task_and_check_for_response_decoupled_ws",
        new_callable=AsyncMock,
    )
    def test_valid_request_returns_200(self, mock_bg_task, client):
        payload = _image_to_3d_payload()
        response = client.post("/start_image_to_3d_task/", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Task started!"
        assert data["task_id"] == payload["port_id"]

    @patch(
        "main.generate_image_to_3d_task_and_check_for_response_decoupled_ws",
        new_callable=AsyncMock,
    )
    def test_background_task_receives_correct_args(self, mock_bg_task, client):
        payload = _image_to_3d_payload()
        client.post("/start_image_to_3d_task/", json=payload)

        mock_bg_task.assert_called_once()
        task_request = mock_bg_task.call_args[0][0]
        assert task_request.port_id == "port-img-456"
        assert task_request.user_id == "user-test-002"
        assert task_request.filename == "photo.png"
        assert task_request.meshy_image_to_3d_payload.image_url == "https://example.com/photo.png"
        assert task_request.meshy_image_to_3d_payload.enable_pbr is True

    @patch(
        "main.generate_image_to_3d_task_and_check_for_response_decoupled_ws",
        new_callable=AsyncMock,
    )
    def test_missing_image_url_returns_422(self, mock_bg_task, client):
        payload = {
            "port_id": "p1",
            "user_id": "u1",
            "meshy_image_to_3d_payload": {
                # image_url missing
                "enable_pbr": True,
                "should_remesh": True,
                "should_texture": True,
                "ai_model": "meshy-4",
            },
            "filename": "test.png",
        }
        response = client.post("/start_image_to_3d_task/", json=payload)
        assert response.status_code == 422

    @patch(
        "main.generate_image_to_3d_task_and_check_for_response_decoupled_ws",
        new_callable=AsyncMock,
    )
    def test_missing_filename_returns_422(self, mock_bg_task, client):
        """filename is a required top-level field on ImageTo3DTaskRequest."""
        payload = {
            "port_id": "p1",
            "user_id": "u1",
            "meshy_image_to_3d_payload": {
                "image_url": "https://example.com/img.png",
                "enable_pbr": True,
                "should_remesh": True,
                "should_texture": True,
                "ai_model": "meshy-4",
            },
            # filename missing
        }
        response = client.post("/start_image_to_3d_task/", json=payload)
        assert response.status_code == 422

    @patch(
        "main.generate_image_to_3d_task_and_check_for_response_decoupled_ws",
        new_callable=AsyncMock,
    )
    def test_empty_body_returns_422(self, mock_bg_task, client):
        response = client.post("/start_image_to_3d_task/", json={})
        assert response.status_code == 422

    def test_unauthenticated_request_returns_401(self, unauthenticated_client):
        payload = _image_to_3d_payload()
        response = unauthenticated_client.post(
            "/start_image_to_3d_task/", json=payload
        )
        assert response.status_code == 401

    @patch(
        "main.generate_image_to_3d_task_and_check_for_response_decoupled_ws",
        new_callable=AsyncMock,
    )
    def test_optional_fields_accepted(self, mock_bg_task, client):
        """Optional fields (topology, target_polycount, symmetry_mode, texture_prompt)."""
        payload = _image_to_3d_payload()
        payload["meshy_image_to_3d_payload"]["topology"] = "triangle"
        payload["meshy_image_to_3d_payload"]["target_polycount"] = 100000
        payload["meshy_image_to_3d_payload"]["texture_prompt"] = "metallic finish"

        response = client.post("/start_image_to_3d_task/", json=payload)
        assert response.status_code == 200

        task_request = mock_bg_task.call_args[0][0]
        assert task_request.meshy_image_to_3d_payload.topology == "triangle"
        assert task_request.meshy_image_to_3d_payload.target_polycount == 100000
        assert task_request.meshy_image_to_3d_payload.texture_prompt == "metallic finish"


# ============================================================================
# POST /start_refine_task/  (refinement)
# ============================================================================

class TestStartRefineTask:
    """POST /start_refine_task/ — initiates mesh refinement."""

    @patch(
        "main.generate_refine_task_and_stream",
        new_callable=AsyncMock,
    )
    def test_valid_request_returns_200(self, mock_bg_task, client):
        payload = _refine_payload()
        response = client.post("/start_refine_task/", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Refine task started!"
        assert data["task_id"] == payload["port_id"]

    @patch(
        "main.generate_refine_task_and_stream",
        new_callable=AsyncMock,
    )
    def test_background_task_receives_correct_args(self, mock_bg_task, client):
        payload = _refine_payload()
        client.post("/start_refine_task/", json=payload)

        mock_bg_task.assert_called_once()
        task_request = mock_bg_task.call_args[0][0]
        assert task_request.port_id == "port-ref-789"
        assert task_request.user_id == "user-test-003"
        assert task_request.meshy_refine_payload.preview_task_id == "task-preview-111"
        assert task_request.meshy_refine_payload.mode == "refine"

    @patch(
        "main.generate_refine_task_and_stream",
        new_callable=AsyncMock,
    )
    def test_missing_preview_task_id_returns_422(self, mock_bg_task, client):
        payload = {
            "port_id": "p1",
            "user_id": "u1",
            "meshy_refine_payload": {
                "mode": "refine",
                # preview_task_id missing
            },
        }
        response = client.post("/start_refine_task/", json=payload)
        assert response.status_code == 422

    @patch(
        "main.generate_refine_task_and_stream",
        new_callable=AsyncMock,
    )
    def test_missing_refine_payload_returns_422(self, mock_bg_task, client):
        payload = {"port_id": "p1", "user_id": "u1"}
        response = client.post("/start_refine_task/", json=payload)
        assert response.status_code == 422

    @patch(
        "main.generate_refine_task_and_stream",
        new_callable=AsyncMock,
    )
    def test_empty_body_returns_422(self, mock_bg_task, client):
        response = client.post("/start_refine_task/", json={})
        assert response.status_code == 422

    def test_unauthenticated_request_returns_401(self, unauthenticated_client):
        payload = _refine_payload()
        response = unauthenticated_client.post("/start_refine_task/", json=payload)
        assert response.status_code == 401

    @patch(
        "main.generate_refine_task_and_stream",
        new_callable=AsyncMock,
    )
    def test_optional_refine_fields_accepted(self, mock_bg_task, client):
        """Optional fields (enable_pbr, texture_prompt, remove_lighting)."""
        payload = _refine_payload()
        payload["meshy_refine_payload"]["enable_pbr"] = True
        payload["meshy_refine_payload"]["texture_prompt"] = "wood grain"
        payload["meshy_refine_payload"]["remove_lighting"] = False

        response = client.post("/start_refine_task/", json=payload)
        assert response.status_code == 200

        task_request = mock_bg_task.call_args[0][0]
        assert task_request.meshy_refine_payload.enable_pbr is True
        assert task_request.meshy_refine_payload.texture_prompt == "wood grain"
        assert task_request.meshy_refine_payload.remove_lighting is False


# ============================================================================
# WebSocket /ws/{port_id}
# ============================================================================

def _make_mock_redis_with_messages(messages):
    """Create a mock Redis client whose pubsub.listen() yields the given messages.

    Each message should be a dict with 'type' and 'data' keys, matching the
    real redis pubsub message format.
    """
    mock_pubsub = MagicMock()

    # Build an async generator from the message list
    async def _listen():
        for m in messages:
            yield m

    mock_pubsub.listen = _listen
    mock_pubsub.subscribe = AsyncMock()
    mock_pubsub.unsubscribe = AsyncMock()
    mock_pubsub.close = AsyncMock()

    mock_redis = MagicMock()
    mock_redis.pubsub.return_value = mock_pubsub
    return mock_redis, mock_pubsub


class TestWebSocketEndpoint:
    """WebSocket /ws/{port_id} — streams Redis pubsub progress to client."""

    def test_websocket_receives_progress_then_completes(self):
        """Simulate progress messages followed by 'Task Completed'.
        The WebSocket should relay each message and close after the terminal one."""
        from main import app, get_redis

        messages = [
            {"type": "subscribe", "data": 1},
            {"type": "message", "data": "10,task-1,a gear"},
            {"type": "message", "data": "50,task-1,a gear"},
            {"type": "message", "data": "Task Completed,task-1,a gear"},
        ]
        mock_redis, mock_pubsub = _make_mock_redis_with_messages(messages)

        async def override_redis():
            return mock_redis

        app.dependency_overrides[get_redis] = override_redis

        with patch.dict(os.environ, {"WS_AUTH_ENABLED": "false"}):
            test_client = TestClient(app)
            with test_client.websocket_connect("/ws/port-ws-test") as ws:
                msg1 = ws.receive_text()
                assert msg1 == "10,task-1,a gear"

                msg2 = ws.receive_text()
                assert msg2 == "50,task-1,a gear"

                msg3 = ws.receive_text()
                assert msg3 == "Task Completed,task-1,a gear"

        mock_pubsub.subscribe.assert_called_once_with("task_progress:port-ws-test")
        mock_pubsub.unsubscribe.assert_called_once_with("task_progress:port-ws-test")
        mock_pubsub.close.assert_called_once()

        app.dependency_overrides.clear()

    def test_websocket_stops_on_task_failed(self):
        """WebSocket should close after receiving 'Task Failed' message."""
        from main import app, get_redis

        messages = [
            {"type": "subscribe", "data": 1},
            {"type": "message", "data": "25,task-2,bracket"},
            {"type": "message", "data": "Task Failed,task-2,bracket"},
        ]
        mock_redis, mock_pubsub = _make_mock_redis_with_messages(messages)

        async def override_redis():
            return mock_redis

        app.dependency_overrides[get_redis] = override_redis

        with patch.dict(os.environ, {"WS_AUTH_ENABLED": "false"}):
            test_client = TestClient(app)
            with test_client.websocket_connect("/ws/port-fail-test") as ws:
                msg1 = ws.receive_text()
                assert msg1 == "25,task-2,bracket"

                msg2 = ws.receive_text()
                assert msg2 == "Task Failed,task-2,bracket"

        app.dependency_overrides.clear()

    def test_websocket_subscribes_to_correct_channel(self):
        """The pubsub subscription should use the port_id from the URL path."""
        from main import app, get_redis

        messages = [
            {"type": "subscribe", "data": 1},
            {"type": "message", "data": "Task Completed,t,p"},
        ]
        mock_redis, mock_pubsub = _make_mock_redis_with_messages(messages)

        async def override_redis():
            return mock_redis

        app.dependency_overrides[get_redis] = override_redis

        with patch.dict(os.environ, {"WS_AUTH_ENABLED": "false"}):
            test_client = TestClient(app)
            with test_client.websocket_connect("/ws/my-unique-port-id") as ws:
                ws.receive_text()

        mock_pubsub.subscribe.assert_called_once_with(
            "task_progress:my-unique-port-id"
        )
        app.dependency_overrides.clear()

    def test_websocket_skips_non_message_types(self):
        """Only 'message' type events should be forwarded; subscription
        confirmations (type='subscribe') should be silently skipped."""
        from main import app, get_redis

        messages = [
            {"type": "subscribe", "data": 1},
            {"type": "subscribe", "data": 2},  # extra non-message
            {"type": "message", "data": "Task Completed,t,done"},
        ]
        mock_redis, mock_pubsub = _make_mock_redis_with_messages(messages)

        async def override_redis():
            return mock_redis

        app.dependency_overrides[get_redis] = override_redis

        with patch.dict(os.environ, {"WS_AUTH_ENABLED": "false"}):
            test_client = TestClient(app)
            with test_client.websocket_connect("/ws/port-skip") as ws:
                msg = ws.receive_text()
                assert msg == "Task Completed,t,done"

        app.dependency_overrides.clear()

    def test_websocket_auth_rejection_when_enabled(self):
        """When WS_AUTH_ENABLED=true and validate_session returns False,
        the connection should be closed with code 1008."""
        from main import app, get_redis

        mock_redis, _ = _make_mock_redis_with_messages([])

        async def override_redis():
            return mock_redis

        app.dependency_overrides[get_redis] = override_redis

        with patch.dict(os.environ, {"WS_AUTH_ENABLED": "true"}):
            with patch("main.validate_session", new_callable=AsyncMock) as mock_vs:
                mock_vs.return_value = (False, None)
                test_client = TestClient(app)
                # When auth fails the server closes before accept(),
                # which raises an exception on the client side
                with pytest.raises(Exception):
                    with test_client.websocket_connect("/ws/port-noauth") as ws:
                        ws.receive_text()

        app.dependency_overrides.clear()

    def test_websocket_single_message_complete(self):
        """Edge case: task completes immediately with no intermediate progress."""
        from main import app, get_redis

        messages = [
            {"type": "subscribe", "data": 1},
            {"type": "message", "data": "Task Completed,task-instant,quick"},
        ]
        mock_redis, _ = _make_mock_redis_with_messages(messages)

        async def override_redis():
            return mock_redis

        app.dependency_overrides[get_redis] = override_redis

        with patch.dict(os.environ, {"WS_AUTH_ENABLED": "false"}):
            test_client = TestClient(app)
            with test_client.websocket_connect("/ws/port-instant") as ws:
                msg = ws.receive_text()
                assert msg == "Task Completed,task-instant,quick"

        app.dependency_overrides.clear()


# ============================================================================
# Cross-cutting: response format consistency
# ============================================================================

class TestResponseFormat:
    """Verify that successful POST responses share a consistent shape."""

    @patch(
        "main.generate_task_and_check_for_response_decoupled_ws",
        new_callable=AsyncMock,
    )
    def test_start_task_response_has_message_and_task_id(self, mock_bg, client):
        resp = client.post("/start_task/", json=_text_to_3d_payload())
        data = resp.json()
        assert "message" in data
        assert "task_id" in data
        assert isinstance(data["message"], str)
        assert isinstance(data["task_id"], str)

    @patch(
        "main.generate_image_to_3d_task_and_check_for_response_decoupled_ws",
        new_callable=AsyncMock,
    )
    def test_image_to_3d_response_has_message_and_task_id(self, mock_bg, client):
        resp = client.post("/start_image_to_3d_task/", json=_image_to_3d_payload())
        data = resp.json()
        assert "message" in data
        assert "task_id" in data

    @patch(
        "main.generate_refine_task_and_stream",
        new_callable=AsyncMock,
    )
    def test_refine_response_has_message_and_task_id(self, mock_bg, client):
        resp = client.post("/start_refine_task/", json=_refine_payload())
        data = resp.json()
        assert "message" in data
        assert "task_id" in data

    @patch(
        "main.generate_task_and_check_for_response_decoupled_ws",
        new_callable=AsyncMock,
    )
    def test_task_id_matches_port_id(self, mock_bg, client):
        """The returned task_id should equal the port_id from the request."""
        payload = _text_to_3d_payload()
        resp = client.post("/start_task/", json=payload)
        assert resp.json()["task_id"] == payload["port_id"]

    @patch(
        "main.generate_image_to_3d_task_and_check_for_response_decoupled_ws",
        new_callable=AsyncMock,
    )
    def test_image_task_id_matches_port_id(self, mock_bg, client):
        payload = _image_to_3d_payload()
        resp = client.post("/start_image_to_3d_task/", json=payload)
        assert resp.json()["task_id"] == payload["port_id"]

    @patch(
        "main.generate_refine_task_and_stream",
        new_callable=AsyncMock,
    )
    def test_refine_task_id_matches_port_id(self, mock_bg, client):
        payload = _refine_payload()
        resp = client.post("/start_refine_task/", json=payload)
        assert resp.json()["task_id"] == payload["port_id"]


# ============================================================================
# Edge cases and method validation
# ============================================================================

class TestMethodAndRouting:
    """Verify correct HTTP methods and routing."""

    def test_get_on_start_task_returns_405(self, client):
        """POST endpoints should reject GET requests."""
        response = client.get("/start_task/")
        assert response.status_code == 405

    def test_get_on_image_to_3d_returns_405(self, client):
        response = client.get("/start_image_to_3d_task/")
        assert response.status_code == 405

    def test_get_on_refine_task_returns_405(self, client):
        response = client.get("/start_refine_task/")
        assert response.status_code == 405

    def test_post_on_health_returns_405(self, client):
        """Health endpoint is GET-only."""
        response = client.post("/health")
        assert response.status_code == 405

    @patch(
        "main.generate_task_and_check_for_response_decoupled_ws",
        new_callable=AsyncMock,
    )
    def test_non_json_body_returns_422(self, mock_bg, client):
        """Sending non-JSON content should fail validation."""
        response = client.post(
            "/start_task/",
            content="not json",
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 422

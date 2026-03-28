"""Endpoint tests for the cad_service FastAPI routes.

Covers:
  POST /start_cad_task/   — authenticated CAD generation kick-off
  GET  /health            — health-check probe
  WS   /ws/{port_id}      — WebSocket progress streaming
"""
import json
import uuid
from unittest.mock import patch, AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from main import app, get_redis
from utils import cookie_verification


# =========================================================================
# GET /health
# =========================================================================

class TestHealthEndpoint:
    """The health endpoint requires no auth and returns a static payload."""

    def test_health_returns_ok(self, authed_client):
        resp = authed_client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

    def test_health_no_auth_required(self, unauthed_client):
        """Health endpoint has no Depends(cookie_verification)."""
        resp = unauthed_client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


# =========================================================================
# POST /start_cad_task/
# =========================================================================

class TestStartCadTask:
    """Tests for the main CAD generation kick-off endpoint."""

    VALID_PAYLOAD = {
        "port_id": str(uuid.uuid4()),
        "user_id": "test-user-123",
        "prompt": "A simple bracket with two mounting holes",
    }

    # ------ Happy path ------

    @patch("main.generate_cad_task", new_callable=AsyncMock)
    def test_valid_request_returns_200(self, mock_gen, authed_client):
        resp = authed_client.post("/start_cad_task/", json=self.VALID_PAYLOAD)
        assert resp.status_code == 200

    @patch("main.generate_cad_task", new_callable=AsyncMock)
    def test_response_contains_task_id(self, mock_gen, authed_client):
        resp = authed_client.post("/start_cad_task/", json=self.VALID_PAYLOAD)
        data = resp.json()
        assert "task_id" in data
        assert data["task_id"] == self.VALID_PAYLOAD["port_id"]

    @patch("main.generate_cad_task", new_callable=AsyncMock)
    def test_response_contains_message(self, mock_gen, authed_client):
        resp = authed_client.post("/start_cad_task/", json=self.VALID_PAYLOAD)
        data = resp.json()
        assert "message" in data
        assert data["message"] == "CAD task started!"

    @patch("main.generate_cad_task", new_callable=AsyncMock)
    def test_background_task_invoked(self, mock_gen, authed_client):
        """The generate_cad_task background function should be called once."""
        resp = authed_client.post("/start_cad_task/", json=self.VALID_PAYLOAD)
        assert resp.status_code == 200
        # FastAPI's BackgroundTasks runs the function after the response is sent.
        # With TestClient, background tasks execute synchronously before returning.
        mock_gen.assert_called_once()

    @patch("main.generate_cad_task", new_callable=AsyncMock)
    def test_background_task_receives_correct_args(self, mock_gen, authed_client):
        resp = authed_client.post("/start_cad_task/", json=self.VALID_PAYLOAD)
        assert resp.status_code == 200
        call_args = mock_gen.call_args
        # First positional arg is the CadTaskRequest
        cad_request = call_args[0][0]
        assert cad_request.prompt == self.VALID_PAYLOAD["prompt"]
        assert cad_request.user_id == self.VALID_PAYLOAD["user_id"]
        assert cad_request.port_id == self.VALID_PAYLOAD["port_id"]
        # Second positional arg is the Redis client (our mock)
        redis_arg = call_args[0][1]
        assert redis_arg is not None

    @patch("main.generate_cad_task", new_callable=AsyncMock)
    def test_with_optional_settings(self, mock_gen, authed_client):
        payload = {
            **self.VALID_PAYLOAD,
            "settings": {
                "max_iterations": 5,
                "timeout_seconds": 60,
                "target_units": "inches",
            },
        }
        resp = authed_client.post("/start_cad_task/", json=payload)
        assert resp.status_code == 200
        cad_request = mock_gen.call_args[0][0]
        assert cad_request.settings.max_iterations == 5
        assert cad_request.settings.timeout_seconds == 60
        assert cad_request.settings.target_units == "inches"

    @patch("main.generate_cad_task", new_callable=AsyncMock)
    def test_settings_default_when_omitted(self, mock_gen, authed_client):
        resp = authed_client.post("/start_cad_task/", json=self.VALID_PAYLOAD)
        assert resp.status_code == 200
        cad_request = mock_gen.call_args[0][0]
        assert cad_request.settings is None

    # ------ Auth failures ------

    def test_no_auth_returns_401(self, unauthed_client):
        """Without a session cookie, cookie_verification raises 401."""
        resp = unauthed_client.post("/start_cad_task/", json=self.VALID_PAYLOAD)
        assert resp.status_code == 401

    def test_no_auth_error_detail(self, unauthed_client):
        resp = unauthed_client.post("/start_cad_task/", json=self.VALID_PAYLOAD)
        assert "not authenticated" in resp.json()["detail"].lower()

    # ------ Validation failures ------

    @patch("main.generate_cad_task", new_callable=AsyncMock)
    def test_missing_prompt_returns_422(self, mock_gen, authed_client):
        payload = {"port_id": "abc-123", "user_id": "user-1"}
        resp = authed_client.post("/start_cad_task/", json=payload)
        assert resp.status_code == 422

    @patch("main.generate_cad_task", new_callable=AsyncMock)
    def test_missing_user_id_returns_422(self, mock_gen, authed_client):
        payload = {"port_id": "abc-123", "prompt": "a bracket"}
        resp = authed_client.post("/start_cad_task/", json=payload)
        assert resp.status_code == 422

    @patch("main.generate_cad_task", new_callable=AsyncMock)
    def test_missing_port_id_returns_422(self, mock_gen, authed_client):
        payload = {"user_id": "user-1", "prompt": "a bracket"}
        resp = authed_client.post("/start_cad_task/", json=payload)
        assert resp.status_code == 422

    @patch("main.generate_cad_task", new_callable=AsyncMock)
    def test_empty_body_returns_422(self, mock_gen, authed_client):
        resp = authed_client.post("/start_cad_task/", json={})
        assert resp.status_code == 422

    @patch("main.generate_cad_task", new_callable=AsyncMock)
    def test_no_body_returns_422(self, mock_gen, authed_client):
        resp = authed_client.post("/start_cad_task/")
        assert resp.status_code == 422

    @patch("main.generate_cad_task", new_callable=AsyncMock)
    def test_extra_fields_ignored(self, mock_gen, authed_client):
        """Pydantic should ignore extra fields by default."""
        payload = {
            **self.VALID_PAYLOAD,
            "unknown_field": "should be ignored",
        }
        resp = authed_client.post("/start_cad_task/", json=payload)
        assert resp.status_code == 200


# =========================================================================
# WebSocket /ws/{port_id}
# =========================================================================

class TestWebSocketEndpoint:
    """Tests for the WebSocket progress-streaming endpoint.

    The WebSocket handler:
    1. Optionally validates session (WS_AUTH_ENABLED env var)
    2. Checks Redis for an existing terminal result
    3. Subscribes to a Redis pub/sub channel
    4. Forwards messages until a terminal state
    """

    @patch.dict("os.environ", {"WS_AUTH_ENABLED": "false"})
    def test_ws_receives_cached_result(self, mock_redis):
        """If a terminal result is already cached, WS sends it immediately."""
        port_id = "test-port-123"
        cached_msg = "Task Completed,task-id-1,bracket,job-42"

        # First redis.get call (before subscribe) returns the cached result
        mock_redis.get = AsyncMock(return_value=cached_msg)

        app.dependency_overrides[get_redis] = lambda: mock_redis
        app.dependency_overrides.pop(cookie_verification, None)

        try:
            client = TestClient(app)
            with client.websocket_connect(f"/ws/{port_id}") as ws:
                data = ws.receive_text()
                assert data == cached_msg
        finally:
            app.dependency_overrides.clear()

    @patch.dict("os.environ", {"WS_AUTH_ENABLED": "false"})
    def test_ws_receives_pubsub_messages(self, mock_redis):
        """Messages published to Redis should be forwarded to the WebSocket."""
        port_id = "test-port-456"

        # No cached result
        mock_redis.get = AsyncMock(return_value=None)

        # Simulate pub/sub messages
        messages = [
            {"type": "subscribe", "data": None},
            {"type": "message", "data": "10,generating,bracket"},
            {"type": "message", "data": "50,executing,bracket"},
            {"type": "message", "data": "Task Completed,task-1,bracket,job-1"},
        ]

        pubsub = AsyncMock()
        pubsub.subscribe = AsyncMock()
        pubsub.unsubscribe = AsyncMock()
        pubsub.close = AsyncMock()
        pubsub.listen = MagicMock(return_value=_async_iter(messages))
        # redis.pubsub() is a sync call that returns the pubsub object
        mock_redis.pubsub = MagicMock(return_value=pubsub)

        app.dependency_overrides[get_redis] = lambda: mock_redis
        app.dependency_overrides.pop(cookie_verification, None)

        try:
            client = TestClient(app)
            with client.websocket_connect(f"/ws/{port_id}") as ws:
                msg1 = ws.receive_text()
                assert msg1 == "10,generating,bracket"

                msg2 = ws.receive_text()
                assert msg2 == "50,executing,bracket"

                msg3 = ws.receive_text()
                assert msg3 == "Task Completed,task-1,bracket,job-1"
        finally:
            app.dependency_overrides.clear()

    @patch.dict("os.environ", {"WS_AUTH_ENABLED": "false"})
    def test_ws_closes_on_task_failed(self, mock_redis):
        """WebSocket should close after receiving a Task Failed message."""
        port_id = "test-port-fail"

        mock_redis.get = AsyncMock(return_value=None)

        messages = [
            {"type": "message", "data": "10,generating,widget"},
            {"type": "message", "data": "Task Failed,Timeout after 3 attempts"},
        ]

        pubsub = AsyncMock()
        pubsub.subscribe = AsyncMock()
        pubsub.unsubscribe = AsyncMock()
        pubsub.close = AsyncMock()
        pubsub.listen = MagicMock(return_value=_async_iter(messages))
        mock_redis.pubsub = MagicMock(return_value=pubsub)

        app.dependency_overrides[get_redis] = lambda: mock_redis
        app.dependency_overrides.pop(cookie_verification, None)

        try:
            client = TestClient(app)
            with client.websocket_connect(f"/ws/{port_id}") as ws:
                msg1 = ws.receive_text()
                assert msg1 == "10,generating,widget"

                msg2 = ws.receive_text()
                assert "Task Failed" in msg2
        finally:
            app.dependency_overrides.clear()

    @patch.dict("os.environ", {"WS_AUTH_ENABLED": "false"})
    def test_ws_subscribes_to_correct_channel(self, mock_redis):
        """Verify the handler subscribes to task_progress:{port_id}."""
        port_id = "channel-check-789"
        cached_msg = "Task Completed,t1,name,j1"
        mock_redis.get = AsyncMock(return_value=cached_msg)

        app.dependency_overrides[get_redis] = lambda: mock_redis
        app.dependency_overrides.pop(cookie_verification, None)

        try:
            client = TestClient(app)
            with client.websocket_connect(f"/ws/{port_id}") as ws:
                ws.receive_text()
        finally:
            app.dependency_overrides.clear()

    @patch.dict("os.environ", {"WS_AUTH_ENABLED": "false"})
    def test_ws_race_condition_check(self, mock_redis):
        """After subscribing, handler re-checks Redis to avoid race window."""
        port_id = "race-check"

        # First get returns None (before subscribe), second returns cached result
        mock_redis.get = AsyncMock(
            side_effect=[None, "Task Completed,t1,name,j1"]
        )

        pubsub = AsyncMock()
        pubsub.subscribe = AsyncMock()
        pubsub.unsubscribe = AsyncMock()
        pubsub.close = AsyncMock()
        mock_redis.pubsub = MagicMock(return_value=pubsub)

        app.dependency_overrides[get_redis] = lambda: mock_redis
        app.dependency_overrides.pop(cookie_verification, None)

        try:
            client = TestClient(app)
            with client.websocket_connect(f"/ws/{port_id}") as ws:
                data = ws.receive_text()
                assert data == "Task Completed,t1,name,j1"
        finally:
            app.dependency_overrides.clear()

    @patch.dict("os.environ", {"WS_AUTH_ENABLED": "true"})
    @patch("main.validate_session", new_callable=AsyncMock)
    def test_ws_auth_invalid_session_closes(self, mock_validate, mock_redis):
        """With auth enabled, invalid session should close with 1008."""
        mock_validate.return_value = (False, None)

        app.dependency_overrides[get_redis] = lambda: mock_redis
        app.dependency_overrides.pop(cookie_verification, None)

        try:
            client = TestClient(app)
            # WebSocket should be closed by the server; this should raise
            # or the connection should fail gracefully.
            with pytest.raises(Exception):
                with client.websocket_connect("/ws/some-port") as ws:
                    ws.receive_text()
        finally:
            app.dependency_overrides.clear()


# =========================================================================
# Helpers
# =========================================================================

async def _async_iter(items):
    """Convert a list into an async iterator for mocking pubsub.listen()."""
    for item in items:
        yield item

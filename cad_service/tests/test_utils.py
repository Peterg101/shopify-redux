"""Unit tests for cad_service/utils.py utility functions.

Covers:
  - publish()           — Redis pub/sub + terminal state caching
  - register_task()     — POST to db_service to register a new task
  - upload_step_file()  — Multipart POST to step_service
  - mark_task_complete() — PATCH to db_service to mark task done
  - validate_session()  — WebSocket session cookie validation
  - http_session_exists() — HTTP session check against auth_backend
"""
import os
import tempfile
from unittest.mock import patch, AsyncMock, MagicMock, PropertyMock

import pytest
import httpx

from utils import (
    publish,
    register_task,
    upload_step_file,
    mark_task_complete,
    validate_session,
    http_session_exists,
)


# =========================================================================
# publish()
# =========================================================================

class TestPublish:
    """Test the Redis publish + terminal-state caching helper."""

    @pytest.mark.asyncio
    async def test_publishes_to_correct_channel(self):
        redis = AsyncMock()
        redis.publish = AsyncMock()
        redis.set = AsyncMock()

        await publish(redis, "port-123", "50,executing,bracket")

        redis.publish.assert_called_once_with(
            "task_progress:port-123", "50,executing,bracket"
        )

    @pytest.mark.asyncio
    async def test_progress_message_not_cached(self):
        """Non-terminal messages should NOT be stored in Redis."""
        redis = AsyncMock()
        redis.publish = AsyncMock()
        redis.set = AsyncMock()

        await publish(redis, "port-123", "50,executing,bracket")

        redis.set.assert_not_called()

    @pytest.mark.asyncio
    async def test_task_completed_cached(self):
        """Terminal 'Task Completed' message should be cached with TTL."""
        redis = AsyncMock()
        redis.publish = AsyncMock()
        redis.set = AsyncMock()

        msg = "Task Completed,task-1,bracket,job-42"
        await publish(redis, "port-abc", msg)

        redis.set.assert_called_once_with("task_result:port-abc", msg, ex=300)

    @pytest.mark.asyncio
    async def test_task_failed_cached(self):
        """Terminal 'Task Failed' message should also be cached."""
        redis = AsyncMock()
        redis.publish = AsyncMock()
        redis.set = AsyncMock()

        msg = "Task Failed,Generation failed after 3 attempts"
        await publish(redis, "port-xyz", msg)

        redis.set.assert_called_once_with("task_result:port-xyz", msg, ex=300)

    @pytest.mark.asyncio
    async def test_cache_ttl_is_300_seconds(self):
        """Verify the TTL is exactly 300 seconds (5 minutes)."""
        redis = AsyncMock()
        redis.publish = AsyncMock()
        redis.set = AsyncMock()

        await publish(redis, "p1", "Task Completed,t,n,j")

        _, kwargs = redis.set.call_args
        assert kwargs["ex"] == 300


# =========================================================================
# register_task()
# =========================================================================

class TestRegisterTask:
    """Test HTTP POST to db_service for task registration."""

    @pytest.mark.asyncio
    @patch("utils.generate_token", return_value="mock-jwt-token")
    async def test_successful_registration_returns_task_id(self, mock_token):
        mock_response = AsyncMock()
        mock_response.status_code = 201
        mock_response.text = ""

        mock_client_instance = AsyncMock()
        mock_client_instance.post = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)

        with patch("utils.httpx.AsyncClient", return_value=mock_client_instance):
            result = await register_task("user-1", "bracket", "port-1")

        assert result is not None
        # The returned task_id is a UUID string generated inside the function
        assert len(result) == 36  # UUID format: 8-4-4-4-12

    @pytest.mark.asyncio
    @patch("utils.generate_token", return_value="mock-jwt-token")
    async def test_registration_sends_correct_payload(self, mock_token):
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.text = ""

        mock_client_instance = AsyncMock()
        mock_client_instance.post = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)

        with patch("utils.httpx.AsyncClient", return_value=mock_client_instance):
            result = await register_task("user-42", "gear housing", "port-99")

        call_kwargs = mock_client_instance.post.call_args
        payload = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
        assert payload["user_id"] == "user-42"
        assert payload["task_name"] == "gear housing"
        assert payload["port_id"] == "port-99"
        assert payload["file_type"] == "step"

    @pytest.mark.asyncio
    @patch("utils.generate_token", return_value="mock-jwt-token")
    async def test_registration_sends_auth_header(self, mock_token):
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.text = ""

        mock_client_instance = AsyncMock()
        mock_client_instance.post = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)

        with patch("utils.httpx.AsyncClient", return_value=mock_client_instance):
            await register_task("u1", "name", "p1")

        call_kwargs = mock_client_instance.post.call_args
        headers = call_kwargs.kwargs.get("headers") or call_kwargs[1].get("headers")
        assert headers["Authorization"] == "Bearer mock-jwt-token"

    @pytest.mark.asyncio
    @patch("utils.generate_token", return_value="mock-jwt-token")
    async def test_registration_failure_returns_none(self, mock_token):
        mock_response = AsyncMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        mock_client_instance = AsyncMock()
        mock_client_instance.post = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)

        with patch("utils.httpx.AsyncClient", return_value=mock_client_instance):
            result = await register_task("u1", "name", "p1")

        assert result is None

    @pytest.mark.asyncio
    @patch("utils.generate_token", return_value="mock-jwt-token")
    async def test_registration_network_error_returns_none(self, mock_token):
        mock_client_instance = AsyncMock()
        mock_client_instance.post = AsyncMock(side_effect=httpx.ConnectError("Connection refused"))
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)

        with patch("utils.httpx.AsyncClient", return_value=mock_client_instance):
            result = await register_task("u1", "name", "p1")

        assert result is None

    @pytest.mark.asyncio
    @patch("utils.generate_token", return_value="mock-jwt-token")
    async def test_registration_accepts_200_and_201(self, mock_token):
        """Both 200 and 201 should be treated as success."""
        for status in (200, 201):
            mock_response = AsyncMock()
            mock_response.status_code = status
            mock_response.text = ""

            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_response)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=False)

            with patch("utils.httpx.AsyncClient", return_value=mock_client_instance):
                result = await register_task("u1", "name", "p1")

            assert result is not None, f"Expected success for status {status}"


# =========================================================================
# upload_step_file()
# =========================================================================

class TestUploadStepFile:
    """Test multipart POST to step_service for STEP file upload."""

    @pytest.mark.asyncio
    async def test_successful_upload_returns_job_id(self):
        # Create a temporary STEP file
        with tempfile.NamedTemporaryFile(suffix=".step", delete=False, mode="w") as f:
            f.write("ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;")
            tmp_path = f.name

        try:
            # Use MagicMock for the response because .json() is synchronous
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"job_id": "job-abc-123"}

            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_response)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=False)

            with patch("utils.httpx.AsyncClient", return_value=mock_client_instance):
                result = await upload_step_file(tmp_path, "user-1", "task-1")

            assert result == "job-abc-123"
        finally:
            os.unlink(tmp_path)

    @pytest.mark.asyncio
    async def test_upload_sends_correct_form_data(self):
        with tempfile.NamedTemporaryFile(suffix=".step", delete=False, mode="w") as f:
            f.write("STEP content")
            tmp_path = f.name

        try:
            mock_response = MagicMock()
            mock_response.status_code = 201
            mock_response.json.return_value = {"job_id": "j1"}

            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_response)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=False)

            with patch("utils.httpx.AsyncClient", return_value=mock_client_instance):
                await upload_step_file(tmp_path, "user-42", "task-99")

            call_kwargs = mock_client_instance.post.call_args
            # Check form data field
            data = call_kwargs.kwargs.get("data") or call_kwargs[1].get("data")
            assert data["user_id"] == "user-42"
            assert data["task_id"] == "task-99"
        finally:
            os.unlink(tmp_path)

    @pytest.mark.asyncio
    async def test_upload_failure_returns_none(self):
        with tempfile.NamedTemporaryFile(suffix=".step", delete=False, mode="w") as f:
            f.write("STEP content")
            tmp_path = f.name

        try:
            mock_response = AsyncMock()
            mock_response.status_code = 500
            mock_response.text = "Server Error"

            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_response)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=False)

            with patch("utils.httpx.AsyncClient", return_value=mock_client_instance):
                result = await upload_step_file(tmp_path, "u1", "t1")

            assert result is None
        finally:
            os.unlink(tmp_path)

    @pytest.mark.asyncio
    async def test_upload_file_not_found_returns_none(self):
        """If the STEP file doesn't exist, should return None gracefully."""
        result = await upload_step_file("/nonexistent/path/output.step", "u1", "t1")
        assert result is None

    @pytest.mark.asyncio
    async def test_upload_network_error_returns_none(self):
        with tempfile.NamedTemporaryFile(suffix=".step", delete=False, mode="w") as f:
            f.write("STEP content")
            tmp_path = f.name

        try:
            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(
                side_effect=httpx.ConnectError("Connection refused")
            )
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=False)

            with patch("utils.httpx.AsyncClient", return_value=mock_client_instance):
                result = await upload_step_file(tmp_path, "u1", "t1")

            assert result is None
        finally:
            os.unlink(tmp_path)


# =========================================================================
# mark_task_complete()
# =========================================================================

class TestMarkTaskComplete:
    """Test PATCH to db_service to mark a task as complete."""

    @pytest.mark.asyncio
    @patch("utils.generate_token", return_value="mock-jwt-token")
    async def test_successful_mark_complete(self, mock_token):
        mock_response = AsyncMock()
        mock_response.status_code = 200

        mock_client_instance = AsyncMock()
        mock_client_instance.patch = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)

        with patch("utils.httpx.AsyncClient", return_value=mock_client_instance):
            # Should not raise
            await mark_task_complete("task-123")

        mock_client_instance.patch.assert_called_once()

    @pytest.mark.asyncio
    @patch("utils.generate_token", return_value="mock-jwt-token")
    async def test_mark_complete_sends_auth_header(self, mock_token):
        mock_response = AsyncMock()
        mock_response.status_code = 200

        mock_client_instance = AsyncMock()
        mock_client_instance.patch = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)

        with patch("utils.httpx.AsyncClient", return_value=mock_client_instance):
            await mark_task_complete("task-123")

        call_kwargs = mock_client_instance.patch.call_args
        headers = call_kwargs.kwargs.get("headers") or call_kwargs[1].get("headers")
        assert headers["Authorization"] == "Bearer mock-jwt-token"

    @pytest.mark.asyncio
    @patch("utils.generate_token", return_value="mock-jwt-token")
    async def test_mark_complete_calls_correct_url(self, mock_token):
        mock_response = AsyncMock()
        mock_response.status_code = 200

        mock_client_instance = AsyncMock()
        mock_client_instance.patch = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)

        with patch("utils.httpx.AsyncClient", return_value=mock_client_instance):
            await mark_task_complete("task-xyz-789")

        call_args = mock_client_instance.patch.call_args
        url = call_args[0][0] if call_args[0] else call_args.kwargs.get("url", "")
        assert "task-xyz-789" in url
        assert "/complete" in url

    @pytest.mark.asyncio
    @patch("utils.generate_token", return_value="mock-jwt-token")
    async def test_mark_complete_failure_does_not_raise(self, mock_token):
        """Failures should be logged but not raised (fire-and-forget)."""
        mock_response = AsyncMock()
        mock_response.status_code = 404
        mock_response.text = "Not found"

        mock_client_instance = AsyncMock()
        mock_client_instance.patch = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)

        with patch("utils.httpx.AsyncClient", return_value=mock_client_instance):
            # Should not raise
            await mark_task_complete("nonexistent-task")

    @pytest.mark.asyncio
    @patch("utils.generate_token", return_value="mock-jwt-token")
    async def test_mark_complete_network_error_does_not_raise(self, mock_token):
        mock_client_instance = AsyncMock()
        mock_client_instance.patch = AsyncMock(
            side_effect=httpx.ConnectError("Connection refused")
        )
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)

        with patch("utils.httpx.AsyncClient", return_value=mock_client_instance):
            # Should not raise
            await mark_task_complete("task-1")


# =========================================================================
# validate_session()
# =========================================================================

class TestValidateSession:
    """Test WebSocket session validation."""

    @pytest.mark.asyncio
    @patch("utils.http_session_exists")
    async def test_valid_session(self, mock_session_check):
        mock_session_check.return_value = {"user": {"user_id": "user-123"}}

        ws = MagicMock()
        ws.cookies = {"fitd_session_data": "valid-session-id"}

        valid, user_id = await validate_session(ws)

        assert valid is True
        assert user_id == "user-123"

    @pytest.mark.asyncio
    @patch("utils.http_session_exists")
    async def test_missing_cookie(self, mock_session_check):
        ws = MagicMock()
        ws.cookies = {}

        valid, user_id = await validate_session(ws)

        assert valid is False
        assert user_id is None
        mock_session_check.assert_not_called()

    @pytest.mark.asyncio
    @patch("utils.http_session_exists")
    async def test_invalid_session(self, mock_session_check):
        mock_session_check.return_value = None

        ws = MagicMock()
        ws.cookies = {"fitd_session_data": "expired-session"}

        valid, user_id = await validate_session(ws)

        assert valid is False
        assert user_id is None


# =========================================================================
# http_session_exists()
# =========================================================================

class TestHttpSessionExists:
    """Test the HTTP call to auth_backend to check sessions."""

    @pytest.mark.asyncio
    async def test_valid_session_returns_data(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"user_id": "user-42"}

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)

        with patch("utils.httpx.AsyncClient", return_value=mock_client_instance):
            result = await http_session_exists("session-abc")

        assert result == {"user_id": "user-42"}

    @pytest.mark.asyncio
    async def test_invalid_session_returns_none(self):
        mock_response = AsyncMock()
        mock_response.status_code = 401

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)

        with patch("utils.httpx.AsyncClient", return_value=mock_client_instance):
            result = await http_session_exists("bad-session")

        assert result is None

    @pytest.mark.asyncio
    async def test_network_error_returns_none(self):
        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(
            side_effect=httpx.ConnectError("Connection refused")
        )
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)

        with patch("utils.httpx.AsyncClient", return_value=mock_client_instance):
            result = await http_session_exists("any-session")

        assert result is None

    @pytest.mark.asyncio
    async def test_sends_cookie_in_request(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"user_id": "u1"}

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)

        with patch("utils.httpx.AsyncClient", return_value=mock_client_instance):
            await http_session_exists("my-session-123")

        call_kwargs = mock_client_instance.get.call_args
        cookies = call_kwargs.kwargs.get("cookies") or call_kwargs[1].get("cookies")
        assert cookies["fitd_session_data"] == "my-session-123"

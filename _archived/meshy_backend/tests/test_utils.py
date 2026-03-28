import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException


@pytest.mark.asyncio
async def test_cookie_verification_no_cookie():
    from utils import cookie_verification
    mock_request = MagicMock()
    mock_request.cookies.get.return_value = None

    with pytest.raises(HTTPException) as exc_info:
        await cookie_verification(mock_request)
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
@patch("utils.http_session_exists", new_callable=AsyncMock)
async def test_cookie_verification_invalid_session(mock_session):
    from utils import cookie_verification
    mock_session.return_value = False
    mock_request = MagicMock()
    mock_request.cookies.get.return_value = "invalid-session-id"

    with pytest.raises(HTTPException) as exc_info:
        await cookie_verification(mock_request)
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
@patch("utils.http_session_exists", new_callable=AsyncMock)
async def test_cookie_verification_valid_session(mock_session):
    from utils import cookie_verification
    mock_session.return_value = True
    mock_request = MagicMock()
    mock_request.cookies.get.return_value = "valid-session-id"

    result = await cookie_verification(mock_request)
    assert result is None


@pytest.mark.asyncio
@patch("api_calls.httpx.AsyncClient")
async def test_create_task_posts_to_db(mock_client_class):
    from api_calls import create_task
    from fitd_schemas.fitd_classes import TaskInformation

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"message": "ok"}

    mock_async_client = AsyncMock()
    mock_async_client.post.return_value = mock_response
    mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
    mock_async_client.__aexit__ = AsyncMock(return_value=None)
    mock_client_class.return_value = mock_async_client

    task_info = TaskInformation(
        task_id="t1", user_id="u1", task_name="Test", port_id="p1"
    )
    result = await create_task(task_info)
    assert result == {"message": "ok"}

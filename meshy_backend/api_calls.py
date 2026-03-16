import os
import logging
import json
from io import BytesIO
import httpx
from httpx_sse import aconnect_sse
from jwt_auth import generate_token
from fitd_schemas.fitd_classes import (
    MeshyRefinedPayload,
    MeshyTaskGeneratedResponse,
    MeshyTaskStatus,
    MeshyTaskStatusResponse,
    TaskInformation,
    UserAndTasks,
    MeshyImageTo3DPayload,
    ImageTo3DMeshyTaskStatusResponse,
    MeshyPayload,
    MeshyTaskGeneratedResponse
)

logger = logging.getLogger(__name__)

MESHY_API_KEY = os.getenv("MESHY_API_KEY")
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://localhost:2468")
DB_SERVICE_URL = os.getenv("DB_SERVICE_URL", "http://localhost:8000")


async def generate_text_to_3d_task(payload: MeshyPayload) -> MeshyTaskGeneratedResponse:
    headers = {"Authorization": f"Bearer {MESHY_API_KEY}"}
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.meshy.ai/openapi/v2/text-to-3d/", headers=headers, json=payload.__dict__
            )
            response.raise_for_status()
            result = MeshyTaskGeneratedResponse(**response.json())
            return result

    except httpx.HTTPStatusError as e:
        logger.error(f"Request failed: {e}")
        return None


async def generate_image_to_3d_task(
    payload: MeshyImageTo3DPayload,
) -> MeshyTaskGeneratedResponse:
    headers = {"Authorization": f"Bearer {MESHY_API_KEY}"}
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.meshy.ai/openapi/v1/image-to-3d",
                headers=headers,
                json=payload.__dict__,
            )
            response.raise_for_status()
            result = MeshyTaskGeneratedResponse(**response.json())
            return result

    except httpx.HTTPStatusError as e:
        logger.error(f"Request failed: {e}")
        return None


async def get_meshy_task_status(
    meshy_task_args: MeshyTaskStatus,
) -> MeshyTaskStatusResponse:
    headers = {"Authorization": f"Bearer {MESHY_API_KEY}"}
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.meshy.ai/openapi/v2/text-to-3d/{meshy_task_args.task_id}",
            headers=headers,
        )
        response.raise_for_status()

        result = MeshyTaskStatusResponse(**response.json())
        return result


async def get_image_to_3d_task_status(
    meshy_task_args: MeshyTaskStatus,
) -> ImageTo3DMeshyTaskStatusResponse:
    headers = {"Authorization": f"Bearer {MESHY_API_KEY}"}
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.meshy.ai/openapi/v1/image-to-3d/{meshy_task_args.task_id}",
            headers=headers,
        )
        response.raise_for_status()
        logger.info(f"Image-to-3D task status: {response.json()}")
        result = ImageTo3DMeshyTaskStatusResponse(**response.json())
        return result


async def generate_meshy_refine_task(
    payload: MeshyRefinedPayload,
) -> MeshyTaskGeneratedResponse:
    headers = {"Authorization": f"Bearer {MESHY_API_KEY}"}

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.meshy.ai/openapi/v2/text-to-3d",
            headers=headers,
            json=payload.__dict__,
        )
        response.raise_for_status()

        result = MeshyTaskGeneratedResponse(**response.json())
        return result


async def stream_text_to_3d_progress(task_id: str):
    """Async generator yielding SSE events from Meshy text-to-3D stream."""
    headers = {"Authorization": f"Bearer {MESHY_API_KEY}"}
    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as client:
        async with aconnect_sse(
            client, "GET",
            f"https://api.meshy.ai/openapi/v2/text-to-3d/{task_id}/stream",
            headers=headers
        ) as event_source:
            event_source.response.raise_for_status()
            async for sse in event_source.aiter_sse():
                if sse.event == "error":
                    yield {"_error": True, **json.loads(sse.data)}
                    return
                yield json.loads(sse.data)


async def stream_image_to_3d_progress(task_id: str):
    """Async generator yielding SSE events from Meshy image-to-3D stream."""
    headers = {"Authorization": f"Bearer {MESHY_API_KEY}"}
    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as client:
        async with aconnect_sse(
            client, "GET",
            f"https://api.meshy.ai/openapi/v1/image-to-3d/{task_id}/stream",
            headers=headers
        ) as event_source:
            event_source.response.raise_for_status()
            async for sse in event_source.aiter_sse():
                if sse.event == "error":
                    yield {"_error": True, **json.loads(sse.data)}
                    return
                yield json.loads(sse.data)


async def get_obj_file_blob(url: str) -> BytesIO:
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        response.raise_for_status()
        blob = BytesIO(response.content)
        return blob


async def websocket_session_exists(session_id: str):
    url = f"{AUTH_SERVICE_URL}/get_session"
    cookies = {"fitd_session_data": session_id}
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, cookies=cookies)
            if response.status_code != 200:
                return False, None
            user_information = json.loads(response.text)
            user_response = UserAndTasks(**user_information)
        return True, user_response
    except Exception:
        return False, None


async def http_session_exists(session_id: str) -> bool:
    cookies = {"fitd_session_data": session_id}
    url = f"{AUTH_SERVICE_URL}/get_session"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, cookies=cookies)
            return response.status_code == 200
        except httpx.HTTPError as e:
            logger.error(f"HTTP error occurred: {e}")
            return False


async def create_task(task_information: TaskInformation):
    auth_token = generate_token("meshy_backend")
    url = f"{DB_SERVICE_URL}/tasks"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}",  # Add the auth token here
    }

    # Send the POST request with user data and session token in cookies
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=task_information.dict(), headers=headers)

        if response.status_code in (200, 201):
            # If successful, return the user data
            return response.json()
        else:
            # Handle any errors
            logger.error(f"Error: {response.status_code} - {response.text}")
            return None

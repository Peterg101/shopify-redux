import base64
import logging
import aiohttp
from fastapi import WebSocket, Request, HTTPException
from typing import Tuple, Optional, Union
from fitd_schemas.auth_utils import cookie_verification as _cookie_verification
from api_calls import (
    generate_text_to_3d_task,
    get_image_to_3d_task_status,
    generate_image_to_3d_task,
    get_meshy_task_status,
    generate_meshy_refine_task,
    stream_text_to_3d_progress,
    stream_image_to_3d_progress,
    create_task,
    websocket_session_exists,
    http_session_exists,
    get_obj_file_blob,
)
from fitd_schemas.fitd_classes import (
    ImageTo3DMeshyTaskStatusResponse,
    MeshyTaskStatus,
    MeshyTaskStatusResponse,
    TaskInformation,
    ImageTo3DTaskRequest,
    TaskRequest,
    RefineTaskRequest,
)
from jwt_auth import generate_token
from redis.asyncio import Redis as AsyncRedis
import os
import httpx

logger = logging.getLogger(__name__)

DB_SERVICE_URL = os.getenv("DB_SERVICE_URL", "http://localhost:8000")


async def generate_task_and_check_for_response_decoupled_ws(
    request: TaskRequest, redis: AsyncRedis
) -> Union[MeshyTaskStatusResponse, None]:
    try:
        generated_task = await generate_text_to_3d_task(request.meshy_payload)
        if not generated_task:
            await redis.publish(f"task_progress:{request.port_id}", "Task Failed,,")
            return None

        task_id = generated_task.result
        task_posted = False

        async for event in stream_text_to_3d_progress(task_id):
            if event.get("_error"):
                await redis.publish(
                    f"task_progress:{request.port_id}",
                    f"Task Failed,{task_id},{request.meshy_payload.prompt}"
                )
                return None

            status = event.get("status")
            progress = event.get("progress", 0)

            if not task_posted:
                generated_task_status = MeshyTaskStatusResponse(**event)
                await post_task_to_db(generated_task_status, request.user_id, request.port_id)
                task_posted = True

            await redis.publish(
                f"task_progress:{request.port_id}",
                f"{progress},{task_id},{request.meshy_payload.prompt}"
            )

            if status == "SUCCEEDED":
                response = MeshyTaskStatusResponse(**event)
                complete = await add_file_response(response)
                if isinstance(complete, MeshyTaskStatusResponse):
                    await send_file_to_storage(complete)
                await redis.publish(
                    f"task_progress:{request.port_id}",
                    f"Task Completed,{task_id},{request.meshy_payload.prompt}"
                )
                return response

            elif status == "FAILED":
                logger.error(f"Meshy task failed: {task_id}")
                await redis.publish(
                    f"task_progress:{request.port_id}",
                    f"Task Failed,{task_id},{request.meshy_payload.prompt}"
                )
                return None

    except Exception:
        logger.exception(f"SSE error for task {request.port_id}")
        await redis.publish(f"task_progress:{request.port_id}", "Task Failed,,An error occurred during processing")
        return None


async def generate_image_to_3d_task_and_check_for_response_decoupled_ws(
    request: ImageTo3DTaskRequest, redis: AsyncRedis
) -> Union[ImageTo3DMeshyTaskStatusResponse, None]:
    try:
        generated_task = await generate_image_to_3d_task(request.meshy_image_to_3d_payload)
        if not generated_task:
            await redis.publish(f"task_progress:{request.port_id}", "Task Failed,,")
            return None

        task_id = generated_task.result
        task_posted = False

        async for event in stream_image_to_3d_progress(task_id):
            if event.get("_error"):
                await redis.publish(
                    f"task_progress:{request.port_id}",
                    f"Task Failed,{task_id},{request.filename}"
                )
                return None

            status = event.get("status")
            progress = event.get("progress", 0)

            if not task_posted:
                generated_task_status = ImageTo3DMeshyTaskStatusResponse(**event)
                await post_image_task_to_db(
                    generated_task_status, request.user_id, request.port_id, request.filename
                )
                task_posted = True

            await redis.publish(
                f"task_progress:{request.port_id}",
                f"{progress},{task_id},{request.filename}"
            )

            if status == "SUCCEEDED":
                response = ImageTo3DMeshyTaskStatusResponse(**event)
                complete = await add_file_response(response)
                await send_obj_from_image_to_file_to_storage(complete)
                await redis.publish(
                    f"task_progress:{request.port_id}",
                    f"Task Completed,{task_id},{request.filename}"
                )
                return response

            elif status == "FAILED":
                logger.error(f"Meshy image task failed: {task_id}")
                await redis.publish(
                    f"task_progress:{request.port_id}",
                    f"Task Failed,{task_id},{request.filename}"
                )
                return None

    except Exception:
        logger.exception(f"SSE error for image task {request.port_id}")
        await redis.publish(f"task_progress:{request.port_id}", "Task Failed,,An error occurred during processing")
        return None


async def generate_refine_task_and_stream(
    request: RefineTaskRequest, redis: AsyncRedis
) -> Union[MeshyTaskStatusResponse, None]:
    try:
        generated_task = await generate_meshy_refine_task(request.meshy_refine_payload)
        if not generated_task:
            await redis.publish(f"task_progress:{request.port_id}", "Task Failed,,")
            return None

        task_id = generated_task.result

        async for event in stream_text_to_3d_progress(task_id):
            if event.get("_error"):
                await redis.publish(
                    f"task_progress:{request.port_id}",
                    f"Task Failed,{task_id},refine"
                )
                return None

            status = event.get("status")
            progress = event.get("progress", 0)

            await redis.publish(
                f"task_progress:{request.port_id}",
                f"{progress},{task_id},refine"
            )

            if status == "SUCCEEDED":
                response = MeshyTaskStatusResponse(**event)
                complete = await add_file_response(response)
                if isinstance(complete, MeshyTaskStatusResponse):
                    await send_file_to_storage(complete)
                await redis.publish(
                    f"task_progress:{request.port_id}",
                    f"Task Completed,{task_id},refine"
                )
                return response

            elif status == "FAILED":
                logger.error(f"Meshy refine task failed: {task_id}")
                await redis.publish(
                    f"task_progress:{request.port_id}",
                    f"Task Failed,{task_id},refine"
                )
                return None

    except Exception:
        logger.exception(f"SSE error for refine task {request.port_id}")
        await redis.publish(f"task_progress:{request.port_id}", "Task Failed,,An error occurred during processing")
        return None


async def validate_session(websocket: WebSocket) -> Tuple[bool, Optional[str]]:
    cookie_header = websocket.headers.get("cookie")
    if not cookie_header:
        return False, None  # Session invalid: No cookie
    session_valid, user_information = await websocket_session_exists(cookie_header)
    if not session_valid:
        return False, None  # Session invalid: Expired or invalid

    return True, user_information.user.user_id  # Session valid


async def add_file_response(
    response: Union[MeshyTaskStatusResponse, ImageTo3DMeshyTaskStatusResponse]
) -> Union[MeshyTaskStatusResponse, ImageTo3DMeshyTaskStatusResponse]:
    """
    Process a MeshyTaskStatusResponse object to include a base64-encoded .obj file blob.

    Args:
        response (MeshyTaskStatusResponse): The task response object to modify.

    Returns:
        MeshyTaskStatusResponse: The modified response object with the base64 blob added.
    """
    try:
        # Ensure model_urls and obj are present
        if response.model_urls and response.model_urls.obj:
            # Retrieve the blob
            obj_file_blob = await get_obj_file_blob(response.model_urls.obj)
            # Encode the blob in Base64
            obj_file_base64 = base64.b64encode(obj_file_blob.getvalue()).decode("utf-8")

            # Add the encoded blob to the response
            response.obj_file_blob = obj_file_base64
    except Exception as e:
        # Log the error for debugging purposes
        logger.error(f"Error while processing file response: {e}")
        # Optionally, you can add a fallback or additional logic here

    return response


async def post_task_to_db(
    response: MeshyTaskStatusResponse, user_id: str, port_id: str
):
    task_info = TaskInformation(
        user_id=user_id,
        task_id=response.id, 
        task_name=response.prompt,
        port_id=port_id
    )
    await create_task(task_info)


async def post_image_task_to_db(
    response: MeshyTaskStatusResponse, 
    user_id: str, 
    port_id: str, 
    filename: str
):
    task_info = TaskInformation(
        user_id=user_id, 
        task_id=response.id, 
        task_name=filename, 
        port_id=port_id
    )
    await create_task(task_info)


async def clean_up_connection(websocket: WebSocket, connections):
    if websocket in connections:
        connections.remove(websocket)
    await websocket.close()


async def send_file_to_storage(
    complete_meshy_response: MeshyTaskStatusResponse,
):
    server_url = f"{DB_SERVICE_URL}/file_upload"
    auth_token = generate_token("meshy_backend")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}",  # Add the auth token here
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(
            server_url, json=complete_meshy_response.dict(), headers=headers
        )
        logger.info(f"Response from server: {response.json()}")


async def send_obj_from_image_to_file_to_storage(
    complete_meshy_response: ImageTo3DMeshyTaskStatusResponse,
):
    server_url = f"{DB_SERVICE_URL}/file_upload_from_image"
    auth_token = generate_token("meshy_backend")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}",  # Add the auth token here
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(
            server_url, json=complete_meshy_response.dict(), headers=headers
        )
        logger.info(f"Response from server: {response.json()}")


async def cookie_verification(request: Request):
    return await _cookie_verification(request, http_session_exists)


async def download_blob(blob_url: str) -> bytes:
    """
    Downloads a file from a blob URL and returns the file content as bytes.

    Args:
        blob_url (str): The blob URL to download.

    Returns:
        bytes: The downloaded file content.
    """
    async with aiohttp.ClientSession() as session:
        async with session.get(blob_url) as response:
            if response.status != 200:
                raise Exception(f"Failed to fetch blob: {response.status}")
            return await response.read()

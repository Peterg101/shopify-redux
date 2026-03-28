"""Background task handlers for Meshy generation workflows."""
import base64
import logging
import os
from typing import Union

import httpx
from redis.asyncio import Redis as AsyncRedis

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
from shared import publish
from meshy.api import (
    generate_text_to_3d_task,
    get_image_to_3d_task_status,
    generate_image_to_3d_task,
    get_meshy_task_status,
    generate_meshy_refine_task,
    stream_text_to_3d_progress,
    stream_image_to_3d_progress,
    get_obj_file_blob,
    create_task,
)

logger = logging.getLogger(__name__)

DB_SERVICE_URL = os.getenv("DB_SERVICE_URL", "http://localhost:8000")


async def generate_text_to_3d_and_stream(
    request: TaskRequest, redis: AsyncRedis
) -> Union[MeshyTaskStatusResponse, None]:
    try:
        generated_task = await generate_text_to_3d_task(request.meshy_payload)
        if not generated_task:
            await publish(redis, request.port_id, "Task Failed,,")
            return None

        task_id = generated_task.result
        task_posted = False

        async for event in stream_text_to_3d_progress(task_id):
            if event.get("_error"):
                await publish(redis, request.port_id,
                    f"Task Failed,{task_id},{request.meshy_payload.prompt}",
                )
                return None

            status = event.get("status")
            progress = event.get("progress", 0)

            if not task_posted:
                generated_task_status = MeshyTaskStatusResponse(**event)
                await post_task_to_db(
                    generated_task_status, request.user_id, request.port_id
                )
                task_posted = True

            await publish(redis, request.port_id,
                f"{progress},{task_id},{request.meshy_payload.prompt}",
            )

            if status == "SUCCEEDED":
                response = MeshyTaskStatusResponse(**event)
                complete = await add_file_response(response)
                if isinstance(complete, MeshyTaskStatusResponse):
                    await send_file_to_storage(complete)
                await publish(redis, request.port_id,
                    f"Task Completed,{task_id},{request.meshy_payload.prompt}",
                )
                return response

            elif status == "FAILED":
                logger.error(f"Meshy task failed: {task_id}")
                await publish(redis, request.port_id,
                    f"Task Failed,{task_id},{request.meshy_payload.prompt}",
                )
                return None

    except Exception:
        logger.exception(f"SSE error for task {request.port_id}")
        await publish(redis, request.port_id,
            "Task Failed,,An error occurred during processing",
        )
        return None


async def generate_image_to_3d_and_stream(
    request: ImageTo3DTaskRequest, redis: AsyncRedis
) -> Union[ImageTo3DMeshyTaskStatusResponse, None]:
    try:
        generated_task = await generate_image_to_3d_task(
            request.meshy_image_to_3d_payload
        )
        if not generated_task:
            await publish(redis, request.port_id, "Task Failed,,"
            )
            return None

        task_id = generated_task.result
        task_posted = False

        async for event in stream_image_to_3d_progress(task_id):
            if event.get("_error"):
                await publish(redis, request.port_id,
                    f"Task Failed,{task_id},{request.filename}",
                )
                return None

            status = event.get("status")
            progress = event.get("progress", 0)

            if not task_posted:
                generated_task_status = ImageTo3DMeshyTaskStatusResponse(**event)
                await post_image_task_to_db(
                    generated_task_status,
                    request.user_id,
                    request.port_id,
                    request.filename,
                )
                task_posted = True

            await publish(redis, request.port_id,
                f"{progress},{task_id},{request.filename}",
            )

            if status == "SUCCEEDED":
                response = ImageTo3DMeshyTaskStatusResponse(**event)
                complete = await add_file_response(response)
                await send_obj_from_image_to_file_to_storage(complete)
                await publish(redis, request.port_id,
                    f"Task Completed,{task_id},{request.filename}",
                )
                return response

            elif status == "FAILED":
                logger.error(f"Meshy image task failed: {task_id}")
                await publish(redis, request.port_id,
                    f"Task Failed,{task_id},{request.filename}",
                )
                return None

    except Exception:
        logger.exception(f"SSE error for image task {request.port_id}")
        await publish(redis, request.port_id,
            "Task Failed,,An error occurred during processing",
        )
        return None


async def generate_refine_task_and_stream(
    request: RefineTaskRequest, redis: AsyncRedis
) -> Union[MeshyTaskStatusResponse, None]:
    try:
        generated_task = await generate_meshy_refine_task(request.meshy_refine_payload)
        if not generated_task:
            await publish(redis, request.port_id, "Task Failed,,"
            )
            return None

        task_id = generated_task.result

        async for event in stream_text_to_3d_progress(task_id):
            if event.get("_error"):
                await publish(redis, request.port_id,
                    f"Task Failed,{task_id},refine",
                )
                return None

            status = event.get("status")
            progress = event.get("progress", 0)

            await publish(redis, request.port_id,
                f"{progress},{task_id},refine",
            )

            if status == "SUCCEEDED":
                response = MeshyTaskStatusResponse(**event)
                complete = await add_file_response(response)
                if isinstance(complete, MeshyTaskStatusResponse):
                    await send_file_to_storage(complete)
                await publish(redis, request.port_id,
                    f"Task Completed,{task_id},refine",
                )
                return response

            elif status == "FAILED":
                logger.error(f"Meshy refine task failed: {task_id}")
                await publish(redis, request.port_id,
                    f"Task Failed,{task_id},refine",
                )
                return None

    except Exception:
        logger.exception(f"SSE error for refine task {request.port_id}")
        await publish(redis, request.port_id,
            "Task Failed,,An error occurred during processing",
        )
        return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def add_file_response(
    response: Union[MeshyTaskStatusResponse, ImageTo3DMeshyTaskStatusResponse],
) -> Union[MeshyTaskStatusResponse, ImageTo3DMeshyTaskStatusResponse]:
    """Process a Meshy response to include a base64-encoded .obj file blob."""
    try:
        if response.model_urls and response.model_urls.obj:
            obj_file_blob = await get_obj_file_blob(response.model_urls.obj)
            obj_file_base64 = base64.b64encode(obj_file_blob.getvalue()).decode(
                "utf-8"
            )
            response.obj_file_blob = obj_file_base64
    except Exception as e:
        logger.error(f"Error while processing file response: {e}")
    return response


async def post_task_to_db(
    response: MeshyTaskStatusResponse, user_id: str, port_id: str
):
    task_info = TaskInformation(
        user_id=user_id,
        task_id=response.id,
        task_name=response.prompt,
        port_id=port_id,
    )
    await create_task(task_info)


async def post_image_task_to_db(
    response: MeshyTaskStatusResponse,
    user_id: str,
    port_id: str,
    filename: str,
):
    task_info = TaskInformation(
        user_id=user_id,
        task_id=response.id,
        task_name=filename,
        port_id=port_id,
    )
    await create_task(task_info)


async def send_file_to_storage(
    complete_meshy_response: MeshyTaskStatusResponse,
):
    server_url = f"{DB_SERVICE_URL}/file_upload"
    auth_token = generate_token("generation_service")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}",
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
    auth_token = generate_token("generation_service")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}",
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(
            server_url, json=complete_meshy_response.dict(), headers=headers
        )
        logger.info(f"Response from server: {response.json()}")

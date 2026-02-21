import asyncio
import base64
import aiohttp
from fastapi import WebSocket, Request, HTTPException
from typing import Tuple, Optional, Union
from fitd_schemas.auth_utils import cookie_verification as _cookie_verification
from api_calls import (
    generate_text_to_3d_task,
    get_image_to_3d_task_status,
    generate_image_to_3d_task,
    get_meshy_task_status,
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
)
from jwt_auth import generate_token
import aioredis
import requests


async def generate_task_and_check_for_response_decoupled_ws(
    request: TaskRequest, redis: aioredis.Redis
) -> Union[MeshyTaskStatusResponse, None]:
    try:
        task_generated = False
        task_posted = False
        generated_task = generate_text_to_3d_task(request.meshy_payload)

        while not task_generated:
            await asyncio.sleep(1)
            meshy_task_status = MeshyTaskStatus(task_id=generated_task.result)
            generated_task_status = await get_meshy_task_status(meshy_task_status)

            if not task_posted:
                await post_task_to_db(
                    generated_task_status, request.user_id, request.port_id
                )
                task_posted = True

            percentage_complete = generated_task_status.progress
            status = generated_task_status.status
            progress = f"{percentage_complete},{meshy_task_status.task_id},{generated_task_status.prompt}"
            await redis.publish(f"task_progress:{request.port_id}", progress)

            if status == "SUCCEEDED":
                task_generated = True
                complete_response = await add_file_response(generated_task_status)

                if isinstance(complete_response, MeshyTaskStatusResponse):
                    await send_file_to_storage(complete_response)
                else:
                    print(f"Unexpected response type: {type(complete_response)}")
                success_progress = f"Task Completed,{meshy_task_status.task_id},{generated_task_status.prompt}"
                await redis.publish(f"task_progress:{request.port_id}", success_progress)

            elif status == "FAILED":
                print(f"Meshy task failed: {meshy_task_status.task_id}")
                fail_progress = f"Task Failed,{meshy_task_status.task_id},{generated_task_status.prompt}"
                await redis.publish(f"task_progress:{request.port_id}", fail_progress)
                return None

        return generated_task_status

    except Exception as e:
        print(
            f"Unexpected error in generate_task_and_check_for_response_decoupled_ws: {e}"
        )
        return None


async def generate_image_to_3d_task_and_check_for_response_decoupled_ws(
    request: ImageTo3DTaskRequest, redis: aioredis.Redis
) -> Union[ImageTo3DMeshyTaskStatusResponse, None]:
    try:
        task_generated = False
        task_posted = False
        generated_task = generate_image_to_3d_task(request.meshy_image_to_3d_payload)

        while not task_generated:
            await asyncio.sleep(1)
            meshy_task_status = MeshyTaskStatus(task_id=generated_task.result)
            generated_task_status = await get_image_to_3d_task_status(meshy_task_status)

            if not task_posted:
                await post_image_task_to_db(
                    generated_task_status,
                    request.user_id,
                    request.port_id,
                    request.filename
                )
                task_posted = True

            percentage_complete = generated_task_status.progress
            status = generated_task_status.status
            progress = f"{percentage_complete},{meshy_task_status.task_id},{request.filename}"
            await redis.publish(f"task_progress:{request.port_id}", progress)

            if status == "SUCCEEDED":
                task_generated = True
                complete_response = await add_file_response(generated_task_status)
                await send_obj_from_image_to_file_to_storage(complete_response)
                success_progress = f"Task Completed,{meshy_task_status.task_id},{request.filename}"
                await redis.publish(f"task_progress:{request.port_id}", success_progress)

                return generated_task_status

            elif status == "FAILED":
                task_generated = True
                fail_progress = f"Task Failed,{meshy_task_status.task_id},{request.filename}"
                await redis.publish(f"task_progress:{request.port_id}", fail_progress)
                return None

    except Exception as e:
        print(
            f"Unexpected error in generate_image_to_3d_task_and_check_for_response_decoupled_ws: {e}"
        )
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
            obj_file_blob = get_obj_file_blob(response.model_urls.obj)
            # Encode the blob in Base64
            obj_file_base64 = base64.b64encode(obj_file_blob.getvalue()).decode("utf-8")

            # Add the encoded blob to the response
            response.obj_file_blob = obj_file_base64
    except Exception as e:
        # Log the error for debugging purposes
        print(f"Error while processing file response: {e}")
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
    server_url = "http://localhost:8000/file_upload"
    auth_token = generate_token("meshy_backend")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}",  # Add the auth token here
    }
    response = requests.post(
        server_url, json=complete_meshy_response.dict(), headers=headers
    )
    print("Response from server:", response.json())


async def send_obj_from_image_to_file_to_storage(
    complete_meshy_response: ImageTo3DMeshyTaskStatusResponse,
):
    server_url = "http://localhost:8000/file_upload_from_image"
    auth_token = generate_token("meshy_backend")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}",  # Add the auth token here
    }
    response = requests.post(
        server_url, json=complete_meshy_response.dict(), headers=headers
    )
    print("Response from server:", response.json())


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

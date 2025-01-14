import asyncio
import json
from dataclasses import asdict, is_dataclass
import base64
from fastapi import WebSocket, Request, HTTPException
from typing import Tuple, Optional
from api_calls import (
    generate_meshy_refine_task,
    generate_text_to_3d_task,                   
    get_meshy_task_status,
    create_task,
    websocket_session_exists,
    http_session_exists,
    get_obj_file_blob
    )
from models import (
    MeshyRefinedPayload,
    MeshyTaskGeneratedResponse,
    MeshyTaskStatus,
    MeshyTaskStatusResponse,
    TaskInformation,
    MeshyPayload,
    TaskRequest)
from redis import Redis
from jwt_auth import generate_token
import aioredis
import requests

async def generate_task_and_check_for_response(
    payload: MeshyPayload, websocket: WebSocket, user_id: str
) -> MeshyTaskStatusResponse:
    task_generated = False
    task_posted = False
    generated_task = generate_text_to_3d_task(payload)
    # await post_task_to_db(generated_task, user_id)
    while task_generated is False:
        await asyncio.sleep(1)
        meshy_task_status = MeshyTaskStatus(task_id=generated_task.result)
        print(meshy_task_status)
        generated_task_status = await get_meshy_task_status(meshy_task_status)
        if not task_posted:
            print("POSTED THE TASK")
            await post_task_to_db(generated_task_status, user_id)
            task_posted = True

        percentage_complete = generated_task_status.progress
        await websocket.send_text(generated_task_status.json(indent=2))
        if percentage_complete == 100:
            task_generated = True

    await websocket.send_text(generated_task_status.json(indent=2))
    return generated_task_status


async def generate_task_and_check_for_response_decoupled_ws(
    request: TaskRequest,
    redis: aioredis.Redis
) -> MeshyTaskStatusResponse:
    task_generated = False
    task_posted = False
    generated_task = generate_text_to_3d_task(request.meshy_payload)
    while task_generated is False:
        await asyncio.sleep(1)
        meshy_task_status = MeshyTaskStatus(task_id=generated_task.result)
        print(meshy_task_status.task_id)
        generated_task_status = await get_meshy_task_status(meshy_task_status)
        if not task_posted:
            print("POSTED THE TASK")
            await post_task_to_db(generated_task_status, request.user_id)
            task_posted = True

        percentage_complete = generated_task_status.progress
        progress = f"Progress: {percentage_complete}%, MeshyTaskId: {meshy_task_status.task_id}"
        print(generated_task.result)
        await redis.publish(f"task_progress:{request.task_id}", progress)
        if percentage_complete == 100:
            task_generated = True
            print('TASK GENERATED')
            print("*******")
            complete_response = await add_file_response(generated_task_status)
            print(complete_response.obj_file_blob)
            print("*******")
            await send_file_to_storage(complete_response)



    # await websocket.send_text(generated_task_status.json(indent=2))
    # await send_file_to_storage(generated_task_status)
    return generated_task_status



async def validate_session(websocket: WebSocket) -> Tuple[bool, Optional[str]]:
    
    cookie_header = websocket.headers.get("cookie")
    
    if not cookie_header:
        return False, None  # Session invalid: No cookie

    session_valid, user_information = await websocket_session_exists(cookie_header)

    if not session_valid:
        return False, None  # Session invalid: Expired or invalid
    
    return True, user_information.user.user_id  # Session valid


async def process_client_messages(websocket: WebSocket, user_id: str):
    
    while True:
        # Receive and parse payload
        raw_data = await websocket.receive_text()
        payload_dict = json.loads(raw_data)
        payload = MeshyPayload(**payload_dict)
        
        # Generate task and await a response
        response = await generate_task_and_check_for_response(
            payload,
            websocket,
            user_id
            )
        if response:
            await send_task_response(websocket, response)
            await send_file_to_storage(response)
            break
        

async def send_task_response(websocket: WebSocket, response):
    obj_file_blob = get_obj_file_blob(response.model_urls.obj)
    obj_file_base64 = base64.b64encode(obj_file_blob.getvalue()).decode('utf-8')
    response.obj_file_blob = obj_file_base64

    await websocket.send_text(response.json(indent=2))

async def add_file_response(response: MeshyTaskStatusResponse) -> MeshyTaskStatusResponse:
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


async def post_task_to_db(response: MeshyTaskStatusResponse, user_id: str):
    print(user_id)
    print("************")
    print('POSTING HERE')
    task_info = TaskInformation(
        user_id=user_id,
        task_id=response.id,
        task_name=response.prompt
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
        server_url,
        json=complete_meshy_response.dict(),
        headers=headers
        )
    print("Response from server:", response.json())
    

async def cookie_verification(request: Request):
    session_id = request.cookies.get("fitd_session_data")
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # session_data = await session_exists_2(session_id)
    session_data = await http_session_exists(session_id)
    if not session_data:
        raise HTTPException(status_code=401, detail="No Session Found")
    

    
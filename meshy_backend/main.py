import uvicorn
import json
import base64
import asyncio
import aioredis
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks, Depends
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from models import (
    MeshyTaskGeneratedResponse,
    MeshyPayload,
    MeshyTaskStatusResponse,
    ModelUrls,
    TaskInformation,
    TaskRequest
)
from redis import Redis

from api_calls import (
    generate_text_to_3d_task,
    get_obj_file_blob,
    websocket_session_exists,
    create_task
    )

from utils import (
    generate_task_and_check_for_response,
    generate_task_and_check_for_response_decoupled_ws, 
    validate_session, 
    process_client_messages, 
    clean_up_connection,
    cookie_verification
)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"])

# Redis Configuration
REDIS_HOST = "localhost"
REDIS_PORT = 6379


async def get_redis():
    redis = await aioredis.from_url(f"redis://{REDIS_HOST}:{REDIS_PORT}", decode_responses=True)
    return redis


@app.post("/api/meshy_request")
async def generate_meshy_task(payload: MeshyPayload):
    try:
        response = MeshyTaskGeneratedResponse(result=payload.prompt)
        response = generate_text_to_3d_task(payload)
        return response
    except ValidationError:
        raise HTTPException(status_code=500, detail="This is bad")



@app.post("/start_task/")
async def start_task(
    request: TaskRequest,
    background_tasks: BackgroundTasks,
    redis: aioredis.Redis = Depends(get_redis),
    _: None = Depends(cookie_verification)
):
    # Add the task to the background
    # background_tasks.add_task(long_running_task, request, redis)
    background_tasks.add_task(
        generate_task_and_check_for_response_decoupled_ws,
        request,
        redis
    )
    return {"message": "Task started!", "task_id": request.port_id}


@app.websocket("/ws/{port_id}")
async def websocket_endpoint(websocket: WebSocket, port_id: str, redis: aioredis.Redis = Depends(get_redis)):
    await websocket.accept()

    # # Authenticate session outside the try block
    # session_valid, user_id = await validate_session(websocket)
    # if not session_valid:
    #     await websocket.close(code=1008, reason="Invalid session")
    #     return

    try:
        # Subscribe to the task's progress channel
        pubsub = redis.pubsub()
        await pubsub.subscribe(f"task_progress:{port_id}")

        async for message in pubsub.listen():
            if message["type"] == "message":
                progress = message["data"]
                # Send progress update to the client
                await websocket.send_text(progress)
                if progress == "Task Completed":
                    break

    except WebSocketDisconnect:
        print(f"WebSocket disconnected for task {port_id}")
    except Exception as e:
        print(f"WebSocket Error: {e}")
    finally:
        # Cleanup: close the Redis pubsub and WebSocket connection
        await pubsub.unsubscribe(f"task_progress:{port_id}")
        await pubsub.close()
        await websocket.close()
        print(f"WebSocket connection for task {port_id} closed.")


async def long_running_task(request: TaskRequest, redis: aioredis.Redis):
    """Simulates a long-running task and publishes progress updates."""
    for i in range(21):
        await asyncio.sleep(1)  # Simulate task progress
        progress = f"Progress: {i * 5}%"
        await redis.publish(f"task_progress:{request.port_id}", progress)

        if i == 20:
            await redis.publish(f"task_progress:{request.port_id}", "Task Completed")


connections: List[WebSocket] = []


@app.websocket("/ws")
async def meshy_websocket(websocket: WebSocket):
    await websocket.accept()
    connections.append(websocket)
    
    try:
        # Validate session and get user ID
        session_valid, user_id = await validate_session(websocket)
        if not session_valid:
            await websocket.close(code=1008, reason="Invalid session")
            return
        
        # Process incoming messages
        await process_client_messages(websocket, user_id)
    
    except WebSocketDisconnect:
        print("Client disconnected.")
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        # Ensure proper cleanup
        await clean_up_connection(websocket, connections)
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=1234)

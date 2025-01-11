import uvicorn
import json
import base64
import asyncio
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
    TaskInformation
)

from api_calls import (
    generate_text_to_3d_task,
    get_obj_file_blob,
    websocket_session_exists,
    create_task
    )

from utils import (
    generate_task_and_check_for_response, 
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


@app.post("/api/meshy_request")
async def generate_meshy_task(payload: MeshyPayload):
    try:
        response = MeshyTaskGeneratedResponse(result=payload.prompt)
        response = generate_text_to_3d_task(payload)
        return response
    except ValidationError:
        raise HTTPException(status_code=500, detail="This is bad")

task_progress = {}

# Define the schema for the request body
class TaskRequest(BaseModel):
    task_id: str


@app.post("/start_task/")
async def start_task(
    request: TaskRequest, 
    background_tasks: BackgroundTasks,
    _: None = Depends(cookie_verification)

    ):
    # Add the task to the background
    background_tasks.add_task(long_running_task, request.task_id)
    task_progress[request.task_id] = 0  # Initialize task progress
    return {"message": "Task started!", "task_id": request.task_id}


@app.websocket("/ws/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    await websocket.accept()

    # Stream progress updates to the client
    try:
        while task_progress.get(task_id, None) is not None:
            progress = task_progress[task_id]
            print(f"Progress {progress}")
            await websocket.send_text(f"Progress: {progress}%")
            if progress >= 100:
                await websocket.send_text("Task Completed!")
                break
            await asyncio.sleep(1)  # Throttle updates to avoid spamming
    except Exception as e:
        print(f"WebSocket Error: {e}")
    finally:
        await websocket.close()
        print('Task complete and websocket closed')


async def long_running_task(task_id: str):
    print('INSIDE')
    for i in range(1, 101):  # Simulate 20 steps
        print(i)
        await asyncio.sleep(2)  # Simulate work

        task_progress[task_id] = i * 5  # Update progress (5% per step)

    # Mark task as completed
    task_progress[task_id] = 100
    await asyncio.sleep(1)  # Allow WebSocket clients to pick up the final update
    del task_progress[task_id]  # Clean up the progress dictionary


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

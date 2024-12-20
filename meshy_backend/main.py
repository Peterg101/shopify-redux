import uvicorn
import json
import base64
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
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
    session_exists,
    create_task
    )

from utils import generate_task_and_check_for_response, validate_session, process_client_messages, clean_up_connection

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

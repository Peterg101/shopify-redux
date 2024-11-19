import uvicorn
import json
import base64
from fastapi import FastAPI, HTTPException, WebSocket
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from models import (
    MeshyTaskGeneratedResponse,
    MeshyPayload,
    MeshyTaskStatusResponse,
    ModelUrls
)

from api_calls import (
    generate_text_to_3d_task,
    get_obj_file_blob,
    session_exists
    )

from utils import generate_task_and_check_for_response

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
    cookie_header = websocket.headers.get("cookie")
    if not cookie_header:
        raise HTTPException(status_code=401, detail="No cookies found in the WebSocket request")
    connections.append(websocket)
    current_session = await session_exists(cookie_header)
    if not current_session:
        raise HTTPException(status_code=401, detail="Invalid token or token verification failed")
    try:
        while True:
            data = await websocket.receive_text()
            
            # Convert JSON string to a dictionary
            payload_dict = json.loads(data)
            
            # Use the dictionary to create a MeshyPayload object
            payload = MeshyPayload(**payload_dict)
            response = await generate_task_and_check_for_response(
                payload,
                websocket
            )
            
            print(payload_dict)
            # response = example_task
            if response:
                
                obj_file_blob = get_obj_file_blob(response.model_urls.obj)
                obj_file_base64 = base64.b64encode(
                    obj_file_blob.getvalue()
                ).decode('utf-8')
                response.obj_file_blob = obj_file_base64
                await websocket.send_text(response.json(indent=2))
                break

    except Exception as e:
        print(f"connection error {e}")
    finally:
        if websocket in connections:
            connections.remove(websocket)
        else:
            websocket.close()
    
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=1234)

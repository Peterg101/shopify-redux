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


# example_task = MeshyTaskStatusResponse(
#     id="12345",
#     mode="test",
#     name="Example Task",
#     seed=42,
#     art_style="Impressionism",
#     texture_richness="High",
#     prompt="A beautiful sunset over a mountain range.",
#     negative_prompt="No clouds",
#     status="completed",
#     created_at=1638345600,
#     progress=100,
#     task_error='no error',
#     started_at=1638345600,
#     finished_at=1638350000,
#     model_urls=ModelUrls(obj='https://assets.meshy.ai/f90372a1-a409-4203-8047-433769a318d4/tasks/0192fcfb-2df2-7544-9d37-f765faaa0659/output/model.obj?Expires=4884364800&Signature=deJ~2lgR3vflGefX7JpU0nxCWuIOkpPc3O64FFQ8x2wFVL90OwoK8VvfTpgA7b516AZOMm9qER1Drvxf6bhaY6a~ySPMfYFZmLwG0PtE~fp3YmJpE8zmgm13h7lypgRCH8gUGTbhacT6WK83uAp1fMhTzTTxL~F8k73KiFxT2xj9kGcUh9VQeD9vkRhmStUskQPrvszcEShtXwwqFNQ1bz-p1NImw0jgVHVeqX3MwsBY9v4j3zA7h6uApEjcRBfjDUbEkM~ihf~6h3S4zaCASINiIJP93eAkHEiz1jQQ-7Dy~OhChhxupreA0HuqsQxcJNiksbvFJSe0crjOw-KInA__&Key-Pair-Id=KL5I0C8H7HX83', glb= '', fbx= '', usdz='', mtl = ''),
#     thumbnail_url="http://example.com/thumbnail.jpg",
#     video_url="http://example.com/video.mp4",
#     texture_urls=[],
#     preceding_tasks=2,
#     obj_file_blob=None
# )

connections: List[WebSocket] = []


# @app.websocket("/ws")
# async def meshy_websocket(websocket: WebSocket):
#     await websocket.accept()
#     cookie_header = websocket.headers.get("cookie")
#     if not cookie_header:
#         raise HTTPException(status_code=401, detail="No cookies found in the WebSocket request")
#     connections.append(websocket)
#     current_session = await session_exists(cookie_header)
#     if not current_session:
#         raise HTTPException(status_code=401, detail="Invalid token or token verification failed")
#     try:
#         while True:
#             data = await websocket.receive_text()
            
#             # Convert JSON string to a dictionary
#             payload_dict = json.loads(data)
            
#             # Use the dictionary to create a MeshyPayload object
#             payload = MeshyPayload(**payload_dict)
#             response = await generate_task_and_check_for_response(
#                 payload,
#                 websocket
#             )
            
#             print(payload_dict)
#             # response = example_task
#             if response:
                
#                 obj_file_blob = get_obj_file_blob(response.model_urls.obj)
#                 obj_file_base64 = base64.b64encode(
#                     obj_file_blob.getvalue()
#                 ).decode('utf-8')
#                 response.obj_file_blob = obj_file_base64
#                 await websocket.send_text(response.json(indent=2))
#                 break

#     except Exception as e:
#         print(f"connection error {e}")
#     finally:
#         if websocket in connections:
#             connections.remove(websocket)
#         else:
#             websocket.close()


# @app.websocket("/ws")
# async def meshy_websocket(websocket: WebSocket):
#     await websocket.accept()
#     cookie_header = websocket.headers.get("cookie")
    
#     if not cookie_header:
#         await websocket.close(code=1008, reason="No cookies found in the request")
#         return
    
#     connections.append(websocket)
#     current_session, user_id = await session_exists(cookie_header)
#     print('USERRRRRR ID **************************************')
#     print(user_id)
#     if not current_session:
#         await websocket.close(code=1008, reason="Invalid token or session expired")
#         return

#     try:
#         task_posted = False  # Flag to ensure task is only posted once
        
#         while True:
#             # Receive and parse payload from the WebSocket client
#             data = await websocket.receive_text()
#             payload_dict = json.loads(data)
#             print("Payload dict**************")
#             print(payload_dict)
#             # meshy_response = MeshyTaskStatusResponse(**payload_dict)
#             payload = MeshyPayload(**payload_dict)

#             # Check task status and wait for a response
#             response = await generate_task_and_check_for_response(payload, websocket)
            
#             if response:
#                 # Convert obj file to base64 for the response
#                 obj_file_blob = get_obj_file_blob(response.model_urls.obj)
#                 obj_file_base64 = base64.b64encode(obj_file_blob.getvalue()).decode('utf-8')
#                 response.obj_file_blob = obj_file_base64
                
#                 # Send the response back to the WebSocket client
#                 await websocket.send_text(response.json(indent=2))
#                 break

#             # Post task only once to the database
#             if not task_posted:
#                 print("TASK POSTEDDDDDDDD*************************")
#                 task_info = TaskInformation(**user_id)
#                 task_info.task_id = response.id
#                 task_info.task_name = response.prompt
#                 print(task_info)
#                 # await create_task(task_info)  # New function to handle database logic
#                 task_posted = True

#     except Exception as e:
#         print(f"WebSocket connection error: {e}")
#     finally:
#         # Cleanup: Remove connection and close WebSocket
#         if websocket in connections:
#             connections.remove(websocket)
#         await websocket.close()


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

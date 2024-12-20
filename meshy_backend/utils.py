import asyncio
import json
from dataclasses import asdict, is_dataclass
import base64
from datetime import datetime
from fastapi import WebSocket
from typing import Tuple, Optional
from api_calls import (
    generate_meshy_refine_task,
    generate_text_to_3d_task,                   
    get_meshy_task_status,
    create_task,
    session_exists,
    get_obj_file_blob
    )
from models import (
    MeshyRefinedPayload,
    MeshyTaskGeneratedResponse,
    MeshyTaskStatus,
    MeshyTaskStatusResponse,
    TaskInformation,
    MeshyPayload,
    ModelUrls
    )


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


# async def refine_task_and_check_for_response(
#     payload: MeshyRefinedPayload, websocket: WebSocket
# ) -> MeshyTaskStatusResponse:
#     task_refined = False
#     refined_task = generate_meshy_refine_task(payload)

#     while task_refined is False:
#         await asyncio.sleep(1)
#         meshy_task_status = MeshyTaskStatus(task_id=refined_task.result)
#         refined_task_status = get_meshy_task_status(meshy_task_status)
#         percentage_complete = refined_task_status.progress
#         await websocket.send_text(refined_task_status.json(indent=2))
#         if percentage_complete == 100:
#             task_refined = True

#     await websocket.send_text(refined_task_status.json(indent=2))
#     return refined_task_status


async def validate_session(websocket: WebSocket) -> Tuple[bool, Optional[str]]:
    
    cookie_header = websocket.headers.get("cookie")
    
    if not cookie_header:
        return False, None  # Session invalid: No cookie

    session_valid, user = await session_exists(cookie_header)
    if not session_valid:
        return False, None  # Session invalid: Expired or invalid
    
    print("User ID:", user) 
  
    user_dict = json.loads(user) 
    user_id = user_dict.get('user_id')
    print('**********USER ID*************')
    print(user_id)
    return True, user_id  # Session valid


async def process_client_messages(websocket: WebSocket, user_id: str):
    
    while True:
        # Receive and parse payload
        raw_data = await websocket.receive_text()
        payload_dict = json.loads(raw_data)
        payload = MeshyPayload(**payload_dict)
        
        # Generate task and await a response
        # response = await generate_task_and_check_for_response(
        #     payload,
        #     websocket,
        #     user_id
        #     )
        print("********MOCK RESPONSE****************")
        response = MeshyTaskStatusResponse(
            id="12345",
            mode="test",
            name="Example Task",
            seed=42,
            art_style="Impressionism",
            texture_richness="High",
            prompt="A beautiful sunset over a mountain range.",
            negative_prompt="No clouds",
            status="completed",
            created_at=1638345600,
            progress=100,
            task_error='no error',
            started_at=1638345600,
            finished_at=1638350000,
            model_urls=ModelUrls(obj='https://assets.meshy.ai/f90372a1-a409-4203-8047-433769a318d4/tasks/0193e01e-9956-7527-9609-dd51de96467c/output/model.obj?Expires=4888166400&Signature=oeOz7v-nnzsIepAHCOeAcSNddp6h52CSGbIv5-h7u7O88-A17LHO4YDoihE5Azp0sR4k1~gVoz5F8fHIXUNyrXQh6x8KARL~dz02INikkNy4tWh9Znz2oo3scWMv8qA3jI7YOSlb0rN7AEfGfNqaSiQL1KNBhuLdqoSuZqrMPYM3Sfdjkc1EWYCnsBvo8GEGWIozUDs~on1yBn~am5UAB88B333yRE8OUvMgBnWhhmnQCXdEsvYxyQHa-bx2mRmQY-4hrW07gy-TT3loZctk47edX9CauIKOlw9Oq8YTuynPKIJTl~klIU4R8B0xnJti~XbQ0uPeoNE6hU-isHJXVQ__&Key-Pair-Id=KL5I0C8H7HX83', glb= '', fbx= '', usdz='', mtl = ''),
            thumbnail_url="http://example.com/thumbnail.jpg",
            video_url="http://example.com/video.mp4",
            texture_urls=[],
            preceding_tasks=2,
            obj_file_blob=None
        )
        if response:
            await send_task_response(websocket, response)
            break
        

async def send_task_response(websocket: WebSocket, response):
    obj_file_blob = get_obj_file_blob(response.model_urls.obj)
    obj_file_base64 = base64.b64encode(obj_file_blob.getvalue()).decode('utf-8')
    response.obj_file_blob = obj_file_base64

    await websocket.send_text(response.json(indent=2))


async def post_task_to_db(response: MeshyTaskStatusResponse, user_id: str):
    print("Posting task to DB...")
    task_info = TaskInformation(
        user_id=user_id,
        task_id=response.id,
        task_name=response.prompt,
        created_at=datetime.now().isoformat())
    await create_task(task_info)
    print("Task posted:", task_info)


async def clean_up_connection(websocket: WebSocket, connections):
    if websocket in connections:
        connections.remove(websocket)
    await websocket.close()
    print("Connection closed.")
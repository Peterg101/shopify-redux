import asyncio
import json
from dataclasses import asdict, is_dataclass

from fastapi import WebSocket

from api_calls import (generate_meshy_refine_task, generate_text_to_3d_task,
                       get_meshy_task_status, create_task)
from models import (MeshyRefinedPayload, MeshyTaskGeneratedResponse,
                    MeshyTaskStatus, MeshyTaskStatusResponse, TaskInformation)


async def generate_task_and_check_for_response(
    payload: MeshyTaskGeneratedResponse, websocket: WebSocket
) -> MeshyTaskStatusResponse:
    task_generated = False
    generated_task = generate_text_to_3d_task(payload)
    # await create_task(task_information)
    while task_generated is False:
        await asyncio.sleep(1)
        meshy_task_status = MeshyTaskStatus(task_id=generated_task.result)
        print(meshy_task_status)
        generated_task_status = get_meshy_task_status(meshy_task_status)
        percentage_complete = generated_task_status.progress
        await websocket.send_text(generated_task_status.json(indent=2))
        if percentage_complete == 100:
            task_generated = True

    await websocket.send_text(generated_task_status.json(indent=2))
    return generated_task_status


async def refine_task_and_check_for_response(
    payload: MeshyRefinedPayload, websocket: WebSocket
) -> MeshyTaskStatusResponse:
    task_refined = False
    refined_task = generate_meshy_refine_task(payload)

    while task_refined is False:
        await asyncio.sleep(1)
        meshy_task_status = MeshyTaskStatus(task_id=refined_task.result)
        refined_task_status = get_meshy_task_status(meshy_task_status)
        percentage_complete = refined_task_status.progress
        await websocket.send_text(refined_task_status.json(indent=2))
        if percentage_complete == 100:
            task_refined = True

    await websocket.send_text(refined_task_status.json(indent=2))
    return refined_task_status

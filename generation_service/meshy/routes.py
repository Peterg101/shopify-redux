"""Meshy generation routes -- text-to-3D, image-to-3D, and refine tasks."""
import logging
from fastapi import APIRouter, BackgroundTasks, Depends
from redis.asyncio import Redis as AsyncRedis

from fitd_schemas.fitd_classes import (
    TaskRequest,
    ImageTo3DTaskRequest,
    RefineTaskRequest,
)
from shared import get_redis, get_authenticated_user
from meshy.handlers import (
    generate_text_to_3d_and_stream,
    generate_image_to_3d_and_stream,
    generate_refine_task_and_stream,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/start_task/")
async def start_task(
    request: TaskRequest,
    background_tasks: BackgroundTasks,
    redis: AsyncRedis = Depends(get_redis),
    _: None = Depends(get_authenticated_user),
):
    background_tasks.add_task(
        generate_text_to_3d_and_stream, request, redis
    )
    return {"message": "Task started!", "task_id": request.port_id}


@router.post("/start_image_to_3d_task/")
async def start_image_to_3d_task(
    request: ImageTo3DTaskRequest,
    background_tasks: BackgroundTasks,
    redis: AsyncRedis = Depends(get_redis),
    _: None = Depends(get_authenticated_user),
):
    background_tasks.add_task(
        generate_image_to_3d_and_stream, request, redis
    )
    logger.info("background task successfully added")
    return {"message": "Task started!", "task_id": request.port_id}


@router.post("/start_refine_task/")
async def start_refine_task(
    request: RefineTaskRequest,
    background_tasks: BackgroundTasks,
    redis: AsyncRedis = Depends(get_redis),
    _: None = Depends(get_authenticated_user),
):
    background_tasks.add_task(generate_refine_task_and_stream, request, redis)
    return {"message": "Refine task started!", "task_id": request.port_id}

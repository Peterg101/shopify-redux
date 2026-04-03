"""CAD generation routes -- LLM-powered CadQuery code generation."""
import logging
from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import Optional
from redis.asyncio import Redis as AsyncRedis

from fitd_schemas.fitd_classes import CadTaskRequest
from shared import get_redis, get_authenticated_user
from cad.pipeline import generate_cad_task, regenerate_cad_task

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/start_cad_task/")
async def start_cad_task(
    request: CadTaskRequest,
    background_tasks: BackgroundTasks,
    redis: AsyncRedis = Depends(get_redis),
    _: None = Depends(get_authenticated_user),
):
    background_tasks.add_task(generate_cad_task, request, redis)
    return {"message": "CAD task started!", "task_id": request.port_id}


class RegenerateRequest(BaseModel):
    task_id: str
    port_id: str
    user_id: str
    parameter_changes: dict  # {"length": 60.0, "hole_diameter": 6.0}


@router.post("/regenerate")
async def regenerate(
    request: RegenerateRequest,
    background_tasks: BackgroundTasks,
    redis: AsyncRedis = Depends(get_redis),
    _: dict = Depends(get_authenticated_user),
):
    """Regenerate a CAD model with modified parameters."""
    background_tasks.add_task(
        regenerate_cad_task,
        request.task_id,
        request.port_id,
        request.user_id,
        request.parameter_changes,
        redis,
    )
    return {"message": "Regeneration started!", "port_id": request.port_id}

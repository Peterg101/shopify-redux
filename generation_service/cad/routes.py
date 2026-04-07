"""CAD generation routes -- LLM-powered CadQuery code generation."""
import logging
from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import Optional
from redis.asyncio import Redis as AsyncRedis

from fitd_schemas.fitd_classes import CadTaskRequest
from shared import get_redis, get_authenticated_user
from cad.pipeline import generate_cad_task, regenerate_cad_task, refine_cad_task, suppress_cad_features

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
    parameter_changes: dict


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
        request.task_id, request.port_id, request.user_id,
        request.parameter_changes, redis,
    )
    return {"message": "Regeneration started!", "port_id": request.port_id}


class RefineRequest(BaseModel):
    task_id: str
    port_id: str
    user_id: str
    instruction: str
    max_iterations: int = 3
    timeout_seconds: int = 30


@router.post("/refine")
async def refine(
    request: RefineRequest,
    background_tasks: BackgroundTasks,
    redis: AsyncRedis = Depends(get_redis),
    _: dict = Depends(get_authenticated_user),
):
    """Refine a CAD model with a natural language instruction."""
    background_tasks.add_task(
        refine_cad_task,
        request.task_id, request.port_id, request.user_id,
        request.instruction, redis,
        request.max_iterations, request.timeout_seconds,
    )
    return {"message": "Refinement started!", "port_id": request.port_id}


class SuppressRequest(BaseModel):
    task_id: str
    port_id: str
    user_id: str
    suppressed_tags: list


@router.post("/suppress")
async def suppress(
    request: SuppressRequest,
    background_tasks: BackgroundTasks,
    redis: AsyncRedis = Depends(get_redis),
    _: dict = Depends(get_authenticated_user),
):
    """Suppress/unsuppress features in a CAD model by re-executing with features removed."""
    background_tasks.add_task(
        suppress_cad_features,
        request.task_id, request.port_id, request.user_id,
        request.suppressed_tags, redis,
    )
    return {"message": "Suppression started!", "port_id": request.port_id}

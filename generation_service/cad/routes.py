"""CAD generation routes -- LLM-powered CadQuery code generation."""
import json
import logging
import os
from fastapi import APIRouter, BackgroundTasks, Depends, Request
from pydantic import BaseModel
from typing import Optional
from redis.asyncio import Redis as AsyncRedis
from sse_starlette.sse import EventSourceResponse

from fitd_schemas.fitd_classes import (
    CadTaskRequest,
    CadChatRequest,
    CadChatConfirmRequest,
    CadGenerationSettings,
)
from shared import get_redis, get_authenticated_user, register_task
from cad.pipeline import generate_cad_task, regenerate_cad_task, refine_cad_task, suppress_cad_features, revert_cad_task
from cad.conversation import chat_stream, spec_to_prompt, build_generation_context, get_history_for_persistence

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


# ---------------------------------------------------------------------------
# Conversational pre-generation
# ---------------------------------------------------------------------------

class ChatStartRequest(BaseModel):
    user_id: str


@router.post("/cad/chat/start")
async def cad_chat_start(
    request: ChatStartRequest,
    redis: AsyncRedis = Depends(get_redis),
    _: dict = Depends(get_authenticated_user),
):
    """Create a task for the conversation and return its ID."""
    import uuid
    port_id = str(uuid.uuid4())  # Required by add_task — can't be empty
    task_id = await register_task(
        request.user_id, "CAD Design Chat", port_id, file_type="step",
    )
    if not task_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Failed to create task")
    return {"task_id": task_id}


@router.post("/cad/chat")
async def cad_chat(
    request: CadChatRequest,
    redis: AsyncRedis = Depends(get_redis),
    _: dict = Depends(get_authenticated_user),
):
    """Stream a chat response via SSE for real-time token delivery."""
    async def event_generator():
        async for event_json in chat_stream(
            task_id=request.task_id,
            content=request.message.content,
            images=request.message.images,
            design_intent=request.design_intent.dict() if request.design_intent else None,
            redis=redis,
        ):
            yield {"data": event_json}

    return EventSourceResponse(event_generator())


@router.post("/cad/chat/confirm")
async def cad_chat_confirm(
    request: CadChatConfirmRequest,
    background_tasks: BackgroundTasks,
    redis: AsyncRedis = Depends(get_redis),
    _: dict = Depends(get_authenticated_user),
):
    """Confirm the gathered spec and start CAD generation."""
    settings = request.settings or CadGenerationSettings()
    # Build rich context with full conversation history instead of flat text
    # Build rich context (content blocks with images) for code generation
    rich_context = await build_generation_context(
        request.task_id, request.spec, settings.dict(), redis,
    )
    # Text-only summary for DB storage and fallback
    prompt_text = spec_to_prompt(request.spec, settings.dict())

    # Persist conversation history to the task (text-only, no images)
    conversation_json = await get_history_for_persistence(request.task_id, redis)
    try:
        import httpx
        api_url = os.getenv("API_SERVICE_URL", "http://api_service:8000")
        from jwt_auth import generate_token
        token = generate_token("generation_service", audience="api_service")
        async with httpx.AsyncClient() as client:
            await client.patch(
                f"{api_url}/tasks/{request.task_id}/script",
                json={
                    "cadquery_script": "",
                    "generation_prompt": prompt_text,
                    "conversation_history": conversation_json,
                },
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
    except Exception as e:
        logger.warning(f"Failed to persist conversation: {e}")

    task_request = CadTaskRequest(
        port_id=request.port_id,
        user_id=request.user_id,
        prompt=prompt_text,
        settings=settings,
        existing_task_id=request.task_id,
        rich_context=rich_context,
    )
    background_tasks.add_task(generate_cad_task, task_request, redis)
    return {"message": "CAD task started!", "task_id": request.port_id}


# ---------------------------------------------------------------------------
# Existing endpoints
# ---------------------------------------------------------------------------

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


class RevertRequest(BaseModel):
    task_id: str
    port_id: str
    user_id: str
    version: int


@router.post("/revert")
async def revert(
    request: RevertRequest,
    background_tasks: BackgroundTasks,
    redis: AsyncRedis = Depends(get_redis),
    _: dict = Depends(get_authenticated_user),
):
    """Revert a CAD model to a previous script version."""
    background_tasks.add_task(
        revert_cad_task,
        request.task_id, request.port_id, request.user_id,
        request.version, redis,
    )
    return {"message": "Revert started!", "port_id": request.port_id}

"""CAD generation routes -- LLM-powered CadQuery code generation."""
import asyncio
import json
import logging
import os
import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
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
from jwt_auth import generate_token
from shared import get_redis, get_authenticated_user, register_task
from cad.pipeline import generate_cad_task, regenerate_cad_task, refine_cad_task, suppress_cad_features, revert_cad_task, upload_step_file, save_task_script
from cad.executor import execute_cadquery, validate_code
from cad.llm import generate_build_plan, generate_step_code
from cad.conversation import chat_stream, spec_to_prompt, build_generation_context, get_history_for_persistence

logger = logging.getLogger(__name__)

router = APIRouter()

API_SERVICE_URL = os.getenv("API_SERVICE_URL", "http://api_service:8000")


async def _check_credits(user_id: str) -> dict:
    """Check user credits via api_service. Returns {allowed, tier, credits}."""
    token = generate_token("generation_service", audience="api_service")
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            f"{API_SERVICE_URL}/billing/check-credits",
            json={"user_id": user_id},
            headers={"Authorization": f"Bearer {token}"},
        )
    if resp.status_code != 200:
        logger.error(f"Credit check failed: {resp.status_code} {resp.text}")
        raise HTTPException(status_code=502, detail="Billing service unavailable")
    return resp.json()


@router.post("/start_cad_task/")
async def start_cad_task(
    request: CadTaskRequest,
    background_tasks: BackgroundTasks,
    redis: AsyncRedis = Depends(get_redis),
    _: None = Depends(get_authenticated_user),
):
    # Credit check before starting generation
    credit_info = await _check_credits(request.user_id)
    if not credit_info.get("allowed"):
        raise HTTPException(
            status_code=402,
            detail={
                "detail": "Insufficient credits",
                "tier": credit_info.get("tier", "free"),
                "credits": 0,
            },
        )
    request.tier = credit_info.get("tier", "free")
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
    # Credit check before starting generation
    credit_info = await _check_credits(request.user_id)
    if not credit_info.get("allowed"):
        raise HTTPException(
            status_code=402,
            detail={
                "detail": "Insufficient credits",
                "tier": credit_info.get("tier", "free"),
                "credits": 0,
            },
        )
    tier = credit_info.get("tier", "free")

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

    # Derive a friendly task name from the confirmed spec
    spec_name = (
        request.spec.get("part_name")
        or request.spec.get("description")
        or "CAD part"
    )
    task_name = str(spec_name).strip()[:60]

    try:
        token = generate_token("generation_service", audience="api_service")
        async with httpx.AsyncClient() as client:
            await client.patch(
                f"{API_SERVICE_URL}/tasks/{request.task_id}/script",
                json={
                    "cadquery_script": "",
                    "generation_prompt": prompt_text,
                    "conversation_history": conversation_json,
                    "task_name": task_name,
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
        tier=tier,
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
    # Credit check — refinement requires Pro or Enterprise
    credit_info = await _check_credits(request.user_id)
    if not credit_info.get("allowed"):
        raise HTTPException(
            status_code=402,
            detail={
                "detail": "Insufficient credits",
                "tier": credit_info.get("tier", "free"),
                "credits": 0,
            },
        )
    if credit_info.get("tier", "free") == "free":
        raise HTTPException(
            status_code=403,
            detail="Refinement requires Pro or Enterprise subscription",
        )
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


# ---------------------------------------------------------------------------
# Direct code execution (for code editor)
# ---------------------------------------------------------------------------

class ExecuteRequest(BaseModel):
    code: str
    task_id: str
    user_id: str
    timeout_seconds: int = 30


@router.post("/execute")
async def execute_code(
    request: ExecuteRequest,
    redis: AsyncRedis = Depends(get_redis),
    _: dict = Depends(get_authenticated_user),
):
    """Execute CadQuery code directly and return the result. For the code editor."""
    # Credit check
    credit_info = await _check_credits(request.user_id)
    if not credit_info.get("allowed"):
        raise HTTPException(
            status_code=402,
            detail={
                "detail": "Insufficient credits",
                "tier": credit_info.get("tier", "free"),
                "credits": 0,
            },
        )

    # Execute in sandbox (synchronous Docker call, run in thread)
    success, output_path, error, metadata = await asyncio.to_thread(
        execute_cadquery, request.code, request.timeout_seconds
    )

    if not success:
        return {"success": False, "error": error}

    # Upload STEP file to media_service
    job_id = await upload_step_file(output_path, request.user_id, request.task_id)
    if not job_id:
        return {"success": False, "error": "STEP file upload failed"}

    # Save script to task record
    await save_task_script(request.task_id, request.code, "", metadata)

    return {"success": True, "job_id": job_id, "metadata": metadata}


# ---------------------------------------------------------------------------
# Stepwise CAD generation — build plan + per-step execution
# ---------------------------------------------------------------------------

class PlanRequest(BaseModel):
    task_id: str
    user_id: str
    spec_text: str
    process: str = "fdm"
    material: str = "plastic"


@router.post("/cad/chat/plan")
async def create_build_plan(
    request: PlanRequest,
    _: dict = Depends(get_authenticated_user),
):
    """Generate a stepwise build plan from a part description."""
    # Credit check
    credit_info = await _check_credits(request.user_id)
    if not credit_info.get("allowed"):
        raise HTTPException(
            status_code=402,
            detail={
                "detail": "Insufficient credits",
                "tier": credit_info.get("tier", "free"),
                "credits": 0,
            },
        )

    plan = await generate_build_plan(
        request.spec_text, request.process, request.material
    )
    return {"steps": plan}


class StepRequest(BaseModel):
    task_id: str
    user_id: str
    existing_script: str
    step_description: str
    step_number: int
    process: str = "fdm"
    timeout_seconds: int = 30


@router.post("/cad/chat/step")
async def generate_and_execute_step(
    request: StepRequest,
    _: dict = Depends(get_authenticated_user),
):
    """Generate code for one build step, combine with existing script, and execute."""
    # Credit check
    credit_info = await _check_credits(request.user_id)
    if not credit_info.get("allowed"):
        raise HTTPException(
            status_code=402,
            detail={
                "detail": "Insufficient credits",
                "tier": credit_info.get("tier", "free"),
                "credits": 0,
            },
        )

    # Validate existing script before combining
    if request.existing_script:
        is_valid, reason = validate_code(request.existing_script)
        if not is_valid:
            return {"success": False, "error": f"Script validation failed: {reason}"}

    # Generate the new code fragment for this step
    new_code = await generate_step_code(
        request.existing_script, request.step_description, request.process
    )

    if new_code.startswith("CLARIFICATION:"):
        return {
            "success": False,
            "error": new_code,
            "new_code": "",
            "full_script": request.existing_script,
            "metadata": None,
        }

    # Combine existing script with new code
    full_script = request.existing_script + "\n\n" + new_code

    # Execute the combined script
    success, output_path, error, metadata = await asyncio.to_thread(
        execute_cadquery, full_script, request.timeout_seconds
    )

    if not success:
        return {
            "success": False,
            "error": error,
            "new_code": new_code,
            "full_script": full_script,
            "metadata": None,
        }

    # Upload STEP file
    job_id = await upload_step_file(output_path, request.user_id, request.task_id)

    if not job_id:
        return {
            "success": False,
            "error": "STEP file upload failed",
            "new_code": new_code,
            "full_script": full_script,
            "metadata": metadata,
        }

    # Save updated script
    await save_task_script(request.task_id, full_script, "", metadata)

    return {
        "success": True,
        "job_id": job_id,
        "new_code": new_code,
        "full_script": full_script,
        "metadata": metadata,
    }

"""Background task utilities for CAD generation."""
import os
import logging
import httpx
from redis.asyncio import Redis as AsyncRedis
from fastapi import Request, HTTPException

from fitd_schemas.fitd_classes import CadTaskRequest
from jwt_auth import generate_token

from claude_cad import generate_cadquery_code, fix_cadquery_code
from executor import execute_cadquery

logger = logging.getLogger(__name__)

DB_SERVICE_URL = os.getenv("DB_SERVICE_URL", "http://localhost:8000")
STEP_SERVICE_URL = os.getenv("STEP_SERVICE_URL", "http://localhost:1235")
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://localhost:2468")


async def publish(redis: AsyncRedis, port_id: str, message: str):
    """Publish a progress message to the Redis channel."""
    await redis.publish(f"task_progress:{port_id}", message)


async def generate_cad_task(request: CadTaskRequest, redis: AsyncRedis):
    """Main background task: generate CAD model from prompt.

    Progress messages follow the meshy_backend format:
      "{percentage},{task_id},{name}"
      "Task Completed,{task_id},{name}"
      "Task Failed,{error_message}"
    """
    port_id = request.port_id
    user_id = request.user_id
    prompt = request.prompt
    settings = request.settings
    max_iterations = settings.max_iterations if settings else 3
    timeout_seconds = settings.timeout_seconds if settings else 30
    target_units = settings.target_units if settings else "mm"

    task_name = prompt[:50].replace(",", " ")

    try:
        # Step 1: Generate initial code
        await publish(redis, port_id, f"10,generating,{task_name}")
        logger.info(f"[{port_id}] Generating CadQuery code for: {prompt[:80]}")

        code = await generate_cadquery_code(prompt, target_units)
        await publish(redis, port_id, f"25,generating,{task_name}")

        # Step 2: Execute with retry loop
        success = False
        last_error = ""
        attempt = 0

        for attempt in range(max_iterations):
            iter_progress = 25 + int((attempt / max_iterations) * 40)
            status_msg = f"Executing CadQuery (attempt {attempt + 1}/{max_iterations})"
            await publish(redis, port_id, f"{iter_progress},{status_msg},{task_name}")
            logger.info(f"[{port_id}] {status_msg}")

            success, output_path, error = execute_cadquery(code, timeout_seconds)

            if success:
                logger.info(f"[{port_id}] CadQuery succeeded on attempt {attempt + 1}")
                break

            last_error = error
            logger.warning(f"[{port_id}] Attempt {attempt + 1} failed: {error[:200]}")

            # Don't retry on last iteration
            if attempt < max_iterations - 1:
                fix_msg = f"Fixing code (attempt {attempt + 2}/{max_iterations})"
                await publish(redis, port_id, f"{iter_progress + 10},{fix_msg},{task_name}")
                code = await fix_cadquery_code(prompt, code, error, target_units)

        if not success:
            error_summary = last_error[:200] if last_error else "Unknown error"
            await publish(
                redis,
                port_id,
                f"Task Failed,Generation failed after {max_iterations} attempts: {error_summary}",
            )
            return

        # Step 3: Register task in db_service
        await publish(redis, port_id, f"70,registering,{task_name}")
        task_id = await register_task(user_id, task_name)

        if not task_id:
            await publish(redis, port_id, "Task Failed,Could not register task in database")
            return

        # Step 4: Upload STEP file to step_service
        await publish(redis, port_id, f"80,uploading,{task_name}")
        upload_ok = await upload_step_file(output_path, user_id, task_id)

        if not upload_ok:
            await publish(redis, port_id, "Task Failed,Could not upload STEP file")
            return

        # Step 5: Done
        await publish(redis, port_id, f"100,complete,{task_name}")
        await publish(redis, port_id, f"Task Completed,{task_id},{task_name}")
        logger.info(f"[{port_id}] CAD task completed: {task_id}")

    except Exception as e:
        logger.error(f"[{port_id}] CAD task error: {e}", exc_info=True)
        await publish(redis, port_id, f"Task Failed,{str(e)[:200]}")


async def register_task(user_id: str, task_name: str) -> str | None:
    """Register a new task in db_service, returns task_id."""
    auth_token = generate_token("cad_service")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}",
    }
    payload = {
        "user_id": user_id,
        "task_name": task_name,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{DB_SERVICE_URL}/tasks", json=payload, headers=headers
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("task_id")
            logger.error(f"register_task failed: {resp.status_code} {resp.text}")
    except Exception as e:
        logger.error(f"register_task error: {e}")
    return None


async def upload_step_file(file_path: str, user_id: str, task_id: str) -> bool:
    """Upload the generated STEP file to step_service."""
    try:
        with open(file_path, "rb") as f:
            file_content = f.read()

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{STEP_SERVICE_URL}/step/upload",
                files={"file": ("generated.step", file_content, "application/octet-stream")},
                data={"user_id": user_id, "task_id": task_id},
            )
            if resp.status_code == 200:
                logger.info(f"STEP file uploaded successfully for task {task_id}")
                return True
            logger.error(f"STEP upload failed: {resp.status_code} {resp.text}")
    except Exception as e:
        logger.error(f"STEP upload error: {e}")
    return False


async def validate_session(websocket) -> tuple[bool, str | None]:
    """Validate session from WebSocket cookies."""
    cookies = websocket.cookies
    session_id = cookies.get("session_id")
    if not session_id:
        return False, None

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{AUTH_SERVICE_URL}/get_session",
                cookies={"session_id": session_id},
            )
            if resp.status_code == 200:
                data = resp.json()
                return True, data.get("user_id")
    except Exception as e:
        logger.error(f"Session validation error: {e}")

    return False, None


async def cookie_verification(request: Request):
    """Verify session cookie for HTTP endpoints."""
    from fitd_schemas.auth_utils import cookie_verification_user_only

    return await cookie_verification_user_only(request)

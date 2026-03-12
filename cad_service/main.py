"""CAD Generation Service.

Uses Claude API to generate CadQuery Python code from text prompts,
executes it in a sandboxed subprocess, and uploads resulting STEP files
to the step_service for processing.
"""
import os
import logging
import uvicorn
from redis.asyncio import Redis as AsyncRedis
from dotenv import load_dotenv

load_dotenv()

from fastapi import (
    FastAPI,
    WebSocket,
    WebSocketDisconnect,
    BackgroundTasks,
    Depends,
)
from fastapi.middleware.cors import CORSMiddleware

from fitd_schemas.fitd_classes import CadTaskRequest
from utils import generate_cad_task, validate_session, cookie_verification

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

app = FastAPI(title="CAD Generation Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Redis Configuration
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))


async def get_redis():
    return AsyncRedis.from_url(
        f"redis://{REDIS_HOST}:{REDIS_PORT}", decode_responses=True
    )


@app.post("/start_cad_task/")
async def start_cad_task(
    request: CadTaskRequest,
    background_tasks: BackgroundTasks,
    redis: AsyncRedis = Depends(get_redis),
    _: None = Depends(cookie_verification),
):
    background_tasks.add_task(generate_cad_task, request, redis)
    return {"message": "CAD task started!", "task_id": request.port_id}


@app.websocket("/ws/{port_id}")
async def websocket_endpoint(
    websocket: WebSocket, port_id: str, redis: AsyncRedis = Depends(get_redis)
):
    ws_auth_enabled = os.getenv("WS_AUTH_ENABLED", "true").lower() == "true"
    if ws_auth_enabled:
        session_valid, user_id = await validate_session(websocket)
        if not session_valid:
            await websocket.close(code=1008, reason="Invalid session")
            return

    await websocket.accept()

    try:
        # Check if the task already finished before we connected
        existing_result = await redis.get(f"task_result:{port_id}")
        if existing_result:
            await websocket.send_text(existing_result)
            return

        pubsub = redis.pubsub()
        await pubsub.subscribe(f"task_progress:{port_id}")

        # Re-check after subscribing to avoid race window
        existing_result = await redis.get(f"task_result:{port_id}")
        if existing_result:
            await websocket.send_text(existing_result)
            return

        async for message in pubsub.listen():
            if message["type"] == "message":
                progress = message["data"]
                await websocket.send_text(progress)
                if progress.startswith("Task Completed") or progress.startswith(
                    "Task Failed"
                ):
                    break

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for task {port_id}")
    except Exception as e:
        logger.error(f"WebSocket Error: {e}")
    finally:
        await pubsub.unsubscribe(f"task_progress:{port_id}")
        await pubsub.close()
        await websocket.close()
        logger.info(f"WebSocket connection for task {port_id} closed.")


@app.get("/health")
async def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=1236)

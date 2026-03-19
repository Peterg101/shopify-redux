import os
import logging
import uvicorn
from redis.asyncio import Redis as AsyncRedis
from fastapi import (
    FastAPI,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    BackgroundTasks,
    Depends,
)
from fastapi.middleware.cors import CORSMiddleware
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)
from fitd_schemas.fitd_classes import (
    TaskRequest,
    ImageTo3DTaskRequest,
    RefineTaskRequest,
)

from utils import (
    generate_image_to_3d_task_and_check_for_response_decoupled_ws,
    generate_task_and_check_for_response_decoupled_ws,
    generate_refine_task_and_stream,
    validate_session,
    cookie_verification,
)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

app = FastAPI()
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
    redis = AsyncRedis.from_url(
        f"redis://{REDIS_HOST}:{REDIS_PORT}", decode_responses=True
    )
    return redis


@app.post("/start_task/")
async def start_task(
    request: TaskRequest,
    background_tasks: BackgroundTasks,
    redis: AsyncRedis = Depends(get_redis),
    _: None = Depends(cookie_verification),
):
    # Add the task to the background
    background_tasks.add_task(
        generate_task_and_check_for_response_decoupled_ws, request, redis
    )
    return {"message": "Task started!", "task_id": request.port_id}


@app.post("/start_image_to_3d_task/")
async def start_image_to_3d_task(
    request: ImageTo3DTaskRequest,
    background_tasks: BackgroundTasks,
    redis: AsyncRedis = Depends(get_redis),
    _: None = Depends(cookie_verification),
):
    # Add the task to the background
    background_tasks.add_task(
        generate_image_to_3d_task_and_check_for_response_decoupled_ws, request, redis
    )
    logger.info("background task successfully added")
    return {"message": "Task started!", "task_id": request.port_id}


@app.post("/start_refine_task/")
async def start_refine_task(
    request: RefineTaskRequest,
    background_tasks: BackgroundTasks,
    redis: AsyncRedis = Depends(get_redis),
    _: None = Depends(cookie_verification),
):
    background_tasks.add_task(generate_refine_task_and_stream, request, redis)
    return {"message": "Refine task started!", "task_id": request.port_id}


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

    pubsub = None
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
                # Send progress update to the client
                await websocket.send_text(progress)
                if progress.startswith("Task Completed") or progress.startswith("Task Failed"):
                    break

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for task {port_id}")
    except Exception as e:
        logger.error(f"WebSocket Error: {e}")
    finally:
        if pubsub is not None:
            await pubsub.unsubscribe(f"task_progress:{port_id}")
            await pubsub.close()
        try:
            await websocket.close()
        except Exception:
            pass
        logger.info(f"WebSocket connection for task {port_id} closed.")


@app.get("/health")
async def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=1234)

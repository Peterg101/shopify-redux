import os
from dotenv import load_dotenv

load_dotenv()

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as aioredis
import uvicorn

from meshy.routes import router as meshy_router
from cad.routes import router as cad_router
from shared import validate_session

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
WS_AUTH_ENABLED = os.getenv("WS_AUTH_ENABLED", "true").lower() == "true"


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = aioredis.from_url(
        f"redis://{REDIS_HOST}:{REDIS_PORT}", decode_responses=True
    )
    yield
    await app.state.redis.aclose()


app = FastAPI(title="Generation Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(meshy_router)
app.include_router(cad_router)


@app.websocket("/ws/{port_id}")
async def websocket_endpoint(websocket: WebSocket, port_id: str):
    """Unified WebSocket handler -- shared between Meshy and CAD tasks.

    Subscribes to the Redis pub/sub channel ``task_progress:{port_id}`` and
    relays messages to the connected client.  Handles the race condition where
    a task completes before the WebSocket connects by checking the
    ``task_result:{port_id}`` key before and after subscribing.
    """
    redis = app.state.redis

    if WS_AUTH_ENABLED:
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
        if pubsub is not None:
            await pubsub.unsubscribe(f"task_progress:{port_id}")
            await pubsub.close()
        try:
            await websocket.close()
        except Exception:
            pass
        logger.info(f"WebSocket connection for task {port_id} closed.")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "generation_service"}


if __name__ == "__main__":
    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=1234)

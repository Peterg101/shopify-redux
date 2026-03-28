import os
from dotenv import load_dotenv

load_dotenv()

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as aioredis
import uvicorn
from sse_starlette.sse import EventSourceResponse

from meshy.routes import router as meshy_router
from cad.routes import router as cad_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))


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


@app.get("/progress/{port_id}")
async def task_progress_stream(port_id: str, request: Request):
    """SSE endpoint for task progress — replaces WebSocket /ws/{port_id}.

    Sends cached progress state immediately on connect (survives page refresh),
    then streams live updates via Redis pub/sub.
    """
    redis = app.state.redis

    async def event_generator():
        # Send cached progress (enables refresh recovery)
        cached = await redis.get(f"task_state:{port_id}")
        if cached:
            yield {"data": cached}
            if cached.startswith("Task Completed") or cached.startswith("Task Failed"):
                return

        pubsub = redis.pubsub()
        await pubsub.subscribe(f"task_progress:{port_id}")

        try:
            # Re-check after subscribing (close race window)
            cached = await redis.get(f"task_state:{port_id}")
            if cached and (cached.startswith("Task Completed") or cached.startswith("Task Failed")):
                yield {"data": cached}
                return

            async for message in pubsub.listen():
                if await request.is_disconnected():
                    break
                if message["type"] == "message":
                    yield {"data": message["data"]}
                    if message["data"].startswith("Task Completed") or message["data"].startswith("Task Failed"):
                        break
        finally:
            await pubsub.unsubscribe(f"task_progress:{port_id}")
            await pubsub.close()

    return EventSourceResponse(event_generator(), ping=15)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "generation_service"}


# ── Dev Mock Endpoints ───────────────────────────────────────────────
# Simulate generation tasks without external APIs (Meshy, Ollama, Claude).
# Enable with MOCK_GENERATION=true in environment.

if os.getenv("MOCK_GENERATION", "false").lower() == "true":
    import asyncio
    import uuid
    from fastapi import BackgroundTasks, Depends
    from shared import get_redis, publish, register_task, mark_task_complete, cookie_verification

    async def _mock_generation(redis, port_id: str, task_name: str, task_type: str, user_id: str):
        """Simulate a 15-second generation task with progress updates."""
        # Register task in DB
        task_id = await register_task(user_id, task_name, port_id, file_type="glb" if task_type == "cad" else "obj")

        stages = [
            (5, "initializing"),
            (15, "processing geometry"),
            (30, "generating mesh"),
            (50, "refining details"),
            (70, "applying textures"),
            (85, "finalizing"),
            (95, "uploading"),
        ]

        for pct, status in stages:
            await asyncio.sleep(1.5)
            if task_type == "cad":
                await publish(redis, port_id, f"{pct},{status},{task_name}")
            else:
                await publish(redis, port_id, f"{pct},{task_id or 'mock'},{task_name}")

        # Simulate completion
        await asyncio.sleep(1.0)
        if task_id:
            await mark_task_complete(task_id)

        if task_type == "cad":
            await publish(redis, port_id, f"Task Completed,{task_id or 'mock'},{task_name},mock-job-001")
        else:
            await publish(redis, port_id, f"Task Completed,{task_id or 'mock'},{task_name}")

        logger.info(f"Mock {task_type} generation complete: {task_name} ({port_id})")

    @app.post("/mock/generate")
    async def mock_generate(
        background_tasks: BackgroundTasks,
        request: Request,
        redis=Depends(get_redis),
        _=Depends(cookie_verification),
    ):
        """Start a mock generation task. Returns port_id for SSE progress tracking.

        Usage: POST /mock/generate?type=meshy&name=my-model
        Then connect to GET /progress/{port_id} for SSE progress stream.
        """
        body = await request.json() if request.headers.get("content-type") == "application/json" else {}
        task_type = body.get("type", "meshy")
        task_name = body.get("name", f"mock-{task_type}-{uuid.uuid4().hex[:6]}")
        user_id = body.get("user_id", "mock-user")
        port_id = str(uuid.uuid4())

        background_tasks.add_task(_mock_generation, redis, port_id, task_name, task_type, user_id)

        return {
            "message": f"Mock {task_type} generation started",
            "port_id": port_id,
            "task_name": task_name,
        }

    logger.info("Mock generation endpoints enabled (MOCK_GENERATION=true)")


if __name__ == "__main__":
    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=1234)

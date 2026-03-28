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


if __name__ == "__main__":
    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=1234)

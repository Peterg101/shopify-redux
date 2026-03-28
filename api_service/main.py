import os
from dotenv import load_dotenv
load_dotenv()
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as aioredis
import httpx
import stripe
import uvicorn

from config import FRONTEND_URL, REDIS_HOST, REDIS_PORT, MEDIA_SERVICE_URL
from routes import auth, users, files, orders, claims, disbursements, disputes, fulfiller, catalog, tasks, events
from routes import stripe as stripe_routes

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    app.state.session_redis = aioredis.from_url(
        f"redis://{REDIS_HOST}:{REDIS_PORT}", decode_responses=True
    )
    app.state.media_client = httpx.AsyncClient(base_url=MEDIA_SERVICE_URL, timeout=30.0)
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
    logger.info("API service started")
    yield
    # Shutdown
    await app.state.session_redis.aclose()
    await app.state.media_client.aclose()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:1234", "http://localhost:100"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Include routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(files.router)
app.include_router(orders.router)
app.include_router(claims.router)
app.include_router(disbursements.router)
app.include_router(disputes.router)
app.include_router(fulfiller.router)
app.include_router(catalog.router)
app.include_router(tasks.router)
app.include_router(events.router)
app.include_router(stripe_routes.router)


if __name__ == "__main__":
    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=8000)

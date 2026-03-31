import os
from dotenv import load_dotenv
load_dotenv()
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
import redis.asyncio as aioredis
import httpx
import stripe
import uvicorn

from slowapi.errors import RateLimitExceeded

from config import FRONTEND_URL, REDIS_HOST, REDIS_PORT, MEDIA_SERVICE_URL, IS_PRODUCTION
from rate_limit import limiter
from logging_config import setup_logging
from routes import auth, users, files, orders, claims, disbursements, disputes, fulfiller, catalog, tasks, events, messages
from routes import stripe as stripe_routes

setup_logging()
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

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded. Please try again later."})


if IS_PRODUCTION:
    cors_origins = [FRONTEND_URL]
else:
    cors_origins = [FRONTEND_URL, "http://localhost:1234", "http://localhost:1235", "http://localhost:8081"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if IS_PRODUCTION:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
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
app.include_router(messages.router)
app.include_router(stripe_routes.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "api_service"}


if __name__ == "__main__":
    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=8000)

import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from fitd_schemas.fitd_db_schemas import Base
import redis as redis_lib

logger = logging.getLogger(__name__)

# Database URL
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./changing_the_schemas.db")

# SQLAlchemy Engine and Session
if "sqlite" not in DATABASE_URL:
    engine = create_engine(
        DATABASE_URL,
        pool_size=20,
        max_overflow=10,
        pool_pre_ping=True,
        pool_recycle=3600,
    )
else:
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Schema is managed by Alembic migrations — do not call create_all() here

# Redis connection (optional — gracefully degrades if unavailable)
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

try:
    _redis_client = redis_lib.Redis(
        host=REDIS_HOST, port=REDIS_PORT,
        decode_responses=True, socket_connect_timeout=2,
    )
    _redis_client.ping()
    logger.info(f"Redis connected at {REDIS_HOST}:{REDIS_PORT}")
except Exception:
    _redis_client = None
    logger.warning("Redis not available — caching disabled, falling through to DB")


def get_redis():
    """FastAPI dependency that provides the Redis client (or None)."""
    return _redis_client


# Dependency to get a database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

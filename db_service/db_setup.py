import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from fitd_schemas.fitd_db_schemas import Base

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


# Dependency to get a database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

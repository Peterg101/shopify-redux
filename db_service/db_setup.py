from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from models import Base

# Database URL
DATABASE_URL = "sqlite:///./test.db"  # Replace with your actual database URL

# SQLAlchemy Engine and Session
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})  # Remove `check_same_thread` for other DBs
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
# Base = declarative_base()
Base.metadata.create_all(bind=engine)

# Dependency to get a database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

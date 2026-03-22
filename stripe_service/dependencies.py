import os
from service_client import ServiceClient

DB_SERVICE_URL = os.getenv("DB_SERVICE_URL", "http://localhost:8000")


def get_db_api() -> ServiceClient:
    """FastAPI dependency that provides a ServiceClient for db_service."""
    return ServiceClient(DB_SERVICE_URL)

"""
Shared configuration constants for api_service.
"""
import os
from pathlib import Path

UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

MAX_FILE_SIZE_MB = 50
MAX_FILE_SIZE_B64 = MAX_FILE_SIZE_MB * 1024 * 1024 * 4 // 3  # base64 overhead

MAX_EVIDENCE_SIZE_MB = 10
MAX_EVIDENCE_SIZE_B64 = MAX_EVIDENCE_SIZE_MB * 1024 * 1024 * 4 // 3

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

MEDIA_SERVICE_URL = os.getenv("MEDIA_SERVICE_URL", os.getenv("STEP_SERVICE_URL", "http://localhost:1235"))

IS_PRODUCTION = os.getenv("ENV", "development") == "production"

"""STEP File Processing Service.

Handles STEP file uploads, server-side processing (validation, metadata
extraction, tessellation to glTF, thumbnail generation), and S3 storage.
"""
import os
import uuid
import logging
import tempfile
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from step_processor import validate_step_file, extract_metadata, tessellate_to_glb, generate_thumbnail
from s3_utils import upload_file, generate_presigned_url, ensure_bucket_exists

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
MAX_FILE_SIZE_MB = 100
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

# Local temp directory for processing
WORK_DIR = Path(tempfile.mkdtemp(prefix="step_service_"))

app = FastAPI(title="STEP File Processing Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# In-memory job store (production: Redis or DB)
jobs: dict = {}


class JobStatus(BaseModel):
    job_id: str
    status: str  # pending, processing, complete, failed
    progress: int  # 0-100
    user_id: str
    task_id: Optional[str] = None
    original_filename: str
    file_size_bytes: int
    s3_key_original: Optional[str] = None
    s3_key_preview: Optional[str] = None
    s3_key_thumbnail: Optional[str] = None
    bounding_box_x: Optional[float] = None
    bounding_box_y: Optional[float] = None
    bounding_box_z: Optional[float] = None
    volume_mm3: Optional[float] = None
    surface_area_mm2: Optional[float] = None
    error: Optional[str] = None
    created_at: str = ""
    completed_at: Optional[str] = None


@app.on_event("startup")
async def startup():
    try:
        ensure_bucket_exists()
    except Exception as e:
        logger.warning(f"Could not ensure S3 bucket exists: {e}")


@app.post("/step/upload", response_model=JobStatus)
async def upload_step_file(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    task_id: Optional[str] = Form(None),
):
    """Upload a STEP file for processing."""
    # Validate extension
    filename = file.filename or "unknown.step"
    ext = Path(filename).suffix.lower()
    if ext not in (".step", ".stp"):
        raise HTTPException(status_code=400, detail="Only .step and .stp files are accepted")

    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_FILE_SIZE_MB}MB limit")

    # Create job
    job_id = str(uuid.uuid4())
    job_dir = WORK_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    # Save file locally for processing
    local_path = job_dir / f"original{ext}"
    with open(local_path, "wb") as f:
        f.write(content)

    # Validate STEP header
    if not validate_step_file(str(local_path)):
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail="Invalid STEP file — missing ISO-10303-21 header")

    job = JobStatus(
        job_id=job_id,
        status="processing",
        progress=10,
        user_id=user_id,
        task_id=task_id,
        original_filename=filename,
        file_size_bytes=len(content),
        created_at=datetime.utcnow().isoformat(),
    )
    jobs[job_id] = job

    # Process synchronously for now (in production: Celery task)
    _process_step_file(job_id, str(local_path), user_id, task_id or job_id)

    return jobs[job_id]


def _process_step_file(job_id: str, file_path: str, user_id: str, task_id: str):
    """Process a STEP file: upload to S3, extract metadata, tessellate, thumbnail."""
    job = jobs[job_id]

    try:
        # Step 1: Upload original to S3
        s3_key = f"files/{user_id}/{task_id}/original.step"
        try:
            upload_file(file_path, s3_key, content_type="application/step")
            job.s3_key_original = s3_key
        except Exception as e:
            logger.warning(f"S3 upload failed (continuing without): {e}")
        job.progress = 30

        # Step 2: Extract metadata
        metadata = extract_metadata(file_path)
        if metadata.is_valid:
            job.bounding_box_x = metadata.bounding_box_x
            job.bounding_box_y = metadata.bounding_box_y
            job.bounding_box_z = metadata.bounding_box_z
            job.volume_mm3 = metadata.volume_mm3
            job.surface_area_mm2 = metadata.surface_area_mm2
        job.progress = 60

        # Step 3: Tessellate to glTF
        job_dir = Path(file_path).parent
        preview_path = str(job_dir / "preview.glb")
        if tessellate_to_glb(file_path, preview_path):
            preview_key = f"files/{user_id}/{task_id}/preview.glb"
            try:
                upload_file(preview_path, preview_key, content_type="model/gltf-binary")
                job.s3_key_preview = preview_key
            except Exception as e:
                logger.warning(f"Preview S3 upload failed: {e}")
        job.progress = 80

        # Step 4: Generate thumbnail
        thumbnail_path = str(job_dir / "thumbnail.png")
        if generate_thumbnail(file_path, thumbnail_path):
            thumb_key = f"files/{user_id}/{task_id}/thumbnail.png"
            try:
                upload_file(thumbnail_path, thumb_key, content_type="image/png")
                job.s3_key_thumbnail = thumb_key
            except Exception as e:
                logger.warning(f"Thumbnail S3 upload failed: {e}")
        job.progress = 100

        job.status = "complete"
        job.completed_at = datetime.utcnow().isoformat()
        logger.info(f"Job {job_id} completed successfully")

    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        job.status = "failed"
        job.error = str(e)
        job.completed_at = datetime.utcnow().isoformat()

    finally:
        # Clean up local files
        job_dir = Path(file_path).parent
        shutil.rmtree(job_dir, ignore_errors=True)


@app.get("/step/{job_id}/status", response_model=JobStatus)
async def get_job_status(job_id: str):
    """Get the processing status of a STEP file upload."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]


@app.get("/step/{job_id}/preview_url")
async def get_preview_url(job_id: str):
    """Get a signed URL for the glTF preview of a processed STEP file."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]
    if job.status != "complete":
        raise HTTPException(status_code=400, detail=f"Job is {job.status}, not complete")
    if not job.s3_key_preview:
        raise HTTPException(status_code=404, detail="No preview available for this file")

    try:
        url = generate_presigned_url(job.s3_key_preview)
        return {"url": url, "content_type": "model/gltf-binary"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate URL: {e}")


@app.get("/step/{job_id}/download_url")
async def get_download_url(job_id: str):
    """Get a signed URL for downloading the original STEP file."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]
    if not job.s3_key_original:
        raise HTTPException(status_code=404, detail="No file available")

    try:
        url = generate_presigned_url(job.s3_key_original)
        return {"url": url, "filename": job.original_filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate URL: {e}")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "step_service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=1235)

"""STEP File Processing Service.

Handles STEP file uploads, server-side processing (validation, metadata
extraction, tessellation to glTF, thumbnail generation), and S3 storage.
"""
import os
import uuid
import logging
import asyncio
import tempfile
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from jwt_auth import verify_jwt_token
from step_processor import validate_step_file, extract_metadata, tessellate_to_glb, generate_thumbnail, generate_multiview
from s3_utils import upload_file, generate_presigned_url, ensure_bucket_exists, find_preview_key_by_task_id, find_thumbnail_key_by_task_id, find_original_key_by_task_id

if os.getenv("ENV") == "production":
    import sys
    from pythonjsonlogger import jsonlogger
    _handler = logging.StreamHandler(sys.stdout)
    _handler.setFormatter(jsonlogger.JsonFormatter(
        "%(asctime)s %(name)s %(levelname)s %(message)s",
        rename_fields={"asctime": "timestamp", "levelname": "level"},
    ))
    logging.root.handlers = [_handler]
    logging.root.setLevel(logging.INFO)
else:
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
    allow_origins=[FRONTEND_URL],
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


@app.post("/step/upload", response_model=JobStatus, status_code=201)
async def upload_step_file(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    task_id: Optional[str] = Form(None),
    _: str = Depends(verify_jwt_token),
):
    """Upload a STEP file for processing."""
    # Validate extension
    filename = file.filename or "unknown.step"
    ext = Path(filename).suffix.lower()
    if ext not in (".step", ".stp"):
        raise HTTPException(status_code=400, detail="Only .step and .stp files are accepted")

    # Pre-check Content-Length
    content_length = file.size
    if content_length and content_length > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_FILE_SIZE_MB}MB limit")

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
    await asyncio.to_thread(_process_step_file, job_id, str(local_path), user_id, task_id or job_id)

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
        logger.info(f"Job {job_id}: Starting tessellation...")
        tess_ok = tessellate_to_glb(file_path, preview_path)
        if tess_ok:
            preview_key = f"files/{user_id}/{task_id}/preview.glb"
            try:
                upload_file(preview_path, preview_key, content_type="model/gltf-binary")
                job.s3_key_preview = preview_key
                logger.info(f"Job {job_id}: GLB preview uploaded to S3: {preview_key}")
            except Exception as e:
                logger.error(f"Job {job_id}: Preview S3 upload FAILED: {e}")
        else:
            logger.error(f"Job {job_id}: Tessellation FAILED — no GLB preview will be available")
        job.progress = 80

        # Step 4: Generate thumbnail
        thumbnail_path = str(job_dir / "thumbnail.png")
        logger.info(f"Job {job_id}: Starting thumbnail generation...")
        thumb_ok = generate_thumbnail(file_path, thumbnail_path)
        if thumb_ok:
            thumb_key = f"files/{user_id}/{task_id}/thumbnail.png"
            try:
                upload_file(thumbnail_path, thumb_key, content_type="image/png")
                job.s3_key_thumbnail = thumb_key
                logger.info(f"Job {job_id}: Thumbnail uploaded to S3: {thumb_key}")
            except Exception as e:
                logger.error(f"Job {job_id}: Thumbnail S3 upload FAILED: {e}")
        else:
            logger.error(f"Job {job_id}: Thumbnail generation FAILED")
        job.progress = 100

        job.status = "complete"
        job.completed_at = datetime.utcnow().isoformat()
        has_preview = "yes" if job.s3_key_preview else "NO"
        has_thumb = "yes" if job.s3_key_thumbnail else "NO"
        logger.info(f"Job {job_id} completed — preview: {has_preview}, thumbnail: {has_thumb}")

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
def get_job_status(job_id: str):
    """Get the processing status of a STEP file upload."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]


@app.get("/step/{job_id}/preview_url")
def get_preview_url(job_id: str):
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


@app.get("/step/by_task/{task_id}/preview_url")
def get_preview_url_by_task(task_id: str):
    """Get a signed URL for the glTF preview, looked up by task_id."""
    # Check in-memory jobs first
    job = next((j for j in jobs.values() if j.task_id == task_id), None)
    if job:
        if job.status != "complete":
            raise HTTPException(status_code=400, detail=f"Job is {job.status}, not complete")
        if not job.s3_key_preview:
            raise HTTPException(status_code=404, detail="No preview available for this file")
        s3_key = job.s3_key_preview
    else:
        # Fallback: search S3 directly (survives service restarts)
        s3_key = find_preview_key_by_task_id(task_id)
        if not s3_key:
            raise HTTPException(status_code=404, detail="No preview found for this task_id")

    try:
        url = generate_presigned_url(s3_key)
        return {"url": url, "content_type": "model/gltf-binary"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate URL: {e}")


@app.get("/step/{job_id}/download_url")
def get_download_url(job_id: str):
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


@app.get("/step/by_task/{task_id}/download_url")
def get_download_url_by_task(task_id: str):
    """Get a signed URL for downloading the original STEP file, looked up by task_id."""
    # Check in-memory jobs first
    job = next((j for j in jobs.values() if j.task_id == task_id), None)
    if job and job.s3_key_original:
        s3_key = job.s3_key_original
    else:
        # Fallback: search S3 directly
        s3_key = find_original_key_by_task_id(task_id)
        if not s3_key:
            raise HTTPException(status_code=404, detail="No STEP file found for this task_id")

    try:
        url = generate_presigned_url(s3_key)
        return {"url": url, "filename": f"{task_id}.step"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate URL: {e}")


@app.get("/thumbnail/{task_id}")
async def get_thumbnail(task_id: str):
    """Get a thumbnail image for a task by redirecting to the presigned S3 URL."""
    # Check in-memory jobs first
    job = next((j for j in jobs.values() if j.task_id == task_id), None)
    if job and job.s3_key_thumbnail:
        s3_key = job.s3_key_thumbnail
    else:
        # Fallback: search S3 directly (survives service restarts)
        s3_key = find_thumbnail_key_by_task_id(task_id)
        if not s3_key:
            raise HTTPException(status_code=404, detail="Thumbnail not found")

    try:
        url = generate_presigned_url(s3_key)
        return RedirectResponse(url=url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate thumbnail URL: {e}")


@app.post("/thumbnail/generate")
async def generate_thumbnail_endpoint(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    task_id: str = Form(...),
    authorization: str = Depends(verify_jwt_token),
):
    """Upload a 3D file, generate a thumbnail, store in S3, and return the URL."""
    filename = file.filename or "unknown.stl"
    ext = Path(filename).suffix.lower().strip(".")

    supported_types = {"step", "stp", "obj", "stl", "glb"}
    if ext not in supported_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '.{ext}'. Supported: {', '.join(sorted(supported_types))}",
        )

    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_FILE_SIZE_MB}MB limit")

    # Save to temp dir
    job_dir = WORK_DIR / f"thumb_{uuid.uuid4().hex}"
    job_dir.mkdir(parents=True, exist_ok=True)

    try:
        local_path = str(job_dir / f"input.{ext}")
        with open(local_path, "wb") as f:
            f.write(content)

        thumbnail_path = str(job_dir / "thumbnail.png")
        file_type = "step" if ext in ("step", "stp") else ext

        success = await asyncio.to_thread(
            generate_thumbnail, local_path, thumbnail_path, 512, 512, file_type
        )

        if not success:
            raise HTTPException(status_code=500, detail="Thumbnail generation failed")

        # Upload to S3
        s3_key = f"files/{user_id}/{task_id}/thumbnail.png"
        upload_file(thumbnail_path, s3_key, content_type="image/png")
        url = generate_presigned_url(s3_key)

        return {"thumbnail_url": url, "s3_key": s3_key}

    finally:
        shutil.rmtree(job_dir, ignore_errors=True)


@app.post("/step/{job_id}/render_views")
async def render_views(job_id: str):
    """Render multi-view images of a processed STEP file for visual verification.

    Returns base64-encoded PNG images for each view (front, right, top, isometric).
    """
    import base64
    import tempfile
    import shutil

    # Look up the actual S3 key from the job record
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    step_key = getattr(job, "s3_key_original", None)
    if not step_key:
        raise HTTPException(status_code=404, detail=f"No STEP file stored for job {job_id}")

    job_dir = tempfile.mkdtemp(prefix=f"views_{job_id}_")

    try:
        step_path = os.path.join(job_dir, "model.step")
        from s3_utils import get_s3_client, BUCKET_NAME
        try:
            s3 = get_s3_client()
            s3.download_file(BUCKET_NAME, step_key, step_path)
        except Exception as dl_err:
            logger.error(f"S3 download failed for {step_key}: {dl_err}")
            raise HTTPException(status_code=404, detail=f"STEP file not found in S3: {step_key}")

        if not os.path.exists(step_path):
            raise HTTPException(status_code=404, detail="STEP file not found after download")

        views = generate_multiview(step_path, job_dir, file_type="step")

        result = {}
        for view_name, png_path in views.items():
            with open(png_path, "rb") as f:
                result[view_name] = base64.b64encode(f.read()).decode("utf-8")

        return {"views": result, "job_id": job_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Render views failed for {job_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "media_service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=1235)

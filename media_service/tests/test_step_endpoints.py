"""Tests for step_service FastAPI endpoints.

All S3 and CadQuery dependencies are mocked via conftest fixtures.
"""
import io
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

# Ensure step_service root is on path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from conftest import VALID_STEP_CONTENT, INVALID_STEP_CONTENT


# ==========================================================================
# Health check
# ==========================================================================
class TestHealthCheck:
    def test_health_returns_ok(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["service"] == "step_service"


# ==========================================================================
# POST /step/upload
# ==========================================================================
class TestUploadStepFile:
    def _upload(self, client, content=None, filename="part.step", user_id="user-1", task_id="task-1"):
        """Helper: upload a file via the endpoint."""
        if content is None:
            content = VALID_STEP_CONTENT
        return client.post(
            "/step/upload",
            files={"file": (filename, io.BytesIO(content), "application/octet-stream")},
            data={"user_id": user_id, "task_id": task_id},
        )

    def test_upload_valid_step_file(self, client):
        resp = self._upload(client)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "complete"
        assert data["progress"] == 100
        assert data["user_id"] == "user-1"
        assert data["task_id"] == "task-1"
        assert data["original_filename"] == "part.step"
        assert data["file_size_bytes"] == len(VALID_STEP_CONTENT)
        assert data["bounding_box_x"] == 100.0
        assert data["bounding_box_y"] == 50.0
        assert data["bounding_box_z"] == 25.0
        assert data["volume_mm3"] == 125000.0
        assert data["surface_area_mm2"] == 35000.0
        assert data["s3_key_original"] is not None
        assert data["s3_key_preview"] is not None

    def test_upload_stp_extension_accepted(self, client):
        resp = self._upload(client, filename="part.stp")
        assert resp.status_code == 200
        assert resp.json()["original_filename"] == "part.stp"

    def test_upload_uppercase_extension_accepted(self, client):
        resp = self._upload(client, filename="part.STEP")
        assert resp.status_code == 200

    def test_upload_invalid_extension_rejected(self, client):
        resp = self._upload(client, filename="model.obj")
        assert resp.status_code == 400
        assert "Only .step and .stp" in resp.json()["detail"]

    def test_upload_stl_extension_rejected(self, client):
        resp = self._upload(client, filename="model.stl")
        assert resp.status_code == 400

    def test_upload_invalid_header_rejected(self, client):
        """File has .step extension but lacks ISO-10303-21 header."""
        # Need to un-mock validate_step_file so real validation runs
        with patch("main.validate_step_file", return_value=False):
            resp = self._upload(client, content=INVALID_STEP_CONTENT, filename="bad.step")
        assert resp.status_code == 400
        assert "ISO-10303-21" in resp.json()["detail"]

    def test_upload_oversized_file_rejected(self, client):
        """File exceeding 100MB should return 413."""
        # Create content just over the limit (100MB + 1 byte)
        # We can't actually allocate 100MB in tests, so mock the read
        # Instead: patch MAX_FILE_SIZE_BYTES to something small
        with patch("main.MAX_FILE_SIZE_BYTES", 50):
            resp = self._upload(client, content=VALID_STEP_CONTENT)
        assert resp.status_code == 413
        assert "limit" in resp.json()["detail"].lower()

    def test_upload_without_task_id(self, client):
        """task_id is optional; job_id should be used as fallback."""
        resp = client.post(
            "/step/upload",
            files={"file": ("part.step", io.BytesIO(VALID_STEP_CONTENT), "application/octet-stream")},
            data={"user_id": "user-1"},
        )
        assert resp.status_code == 200
        data = resp.json()
        # When task_id is None, _process_step_file uses job_id as the task_id for S3 keys
        assert data["job_id"] is not None

    def test_upload_creates_unique_job_ids(self, client):
        resp1 = self._upload(client, user_id="u1", task_id="t1")
        resp2 = self._upload(client, user_id="u2", task_id="t2")
        assert resp1.json()["job_id"] != resp2.json()["job_id"]

    def test_upload_with_s3_failure_still_completes(self, client):
        """S3 upload failure should not fail the whole job (graceful degradation)."""
        with patch("main.upload_file", side_effect=Exception("S3 unreachable")):
            resp = self._upload(client)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "complete"
        # S3 keys should be None since uploads failed
        assert data["s3_key_original"] is None
        assert data["s3_key_preview"] is None


# ==========================================================================
# GET /step/{job_id}/status
# ==========================================================================
class TestGetJobStatus:
    def test_get_existing_job_status(self, client):
        # Create a job via upload first
        upload_resp = client.post(
            "/step/upload",
            files={"file": ("part.step", io.BytesIO(VALID_STEP_CONTENT), "application/octet-stream")},
            data={"user_id": "user-1", "task_id": "task-1"},
        )
        job_id = upload_resp.json()["job_id"]

        resp = client.get(f"/step/{job_id}/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["job_id"] == job_id
        assert data["status"] == "complete"

    def test_get_nonexistent_job_returns_404(self, client):
        resp = client.get("/step/nonexistent-job-id/status")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()


# ==========================================================================
# GET /step/{job_id}/preview_url
# ==========================================================================
class TestGetPreviewUrl:
    def _create_job(self, client):
        resp = client.post(
            "/step/upload",
            files={"file": ("part.step", io.BytesIO(VALID_STEP_CONTENT), "application/octet-stream")},
            data={"user_id": "user-1", "task_id": "task-1"},
        )
        return resp.json()["job_id"]

    def test_preview_url_for_complete_job(self, client):
        job_id = self._create_job(client)
        resp = client.get(f"/step/{job_id}/preview_url")
        assert resp.status_code == 200
        data = resp.json()
        assert "url" in data
        assert data["content_type"] == "model/gltf-binary"

    def test_preview_url_nonexistent_job(self, client):
        resp = client.get("/step/no-such-job/preview_url")
        assert resp.status_code == 404

    def test_preview_url_incomplete_job(self, client):
        """A job still processing should return 400."""
        from main import JobStatus, jobs

        jobs["in-progress"] = JobStatus(
            job_id="in-progress",
            status="processing",
            progress=50,
            user_id="u1",
            original_filename="test.step",
            file_size_bytes=100,
            created_at="2024-01-01T00:00:00",
        )
        resp = client.get("/step/in-progress/preview_url")
        assert resp.status_code == 400
        assert "processing" in resp.json()["detail"]

    def test_preview_url_job_without_preview(self, client):
        """A complete job that has no preview (tessellation failed) should return 404."""
        from main import JobStatus, jobs

        jobs["no-preview"] = JobStatus(
            job_id="no-preview",
            status="complete",
            progress=100,
            user_id="u1",
            original_filename="test.step",
            file_size_bytes=100,
            created_at="2024-01-01T00:00:00",
            s3_key_preview=None,
        )
        resp = client.get("/step/no-preview/preview_url")
        assert resp.status_code == 404
        assert "No preview" in resp.json()["detail"]

    def test_preview_url_presign_failure(self, client):
        """If S3 presigning fails, return 500."""
        job_id = self._create_job(client)
        with patch("main.generate_presigned_url", side_effect=Exception("S3 down")):
            resp = client.get(f"/step/{job_id}/preview_url")
        assert resp.status_code == 500


# ==========================================================================
# GET /step/by_task/{task_id}/preview_url
# ==========================================================================
class TestGetPreviewUrlByTask:
    def test_preview_by_task_id_in_memory(self, client):
        """When job is in memory, use it directly."""
        resp = client.post(
            "/step/upload",
            files={"file": ("part.step", io.BytesIO(VALID_STEP_CONTENT), "application/octet-stream")},
            data={"user_id": "user-1", "task_id": "my-task-123"},
        )
        assert resp.status_code == 200

        resp = client.get("/step/by_task/my-task-123/preview_url")
        assert resp.status_code == 200
        data = resp.json()
        assert "url" in data
        assert data["content_type"] == "model/gltf-binary"

    def test_preview_by_task_s3_fallback(self, client_with_s3_fallback):
        """When job is NOT in memory, fall back to S3 search."""
        resp = client_with_s3_fallback.get("/step/by_task/task1/preview_url")
        assert resp.status_code == 200
        data = resp.json()
        assert "url" in data

    def test_preview_by_unknown_task_id(self, client):
        """Unknown task_id with no S3 fallback returns 404."""
        resp = client.get("/step/by_task/nonexistent-task/preview_url")
        assert resp.status_code == 404
        assert "No preview found" in resp.json()["detail"]

    def test_preview_by_task_incomplete_job(self, client):
        """In-memory job still processing should return 400."""
        from main import JobStatus, jobs

        jobs["proc-job"] = JobStatus(
            job_id="proc-job",
            status="processing",
            progress=50,
            user_id="u1",
            task_id="incomplete-task",
            original_filename="test.step",
            file_size_bytes=100,
            created_at="2024-01-01T00:00:00",
        )
        resp = client.get("/step/by_task/incomplete-task/preview_url")
        assert resp.status_code == 400

    def test_preview_by_task_no_preview_key(self, client):
        """Complete in-memory job with no preview key should return 404."""
        from main import JobStatus, jobs

        jobs["no-prev-job"] = JobStatus(
            job_id="no-prev-job",
            status="complete",
            progress=100,
            user_id="u1",
            task_id="no-preview-task",
            original_filename="test.step",
            file_size_bytes=100,
            created_at="2024-01-01T00:00:00",
            s3_key_preview=None,
        )
        resp = client.get("/step/by_task/no-preview-task/preview_url")
        assert resp.status_code == 404


# ==========================================================================
# GET /step/{job_id}/download_url
# ==========================================================================
class TestGetDownloadUrl:
    def _create_job(self, client):
        resp = client.post(
            "/step/upload",
            files={"file": ("part.step", io.BytesIO(VALID_STEP_CONTENT), "application/octet-stream")},
            data={"user_id": "user-1", "task_id": "task-1"},
        )
        return resp.json()["job_id"]

    def test_download_url_for_existing_job(self, client):
        job_id = self._create_job(client)
        resp = client.get(f"/step/{job_id}/download_url")
        assert resp.status_code == 200
        data = resp.json()
        assert "url" in data
        assert data["filename"] == "part.step"

    def test_download_url_nonexistent_job(self, client):
        resp = client.get("/step/no-such-job/download_url")
        assert resp.status_code == 404

    def test_download_url_job_without_original(self, client):
        """Job where S3 upload of original failed (no s3_key_original)."""
        from main import JobStatus, jobs

        jobs["no-orig"] = JobStatus(
            job_id="no-orig",
            status="complete",
            progress=100,
            user_id="u1",
            original_filename="test.step",
            file_size_bytes=100,
            created_at="2024-01-01T00:00:00",
            s3_key_original=None,
        )
        resp = client.get("/step/no-orig/download_url")
        assert resp.status_code == 404
        assert "No file available" in resp.json()["detail"]

    def test_download_url_presign_failure(self, client):
        job_id = self._create_job(client)
        with patch("main.generate_presigned_url", side_effect=Exception("S3 down")):
            resp = client.get(f"/step/{job_id}/download_url")
        assert resp.status_code == 500


# ==========================================================================
# Edge cases and _process_step_file internal behaviour
# ==========================================================================
class TestProcessStepFileInternals:
    def test_metadata_extraction_failure_still_completes(self, client):
        """If metadata extraction returns invalid, job still completes."""
        from step_processor import StepMetadata

        bad_meta = StepMetadata(is_valid=False, error="CadQuery crashed")
        with patch("main.extract_metadata", return_value=bad_meta):
            resp = client.post(
                "/step/upload",
                files={"file": ("part.step", io.BytesIO(VALID_STEP_CONTENT), "application/octet-stream")},
                data={"user_id": "user-1", "task_id": "task-1"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "complete"
        # Metadata fields should be None since extraction failed
        assert data["bounding_box_x"] is None

    def test_tessellation_failure_still_completes(self, client):
        """If tessellation fails, job completes without preview."""
        with patch("main.tessellate_to_glb", return_value=False):
            resp = client.post(
                "/step/upload",
                files={"file": ("part.step", io.BytesIO(VALID_STEP_CONTENT), "application/octet-stream")},
                data={"user_id": "user-1", "task_id": "task-1"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "complete"
        assert data["s3_key_preview"] is None

    def test_thumbnail_failure_still_completes(self, client):
        """If thumbnail generation fails, job completes without thumbnail."""
        with patch("main.generate_thumbnail", return_value=False):
            resp = client.post(
                "/step/upload",
                files={"file": ("part.step", io.BytesIO(VALID_STEP_CONTENT), "application/octet-stream")},
                data={"user_id": "user-1", "task_id": "task-1"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "complete"
        assert data["s3_key_thumbnail"] is None

    def test_catastrophic_processing_failure(self, client):
        """If _process_step_file raises unexpectedly, job status should be failed."""
        with patch("main.extract_metadata", side_effect=RuntimeError("Segfault")):
            resp = client.post(
                "/step/upload",
                files={"file": ("part.step", io.BytesIO(VALID_STEP_CONTENT), "application/octet-stream")},
                data={"user_id": "user-1", "task_id": "task-1"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "failed"
        assert "Segfault" in data["error"]

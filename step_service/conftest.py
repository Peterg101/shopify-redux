"""Shared fixtures for step_service tests.

Mocks S3 and CadQuery/trimesh so tests run without heavy dependencies.
"""
import sys
import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path

# Ensure step_service source is importable
sys.path.insert(0, str(Path(__file__).parent))


# ---------------------------------------------------------------------------
# Minimal STEP file content for upload tests
# ---------------------------------------------------------------------------
VALID_STEP_CONTENT = (
    b"ISO-10303-21;\n"
    b"HEADER;\n"
    b"FILE_DESCRIPTION(('STEP test file'),'2;1');\n"
    b"FILE_NAME('test.step','2024-01-01',('Author'),(''),'','','');\n"
    b"FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));\n"
    b"ENDSEC;\n"
    b"DATA;\n"
    b"ENDSEC;\n"
    b"END-ISO-10303-21;\n"
)

INVALID_STEP_CONTENT = b"This is not a valid STEP file at all."


@pytest.fixture()
def valid_step_bytes():
    return VALID_STEP_CONTENT


@pytest.fixture()
def invalid_step_bytes():
    return INVALID_STEP_CONTENT


# ---------------------------------------------------------------------------
# FastAPI TestClient with all heavy deps mocked
# ---------------------------------------------------------------------------
@pytest.fixture()
def client():
    """TestClient that mocks S3, CadQuery-based processing, and startup event."""
    from step_processor import StepMetadata

    mock_metadata = StepMetadata(
        bounding_box_x=100.0,
        bounding_box_y=50.0,
        bounding_box_z=25.0,
        volume_mm3=125000.0,
        surface_area_mm2=35000.0,
        is_valid=True,
    )

    with (
        patch("main.ensure_bucket_exists"),
        patch("main.upload_file") as mock_upload,
        patch("main.generate_presigned_url", return_value="https://s3.example.com/signed-url"),
        patch("main.find_preview_key_by_task_id", return_value=None),
        patch("main.extract_metadata", return_value=mock_metadata),
        patch("main.tessellate_to_glb", return_value=True),
        patch("main.generate_thumbnail", return_value=True),
    ):
        # Import app inside patch context so startup event uses mocked ensure_bucket_exists
        from main import app, jobs
        from fastapi.testclient import TestClient

        # Clear any leftover jobs between tests
        jobs.clear()

        test_client = TestClient(app)
        test_client._mock_upload = mock_upload  # expose for assertions if needed
        test_client._jobs = jobs  # expose for direct job injection
        yield test_client

        # Cleanup
        jobs.clear()


@pytest.fixture()
def client_with_s3_fallback():
    """TestClient where find_preview_key_by_task_id returns a key (S3 fallback path)."""
    from step_processor import StepMetadata

    mock_metadata = StepMetadata(is_valid=True)

    with (
        patch("main.ensure_bucket_exists"),
        patch("main.upload_file"),
        patch("main.generate_presigned_url", return_value="https://s3.example.com/fallback-url"),
        patch("main.find_preview_key_by_task_id", return_value="files/user1/task1/preview.glb"),
        patch("main.extract_metadata", return_value=mock_metadata),
        patch("main.tessellate_to_glb", return_value=True),
        patch("main.generate_thumbnail", return_value=True),
    ):
        from main import app, jobs
        from fastapi.testclient import TestClient

        jobs.clear()
        test_client = TestClient(app)
        test_client._jobs = jobs
        yield test_client
        jobs.clear()

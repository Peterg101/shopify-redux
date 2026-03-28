"""Unit tests for step_processor.py functions.

Tests run without CadQuery or trimesh installed — all heavy imports are mocked.
"""
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

# Ensure step_service root is on path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from step_processor import (
    validate_step_file,
    extract_metadata,
    tessellate_to_glb,
    generate_thumbnail,
    StepMetadata,
    STEP_HEADER_MAGIC,
)


# ==========================================================================
# validate_step_file
# ==========================================================================
class TestValidateStepFile:
    def test_valid_step_file(self, tmp_path):
        f = tmp_path / "valid.step"
        f.write_text(f"{STEP_HEADER_MAGIC};\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;")
        assert validate_step_file(str(f)) is True

    def test_valid_header_with_leading_whitespace(self, tmp_path):
        f = tmp_path / "ws.step"
        f.write_text(f"  \n{STEP_HEADER_MAGIC};\nHEADER;\nENDSEC;")
        assert validate_step_file(str(f)) is True

    def test_invalid_content(self, tmp_path):
        f = tmp_path / "invalid.step"
        f.write_text("This file has no STEP header at all.")
        assert validate_step_file(str(f)) is False

    def test_empty_file(self, tmp_path):
        f = tmp_path / "empty.step"
        f.write_text("")
        assert validate_step_file(str(f)) is False

    def test_nonexistent_file(self):
        assert validate_step_file("/tmp/does_not_exist_abc123.step") is False

    def test_binary_file_with_header(self, tmp_path):
        """Binary file that happens to contain the magic string."""
        f = tmp_path / "binary.step"
        content = b"\x00\x01\x02" + STEP_HEADER_MAGIC.encode() + b"\x00\x03\x04"
        f.write_bytes(content)
        assert validate_step_file(str(f)) is True

    def test_header_beyond_256_chars(self, tmp_path):
        """Header magic beyond first 256 chars should NOT be detected."""
        f = tmp_path / "late_header.step"
        padding = "X" * 300
        f.write_text(padding + STEP_HEADER_MAGIC)
        assert validate_step_file(str(f)) is False


# ==========================================================================
# extract_metadata
# ==========================================================================
class TestExtractMetadata:
    def test_invalid_file_returns_invalid_metadata(self, tmp_path):
        f = tmp_path / "bad.step"
        f.write_text("not a step file")
        result = extract_metadata(str(f))
        assert result.is_valid is False
        assert result.error is not None

    def test_cadquery_not_installed(self, tmp_path):
        """When CadQuery import fails, return valid but empty metadata."""
        f = tmp_path / "valid.step"
        f.write_text(f"{STEP_HEADER_MAGIC};\nHEADER;\nENDSEC;\nDATA;\nENDSEC;")

        with patch.dict("sys.modules", {"cadquery": None}):
            # Force ImportError by making the import raise
            with patch("builtins.__import__", side_effect=_make_import_raiser("cadquery")):
                result = extract_metadata(str(f))

        assert result.is_valid is True
        assert result.error is not None
        assert "CadQuery" in result.error or "cadquery" in result.error.lower()
        assert result.bounding_box_x is None

    def test_cadquery_success(self, tmp_path):
        """When CadQuery works, extract full metadata."""
        f = tmp_path / "valid.step"
        f.write_text(f"{STEP_HEADER_MAGIC};\nHEADER;\nENDSEC;\nDATA;\nENDSEC;")

        # Mock CadQuery internals
        mock_bb = MagicMock()
        mock_bb.xlen = 10.123
        mock_bb.ylen = 20.456
        mock_bb.zlen = 30.789

        mock_shape = MagicMock()
        mock_shape.BoundingBox.return_value = mock_bb
        mock_shape.Volume.return_value = 6283.185
        mock_shape.Area.return_value = 1570.796

        mock_result = MagicMock()
        mock_result.val.return_value = mock_shape

        mock_cq = MagicMock()
        mock_cq.importers.importStep.return_value = mock_result

        with patch.dict("sys.modules", {"cadquery": mock_cq}):
            result = extract_metadata(str(f))

        assert result.is_valid is True
        assert result.error is None
        assert result.bounding_box_x == 10.123
        assert result.bounding_box_y == 20.456
        assert result.bounding_box_z == 30.789
        assert result.volume_mm3 == 6283.185
        assert result.surface_area_mm2 == 1570.796

    def test_cadquery_import_succeeds_but_processing_fails(self, tmp_path):
        """CadQuery is available but processing throws."""
        f = tmp_path / "valid.step"
        f.write_text(f"{STEP_HEADER_MAGIC};\nHEADER;\nENDSEC;\nDATA;\nENDSEC;")

        mock_cq = MagicMock()
        mock_cq.importers.importStep.side_effect = RuntimeError("Geometry error")

        with patch.dict("sys.modules", {"cadquery": mock_cq}):
            result = extract_metadata(str(f))

        assert result.is_valid is True  # File header is valid; processing just failed
        assert result.error is not None
        assert "Geometry error" in result.error


# ==========================================================================
# tessellate_to_glb
# ==========================================================================
class TestTessellateToGlb:
    def test_cadquery_not_installed(self, tmp_path):
        """Should return False when cadquery is not importable."""
        with patch.dict("sys.modules", {"cadquery": None}):
            with patch("builtins.__import__", side_effect=_make_import_raiser("cadquery")):
                result = tessellate_to_glb(str(tmp_path / "input.step"), str(tmp_path / "output.glb"))
        assert result is False

    def test_trimesh_not_installed(self, tmp_path):
        """Should return False when trimesh is not importable."""
        mock_cq = MagicMock()
        with patch.dict("sys.modules", {"cadquery": mock_cq, "trimesh": None}):
            with patch("builtins.__import__", side_effect=_make_import_raiser("trimesh")):
                result = tessellate_to_glb(str(tmp_path / "input.step"), str(tmp_path / "output.glb"))
        assert result is False

    def test_successful_tessellation(self, tmp_path):
        """Mock a full successful tessellation pipeline."""
        mock_vertex = MagicMock()
        mock_vertex.x = 0.0
        mock_vertex.y = 0.0
        mock_vertex.z = 0.0

        mock_shape = MagicMock()
        mock_shape.tessellate.return_value = ([mock_vertex, mock_vertex, mock_vertex], [(0, 1, 2)])

        mock_result = MagicMock()
        mock_result.val.return_value = mock_shape

        mock_cq = MagicMock()
        mock_cq.importers.importStep.return_value = mock_result

        mock_mesh = MagicMock()
        mock_trimesh = MagicMock()
        mock_trimesh.Trimesh.return_value = mock_mesh

        with patch.dict("sys.modules", {"cadquery": mock_cq, "trimesh": mock_trimesh}):
            result = tessellate_to_glb(str(tmp_path / "input.step"), str(tmp_path / "output.glb"))

        assert result is True
        mock_mesh.export.assert_called_once()

    def test_tessellation_runtime_error(self, tmp_path):
        """Processing error should return False, not raise."""
        mock_cq = MagicMock()
        mock_cq.importers.importStep.side_effect = RuntimeError("Tessellation blew up")

        mock_trimesh = MagicMock()

        with patch.dict("sys.modules", {"cadquery": mock_cq, "trimesh": mock_trimesh}):
            result = tessellate_to_glb(str(tmp_path / "input.step"), str(tmp_path / "output.glb"))
        assert result is False


# ==========================================================================
# generate_thumbnail
# ==========================================================================
class TestGenerateThumbnail:
    def test_trimesh_not_installed(self, tmp_path):
        with patch.dict("sys.modules", {"trimesh": None}):
            with patch("builtins.__import__", side_effect=_make_import_raiser("trimesh")):
                result = generate_thumbnail(str(tmp_path / "input.step"), str(tmp_path / "thumb.png"))
        assert result is False

    def test_tessellation_prerequisite_fails(self, tmp_path):
        """If tessellate_to_glb fails, thumbnail should return False."""
        with patch("step_processor.tessellate_to_glb", return_value=False):
            mock_trimesh = MagicMock()
            with patch.dict("sys.modules", {"trimesh": mock_trimesh}):
                result = generate_thumbnail(str(tmp_path / "input.step"), str(tmp_path / "thumb.png"))
        assert result is False

    def test_successful_thumbnail(self, tmp_path):
        """Full success path: tessellate then render."""
        mock_scene = MagicMock()
        mock_scene.save_image.return_value = b"\x89PNG\r\n\x1a\nfakedata"

        mock_trimesh = MagicMock()
        mock_trimesh.load.return_value = mock_scene

        with patch("step_processor.tessellate_to_glb", return_value=True):
            with patch.dict("sys.modules", {"trimesh": mock_trimesh}):
                output_path = str(tmp_path / "thumb.png")
                result = generate_thumbnail(str(tmp_path / "input.step"), output_path)

        assert result is True
        # Verify the file was written
        assert os.path.exists(output_path)
        with open(output_path, "rb") as f:
            content = f.read()
        assert content == b"\x89PNG\r\n\x1a\nfakedata"

    def test_pyrender_unavailable(self, tmp_path):
        """scene.save_image raises when pyrender is missing -> returns False."""
        mock_scene = MagicMock()
        mock_scene.save_image.side_effect = RuntimeError("No pyrender")

        mock_trimesh = MagicMock()
        mock_trimesh.load.return_value = mock_scene

        with patch("step_processor.tessellate_to_glb", return_value=True):
            with patch.dict("sys.modules", {"trimesh": mock_trimesh}):
                result = generate_thumbnail(str(tmp_path / "input.step"), str(tmp_path / "thumb.png"))

        assert result is False

    def test_general_exception(self, tmp_path):
        """Unexpected errors should return False, not raise."""
        mock_trimesh = MagicMock()
        mock_trimesh.load.side_effect = ValueError("Corrupt GLB")

        with patch("step_processor.tessellate_to_glb", return_value=True):
            with patch.dict("sys.modules", {"trimesh": mock_trimesh}):
                result = generate_thumbnail(str(tmp_path / "input.step"), str(tmp_path / "thumb.png"))
        assert result is False


# ==========================================================================
# StepMetadata dataclass
# ==========================================================================
class TestStepMetadata:
    def test_default_values(self):
        m = StepMetadata()
        assert m.bounding_box_x is None
        assert m.bounding_box_y is None
        assert m.bounding_box_z is None
        assert m.volume_mm3 is None
        assert m.surface_area_mm2 is None
        assert m.is_valid is False
        assert m.error is None

    def test_custom_values(self):
        m = StepMetadata(
            bounding_box_x=10.0,
            bounding_box_y=20.0,
            bounding_box_z=30.0,
            volume_mm3=6000.0,
            surface_area_mm2=2200.0,
            is_valid=True,
        )
        assert m.bounding_box_x == 10.0
        assert m.is_valid is True


# ==========================================================================
# Helper: selective ImportError raiser
# ==========================================================================
_original_import = __builtins__.__import__ if hasattr(__builtins__, "__import__") else __import__


def _make_import_raiser(blocked_module: str):
    """Return an import side_effect that raises ImportError only for the blocked module."""
    def _import(name, *args, **kwargs):
        if name == blocked_module:
            raise ImportError(f"Mocked: {blocked_module} not installed")
        return _original_import(name, *args, **kwargs)
    return _import

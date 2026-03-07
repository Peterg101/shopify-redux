"""STEP file processing logic.

This module handles:
1. STEP file validation (ISO-10303-21 header check)
2. Geometry extraction (bounding box, volume, surface area) via CadQuery
3. Tessellation to glTF/glB for web preview
4. Thumbnail generation

CadQuery is a heavy dependency (~600MB Docker image). For local dev without
CadQuery installed, the processor gracefully degrades to metadata-only mode.
"""
import os
import logging
import tempfile
from pathlib import Path
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

STEP_HEADER_MAGIC = "ISO-10303-21"
MAX_FILE_SIZE_MB = 100
TESSELLATION_TOLERANCE = 0.5  # mm


@dataclass
class StepMetadata:
    bounding_box_x: Optional[float] = None
    bounding_box_y: Optional[float] = None
    bounding_box_z: Optional[float] = None
    volume_mm3: Optional[float] = None
    surface_area_mm2: Optional[float] = None
    is_valid: bool = False
    error: Optional[str] = None


def validate_step_file(file_path: str) -> bool:
    """Validate that the file is a valid STEP file by checking the header."""
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            header = f.read(256)
            return STEP_HEADER_MAGIC in header
    except Exception as e:
        logger.error(f"STEP validation error: {e}")
        return False


def extract_metadata(file_path: str) -> StepMetadata:
    """Extract geometry metadata from a STEP file using CadQuery.

    Falls back gracefully if CadQuery is not installed.
    """
    if not validate_step_file(file_path):
        return StepMetadata(is_valid=False, error="Invalid STEP file header")

    try:
        import cadquery as cq

        result = cq.importers.importStep(file_path)
        bb = result.val().BoundingBox()

        bx = round(bb.xlen, 3)
        by = round(bb.ylen, 3)
        bz = round(bb.zlen, 3)

        # Volume and surface area
        shape = result.val()
        volume = round(shape.Volume(), 3) if hasattr(shape, "Volume") else None
        area = round(shape.Area(), 3) if hasattr(shape, "Area") else None

        return StepMetadata(
            bounding_box_x=bx,
            bounding_box_y=by,
            bounding_box_z=bz,
            volume_mm3=volume,
            surface_area_mm2=area,
            is_valid=True,
        )
    except ImportError:
        logger.warning("CadQuery not installed — metadata extraction unavailable")
        return StepMetadata(is_valid=True, error="CadQuery not available for metadata extraction")
    except Exception as e:
        logger.error(f"Metadata extraction failed: {e}")
        return StepMetadata(is_valid=True, error=str(e))


def tessellate_to_glb(file_path: str, output_path: str, tolerance: float = TESSELLATION_TOLERANCE) -> bool:
    """Convert STEP to glTF Binary (.glb) for web preview.

    Uses CadQuery for tessellation, then trimesh for glTF export.
    Returns True on success.
    """
    try:
        import cadquery as cq
        import trimesh

        result = cq.importers.importStep(file_path)
        # Tessellate the shape
        vertices, triangles = result.val().tessellate(tolerance)

        # Convert to trimesh format
        verts = [(v.x, v.y, v.z) for v in vertices]
        faces = [(t.x, t.y, t.z) for t in triangles]

        mesh = trimesh.Trimesh(vertices=verts, faces=faces)
        mesh.export(output_path, file_type="glb")

        return True
    except ImportError:
        logger.warning("CadQuery/trimesh not installed — tessellation unavailable")
        return False
    except Exception as e:
        logger.error(f"Tessellation failed: {e}")
        return False


def generate_thumbnail(file_path: str, output_path: str, width: int = 256, height: int = 256) -> bool:
    """Generate a PNG thumbnail of the STEP file.

    Uses trimesh's built-in rendering if available, otherwise falls back
    to a placeholder approach.
    """
    try:
        import trimesh

        # First tessellate to get a mesh
        temp_glb = tempfile.mktemp(suffix=".glb")
        if not tessellate_to_glb(file_path, temp_glb):
            return False

        scene = trimesh.load(temp_glb)
        # trimesh can render to PNG if pyrender/pyglet is available
        try:
            png_data = scene.save_image(resolution=(width, height))
            with open(output_path, "wb") as f:
                f.write(png_data)
            return True
        except Exception:
            logger.warning("Thumbnail rendering not available (missing pyrender)")
            return False
        finally:
            if os.path.exists(temp_glb):
                os.unlink(temp_glb)

    except ImportError:
        logger.warning("trimesh not installed — thumbnail generation unavailable")
        return False
    except Exception as e:
        logger.error(f"Thumbnail generation failed: {e}")
        return False

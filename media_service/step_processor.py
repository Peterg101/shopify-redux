"""STEP file processing logic.

This module handles:
1. STEP file validation (ISO-10303-21 header check)
2. Geometry extraction (bounding box, volume, surface area) via CadQuery
3. Tessellation to glTF/glB for web preview
4. Thumbnail generation (pyrender + OSMesa for headless rendering)

CadQuery is a heavy dependency (~600MB Docker image). For local dev without
CadQuery installed, the processor gracefully degrades to metadata-only mode.
"""
import os

# Must be set before any pyrender/OpenGL imports
os.environ.setdefault("PYOPENGL_PLATFORM", "osmesa")

import logging
import tempfile
import math
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
        # vertices are Vector objects (.x, .y, .z), triangles are (int, int, int) tuples
        verts = [(v.x, v.y, v.z) for v in vertices]
        faces = [t for t in triangles]

        mesh = trimesh.Trimesh(vertices=verts, faces=faces)
        mesh.export(output_path, file_type="glb")

        return True
    except ImportError:
        logger.warning("CadQuery/trimesh not installed — tessellation unavailable")
        return False
    except Exception as e:
        logger.error(f"Tessellation failed: {e}")
        return False


def generate_thumbnail(
    file_path: str,
    output_path: str,
    width: int = 512,
    height: int = 512,
    file_type: str = "step",
) -> bool:
    """Generate a PNG thumbnail of a 3D file using pyrender + OSMesa.

    Supports STEP, OBJ, STL, and glB files. For STEP files, tessellates to
    glB first (via CadQuery), then loads with trimesh. Other formats load
    directly.

    Uses a 3-point lighting setup, isometric camera, dark background matching
    the app theme (#0A0E14), and neutral light grey material.

    Falls back gracefully if pyrender is unavailable.
    """
    try:
        import trimesh
        import numpy as np
    except ImportError:
        logger.warning("trimesh/numpy not installed — thumbnail generation unavailable")
        return False

    try:
        import pyrender
        from PIL import Image
    except ImportError:
        logger.warning("pyrender/Pillow not installed — thumbnail generation unavailable")
        return False

    temp_glb = None
    try:
        # Load the 3D model into a trimesh scene
        ft = file_type.lower().strip(".")
        if ft in ("step", "stp"):
            # STEP files need tessellation via CadQuery first
            temp_glb = tempfile.mktemp(suffix=".glb")
            if not tessellate_to_glb(file_path, temp_glb):
                logger.warning("Tessellation failed — cannot generate thumbnail for STEP file")
                return False
            tri_scene = trimesh.load(temp_glb)
        else:
            # OBJ, STL, glB — trimesh can load directly
            tri_scene = trimesh.load(file_path)

        # Convert to a single mesh if we got a scene
        if isinstance(tri_scene, trimesh.Scene):
            mesh = trimesh.util.concatenate(
                [g for g in tri_scene.geometry.values() if isinstance(g, trimesh.Trimesh)]
            )
        elif isinstance(tri_scene, trimesh.Trimesh):
            mesh = tri_scene
        else:
            logger.warning(f"Unexpected trimesh type: {type(tri_scene)}")
            return False

        if mesh.is_empty:
            logger.warning("Loaded mesh is empty — cannot generate thumbnail")
            return False

        # Center the mesh at origin
        centroid = mesh.centroid
        mesh.vertices -= centroid

        # Create pyrender scene with dark background
        scene = pyrender.Scene(
            bg_color=np.array([10 / 255, 14 / 255, 20 / 255, 1.0]),  # #0A0E14
            ambient_light=np.array([0.15, 0.15, 0.15]),
        )

        # Neutral light grey material
        material = pyrender.MetallicRoughnessMaterial(
            baseColorFactor=[0.75, 0.75, 0.75, 1.0],
            metallicFactor=0.3,
            roughnessFactor=0.6,
        )

        pyrender_mesh = pyrender.Mesh.from_trimesh(mesh, material=material)
        scene.add(pyrender_mesh)

        # Auto-scale: compute camera distance from bounding sphere
        bounds = mesh.bounds  # (2, 3) array: [min_corner, max_corner]
        extent = bounds[1] - bounds[0]
        scale = np.max(extent)
        if scale == 0:
            scale = 1.0

        # Isometric camera position
        cam_distance = scale * 1.8
        angle = math.radians(35.264)  # arctan(1/sqrt(2)) — isometric
        azimuth = math.radians(45)

        cam_x = cam_distance * math.cos(angle) * math.sin(azimuth)
        cam_y = cam_distance * math.cos(angle) * math.cos(azimuth)
        cam_z = cam_distance * math.sin(angle)

        camera = pyrender.PerspectiveCamera(yfov=math.radians(45), aspectRatio=width / height)

        # Build camera transform (look-at)
        cam_pos = np.array([cam_x, cam_y, cam_z])
        target = np.array([0.0, 0.0, 0.0])
        up = np.array([0.0, 0.0, 1.0])

        forward = target - cam_pos
        forward = forward / np.linalg.norm(forward)
        right = np.cross(forward, up)
        right = right / np.linalg.norm(right)
        cam_up = np.cross(right, forward)

        cam_pose = np.eye(4)
        cam_pose[:3, 0] = right
        cam_pose[:3, 1] = cam_up
        cam_pose[:3, 2] = -forward
        cam_pose[:3, 3] = cam_pos
        scene.add(camera, pose=cam_pose)

        # 3-point lighting
        # Key light — bright, from upper-right
        key_light = pyrender.DirectionalLight(color=[1.0, 1.0, 1.0], intensity=4.0)
        key_pose = np.eye(4)
        key_dir = np.array([0.5, -0.3, -0.8])
        key_dir = key_dir / np.linalg.norm(key_dir)
        key_right = np.cross(key_dir, up)
        key_right = key_right / np.linalg.norm(key_right)
        key_up = np.cross(key_right, key_dir)
        key_pose[:3, 0] = key_right
        key_pose[:3, 1] = key_up
        key_pose[:3, 2] = -key_dir
        scene.add(key_light, pose=key_pose)

        # Fill light — softer, from the left
        fill_light = pyrender.DirectionalLight(color=[0.8, 0.85, 1.0], intensity=2.0)
        fill_pose = np.eye(4)
        fill_dir = np.array([-0.6, 0.4, -0.5])
        fill_dir = fill_dir / np.linalg.norm(fill_dir)
        fill_right = np.cross(fill_dir, up)
        fill_right = fill_right / np.linalg.norm(fill_right)
        fill_up = np.cross(fill_right, fill_dir)
        fill_pose[:3, 0] = fill_right
        fill_pose[:3, 1] = fill_up
        fill_pose[:3, 2] = -fill_dir
        scene.add(fill_light, pose=fill_pose)

        # Rim light — from behind, highlights edges
        rim_light = pyrender.DirectionalLight(color=[1.0, 1.0, 1.0], intensity=2.5)
        rim_pose = np.eye(4)
        rim_dir = np.array([0.0, 0.8, 0.3])
        rim_dir = rim_dir / np.linalg.norm(rim_dir)
        rim_right = np.cross(rim_dir, up)
        rim_right = rim_right / np.linalg.norm(rim_right)
        rim_up = np.cross(rim_right, rim_dir)
        rim_pose[:3, 0] = rim_right
        rim_pose[:3, 1] = rim_up
        rim_pose[:3, 2] = -rim_dir
        scene.add(rim_light, pose=rim_pose)

        # Render
        renderer = pyrender.OffscreenRenderer(viewport_width=width, viewport_height=height)
        try:
            color, _ = renderer.render(scene)
        finally:
            renderer.delete()

        # Save as PNG
        image = Image.fromarray(color)
        image.save(output_path, format="PNG")

        logger.info(f"Thumbnail generated: {output_path} ({width}x{height})")
        return True

    except Exception as e:
        logger.error(f"Thumbnail generation failed: {e}")
        return False
    finally:
        if temp_glb and os.path.exists(temp_glb):
            os.unlink(temp_glb)


VIEW_ANGLES = {
    "front":     {"elevation": 0,      "azimuth": 0},
    "right":     {"elevation": 0,      "azimuth": 90},
    "top":       {"elevation": 89,     "azimuth": 0},
    "isometric": {"elevation": 35.264, "azimuth": 45},
}


def generate_multiview(
    file_path: str,
    output_dir: str,
    views: list[str] | None = None,
    width: int = 400,
    height: int = 400,
    file_type: str = "step",
) -> dict[str, str]:
    """Render a 3D model from multiple camera angles.

    Returns a dict mapping view name to output PNG path.
    Reuses the same mesh loading, material, and lighting as generate_thumbnail.
    """
    if views is None:
        views = ["front", "right", "top", "isometric"]

    results: dict[str, str] = {}
    temp_glb = None

    try:
        import trimesh
        import pyrender
        import numpy as np
        from PIL import Image

        os.environ.setdefault("PYOPENGL_PLATFORM", "osmesa")

        if file_type == "step":
            temp_glb = file_path + ".view.glb"
            tessellate_to_glb(file_path, temp_glb)
            mesh = trimesh.load(temp_glb, force="mesh")
        else:
            mesh = trimesh.load(file_path, force="mesh")

        if hasattr(mesh, "is_empty") and mesh.is_empty:
            logger.warning("Empty mesh — skipping multiview")
            return results

        centroid = mesh.centroid
        mesh.apply_translation(-centroid)

        bounds = mesh.bounds
        extent = bounds[1] - bounds[0]
        scale = np.max(extent) or 1.0
        cam_distance = scale * 1.8

        bg_color = np.array([10 / 255, 14 / 255, 20 / 255, 1.0])
        material = pyrender.MetallicRoughnessMaterial(
            baseColorFactor=[0.75, 0.75, 0.75, 1.0],
            metallicFactor=0.3, roughnessFactor=0.6,
        )
        up = np.array([0.0, 0.0, 1.0])

        renderer = pyrender.OffscreenRenderer(viewport_width=width, viewport_height=height)
        try:
            for view_name in views:
                angles = VIEW_ANGLES.get(view_name, VIEW_ANGLES["isometric"])
                elev = math.radians(angles["elevation"])
                azim = math.radians(angles["azimuth"])

                scene = pyrender.Scene(bg_color=bg_color, ambient_light=[0.15, 0.15, 0.15])
                scene.add(pyrender.Mesh.from_trimesh(mesh, material=material))

                cam_x = cam_distance * math.cos(elev) * math.sin(azim)
                cam_y = cam_distance * math.cos(elev) * math.cos(azim)
                cam_z = cam_distance * math.sin(elev)

                camera = pyrender.PerspectiveCamera(yfov=math.radians(45), aspectRatio=width / height)
                cam_pos = np.array([cam_x, cam_y, cam_z])
                forward = -cam_pos / np.linalg.norm(cam_pos)
                right = np.cross(forward, up)
                norm = np.linalg.norm(right)
                if norm < 1e-6:
                    right = np.array([1.0, 0.0, 0.0])
                else:
                    right = right / norm
                cam_up = np.cross(right, forward)

                cam_pose = np.eye(4)
                cam_pose[:3, 0] = right
                cam_pose[:3, 1] = cam_up
                cam_pose[:3, 2] = -forward
                cam_pose[:3, 3] = cam_pos
                scene.add(camera, pose=cam_pose)

                for light_dir, intensity, color in [
                    ([0.5, -0.3, -0.8], 4.0, [1.0, 1.0, 1.0]),
                    ([-0.6, 0.4, -0.5], 2.0, [0.8, 0.85, 1.0]),
                    ([0.0, 0.8, 0.3], 2.5, [1.0, 1.0, 1.0]),
                ]:
                    light = pyrender.DirectionalLight(color=color, intensity=intensity)
                    d = np.array(light_dir, dtype=float)
                    d = d / np.linalg.norm(d)
                    lr = np.cross(d, up)
                    ln = np.linalg.norm(lr)
                    if ln < 1e-6:
                        lr = np.array([1.0, 0.0, 0.0])
                    else:
                        lr = lr / ln
                    lu = np.cross(lr, d)
                    lp = np.eye(4)
                    lp[:3, 0] = lr
                    lp[:3, 1] = lu
                    lp[:3, 2] = -d
                    scene.add(light, pose=lp)

                color_img, _ = renderer.render(scene)
                out_path = os.path.join(output_dir, f"{view_name}.png")
                Image.fromarray(color_img).save(out_path, format="PNG")
                results[view_name] = out_path
        finally:
            renderer.delete()

        logger.info(f"Multiview generated: {list(results.keys())} ({width}x{height})")
        return results

    except Exception as e:
        logger.error(f"Multiview generation failed: {e}")
        return results
    finally:
        if temp_glb and os.path.exists(temp_glb):
            os.unlink(temp_glb)

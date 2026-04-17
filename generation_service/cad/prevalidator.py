"""Pre-execution validation of JSON operations.

Catches dimensionally impossible geometry BEFORE running CadQuery in Docker,
saving execution time and LLM fix calls. Returns a list of issues that the
LLM should address, or an empty list if everything looks feasible.
"""
import logging
from typing import Any

logger = logging.getLogger(__name__)

MIN_DIMENSION = 0.1
MAX_DIMENSION = 1000.0
MAX_FILLET_RATIO = 0.45
MAX_SHELL_RATIO = 0.45


def _resolve(val: Any, params: dict) -> float | None:
    """Resolve a parameter reference or literal to a float."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str) and val.startswith("$"):
        key = val[1:]
        p = params.get(key)
        if isinstance(p, (int, float)):
            return float(p)
    return None


def validate_operations(steps: list[dict], parameters: dict) -> list[str]:
    """Validate JSON ops for dimensional feasibility before conversion.

    Returns a list of human-readable issue descriptions. Empty = valid.
    """
    issues: list[str] = []
    body_dims: dict[str, float] = {}  # track base geometry dimensions

    for i, step in enumerate(steps):
        op = step.get("op", "")
        tag = step.get("tag", f"step_{i}")

        if op == "create_box":
            l = _resolve(step.get("length"), parameters)
            w = _resolve(step.get("width"), parameters)
            h = _resolve(step.get("height"), parameters)
            for name, val in [("length", l), ("width", w), ("height", h)]:
                if val is not None:
                    if val < MIN_DIMENSION:
                        issues.append(f"{tag}: {name} ({val}mm) is below minimum ({MIN_DIMENSION}mm)")
                    if val > MAX_DIMENSION:
                        issues.append(f"{tag}: {name} ({val}mm) exceeds maximum ({MAX_DIMENSION}mm)")
            if l and w and h:
                body_dims = {"length": l, "width": w, "height": h}

        elif op == "create_cylinder":
            r = _resolve(step.get("radius"), parameters)
            h = _resolve(step.get("height"), parameters)
            if r is not None and r < MIN_DIMENSION:
                issues.append(f"{tag}: radius ({r}mm) is below minimum")
            if h is not None and h < MIN_DIMENSION:
                issues.append(f"{tag}: height ({h}mm) is below minimum")
            if r and h:
                body_dims = {"length": r * 2, "width": r * 2, "height": h}

        elif op == "shell":
            thickness = _resolve(step.get("thickness"), parameters)
            if thickness is not None and body_dims:
                smallest = min(body_dims.values())
                if thickness > smallest * MAX_SHELL_RATIO:
                    issues.append(
                        f"{tag}: shell thickness ({thickness}mm) is too large "
                        f"for smallest body dimension ({smallest:.1f}mm). "
                        f"Max recommended: {smallest * MAX_SHELL_RATIO:.1f}mm"
                    )
                if thickness < MIN_DIMENSION:
                    issues.append(f"{tag}: shell thickness ({thickness}mm) is below minimum")

        elif op == "fillet":
            r = _resolve(step.get("radius"), parameters)
            if r is not None and body_dims:
                smallest_edge = min(body_dims.values())
                if r > smallest_edge * MAX_FILLET_RATIO:
                    issues.append(
                        f"{tag}: fillet radius ({r}mm) is too large for "
                        f"smallest edge ({smallest_edge:.1f}mm). "
                        f"Max recommended: {smallest_edge * MAX_FILLET_RATIO:.1f}mm. "
                        f"Reduce radius or remove this fillet."
                    )

        elif op == "chamfer":
            size = _resolve(step.get("size"), parameters)
            if size is not None and body_dims:
                smallest_edge = min(body_dims.values())
                if size > smallest_edge * MAX_FILLET_RATIO:
                    issues.append(
                        f"{tag}: chamfer size ({size}mm) is too large for "
                        f"smallest edge ({smallest_edge:.1f}mm)"
                    )

        elif op in ("cut_blind", "cut_through", "extrude_profile"):
            profile = step.get("profile", {})
            face = step.get("face", ">Z")
            _check_profile_fits(tag, op, profile, face, body_dims, parameters, issues)

            if op == "cut_blind":
                depth = _resolve(step.get("depth"), parameters)
                if depth is not None and body_dims:
                    face_depth = _face_depth(face, body_dims)
                    if face_depth and depth > face_depth:
                        issues.append(
                            f"{tag}: cut depth ({depth}mm) exceeds body depth "
                            f"on face {face} ({face_depth:.1f}mm)"
                        )

        elif op == "holes":
            d = _resolve(step.get("diameter"), parameters)
            face = step.get("face", ">Z")
            if d is not None and body_dims:
                face_dims = _face_dims(face, body_dims)
                if face_dims:
                    face_w, face_h = face_dims
                    if d > face_w or d > face_h:
                        issues.append(
                            f"{tag}: hole diameter ({d}mm) exceeds face "
                            f"dimensions ({face_w:.1f}x{face_h:.1f}mm)"
                        )

        elif op == "loft":
            sections = step.get("sections", [])
            if len(sections) < 2:
                issues.append(f"{tag}: loft requires at least 2 sections, got {len(sections)}")

        elif op == "sweep":
            path = step.get("path", {})
            if not path.get("type"):
                issues.append(f"{tag}: sweep path missing 'type' (use 'arc' or 'line')")

    if issues:
        logger.info(f"Pre-validation found {len(issues)} issues: {issues}")

    return issues


def _face_dims(face: str, body: dict) -> tuple[float, float] | None:
    """Get (width, height) of a face given body dimensions."""
    l, w, h = body.get("length", 0), body.get("width", 0), body.get("height", 0)
    mapping = {
        ">Z": (l, w), "<Z": (l, w),
        ">Y": (l, h), "<Y": (l, h),
        ">X": (w, h), "<X": (w, h),
    }
    return mapping.get(face)


def _face_depth(face: str, body: dict) -> float | None:
    """Get the depth (thickness) behind a face."""
    l, w, h = body.get("length", 0), body.get("width", 0), body.get("height", 0)
    mapping = {
        ">Z": h, "<Z": h,
        ">Y": w, "<Y": w,
        ">X": l, "<X": l,
    }
    return mapping.get(face)


def _check_profile_fits(
    tag: str, op: str, profile: dict, face: str,
    body: dict, params: dict, issues: list[str],
):
    """Check if a 2D profile fits on the target face."""
    if not body:
        return
    face_d = _face_dims(face, body)
    if not face_d:
        return
    face_w, face_h = face_d

    ptype = profile.get("type", "rect")

    if ptype in ("rect", "rounded_rect", "square", "rectangle"):
        pw = _resolve(profile.get("width"), params)
        ph = _resolve(profile.get("height"), params)
        if pw and pw > face_w:
            issues.append(f"{tag}: profile width ({pw}mm) exceeds face width ({face_w:.1f}mm)")
        if ph and ph > face_h:
            issues.append(f"{tag}: profile height ({ph}mm) exceeds face height ({face_h:.1f}mm)")

    elif ptype == "circle":
        r = _resolve(profile.get("radius"), params)
        if r and (r * 2 > face_w or r * 2 > face_h):
            issues.append(
                f"{tag}: circle diameter ({r * 2}mm) exceeds face "
                f"({face_w:.1f}x{face_h:.1f}mm)"
            )

    elif ptype == "slot":
        sl = _resolve(profile.get("length"), params)
        sw = _resolve(profile.get("width"), params)
        if sl and sl > face_w:
            issues.append(f"{tag}: slot length ({sl}mm) exceeds face width ({face_w:.1f}mm)")
        if sw and sw > face_h:
            issues.append(f"{tag}: slot width ({sw}mm) exceeds face height ({face_h:.1f}mm)")

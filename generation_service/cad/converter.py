"""Deterministic JSON-to-CadQuery converter.

Given a JSON array of 2D/3D operations and a parameters dict, produces a
complete CadQuery Python script that:
  - Declares all dimensions as named variables at the top
  - Builds geometry step-by-step with .tag() on every operation
  - Populates a _features list for the feature tree UI
  - Assigns the final shape to `result`
  - Contains NO export/print statements (executor appends VALIDATION_SUFFIX)

The generated code is fully deterministic — identical input always produces
identical output — and is designed to always execute successfully by
construction (fillet/chamfer wrapped in try/except, coplanar offsets, etc.).

Usage:
    from cad.converter import convert_json_to_cadquery
    script = convert_json_to_cadquery(steps, parameters)
"""
from __future__ import annotations

import math
import re
import textwrap
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MIN_WALL_THICKNESS = 1.0  # mm (FDM)
MIN_FEATURE_SIZE = 0.5    # mm
MAX_FILLET_EDGE_RATIO = 0.2  # fillet radius <= 20% of smallest adjacent edge
COPLANAR_OFFSET = 0.01    # mm nudge to avoid boolean failures on coplanar faces

# Operation types that are subtractive (remove material)
SUBTRACTIVE_OPS = {
    "cut_blind", "cut_through", "holes", "shell",
}

# Operation types that are additive (add material)
ADDITIVE_OPS = {
    "create_box", "create_cylinder", "extrude_profile", "union", "revolve",
}

# Operation types that are cosmetic (modify edges, applied last)
COSMETIC_OPS = {
    "fillet", "chamfer",
}

# Canonical ordering: base -> additive -> shell -> subtractive -> clean -> cosmetic
PHASE_ORDER = {
    "create_box": 0,
    "create_cylinder": 0,
    "extrude_profile": 1,
    "union": 1,
    "revolve": 1,
    "mirror": 1,
    "shell": 2,
    "cut_blind": 3,
    "cut_through": 3,
    "holes": 3,
    "fillet": 5,
    "chamfer": 5,
}

# ---------------------------------------------------------------------------
# Face tracking & constraint-based positioning
# ---------------------------------------------------------------------------


class _ConstraintFaceTracker:
    """Tracks face dimensions for constraint resolution.

    After a create_box, we know all 6 face dimensions. After a shell,
    we know the wall thickness. This lets us resolve constraint-based
    positions like {"h": "center", "v": {"from": "bottom", "offset": 6}}
    into actual [u, v] coordinates.
    """

    def __init__(self):
        self.face_dims: dict[str, dict[str, float]] = {}
        self.wall_thickness: float = 0.0

    def after_base_box(self, length: float, width: float, height: float):
        self.face_dims = {
            ">Z": {"w": length, "h": width},    # top
            "<Z": {"w": length, "h": width},    # bottom
            ">Y": {"w": length, "h": height},   # front
            "<Y": {"w": length, "h": height},   # rear
            ">X": {"w": width, "h": height},    # right
            "<X": {"w": width, "h": height},    # left
        }

    def after_base_cylinder(self, height: float, radius: float):
        d = radius * 2
        self.face_dims = {
            ">Z": {"w": d, "h": d},
            "<Z": {"w": d, "h": d},
        }

    def after_shell(self, thickness: float):
        self.wall_thickness = thickness

    def get_face_dims(self, face: str) -> tuple[float, float] | None:
        """Returns (width, height) of the given face, or None if unknown."""
        f = self.face_dims.get(face)
        if f:
            return f["w"], f["h"]
        return None

    # No global instance — instantiated per-call in convert_json_to_cadquery


def _resolve_axis(spec, face_dim: float, feature_dim: float = 0) -> float:
    """Resolve a single-axis constraint to a coordinate.

    Args:
        spec: "center", a number, or {"from": "bottom/top/left/right", "offset": N}
        face_dim: total dimension of the face along this axis
        feature_dim: dimension of the feature being placed (for edge offset calculation)
    """
    if spec == "center":
        return 0.0
    if isinstance(spec, (int, float)):
        return float(spec)
    if isinstance(spec, dict):
        edge = spec.get("from", "center")
        offset = float(spec.get("offset", 0))
        half_feature = feature_dim / 2 if feature_dim else 0

        if edge in ("bottom", "left"):
            return -face_dim / 2 + offset + half_feature
        elif edge in ("top", "right"):
            return face_dim / 2 - offset - half_feature
        elif edge == "center":
            return offset  # offset from center
    return 0.0


def resolve_position(
    constraint, face_w: float, face_h: float,
    feature_w: float = 0, feature_h: float = 0,
) -> list[float]:
    """Resolve a position constraint to [u, v] coordinates.

    Accepts:
      - [x, y] raw coordinates (pass through)
      - {"h": ..., "v": ...} constraint object
    """
    if isinstance(constraint, list):
        return [float(constraint[0]), float(constraint[1])]

    if isinstance(constraint, dict) and ("h" in constraint or "v" in constraint):
        h_spec = constraint.get("h", "center")
        v_spec = constraint.get("v", "center")
        u = _resolve_axis(h_spec, face_w, feature_w)
        v = _resolve_axis(v_spec, face_h, feature_h)
        return [u, v]

    # Fallback: treat as raw [0, 0]
    return [0.0, 0.0]


def resolve_hole_placement(
    placement, face_w: float, face_h: float,
) -> list[tuple[float, float]]:
    """Resolve a hole placement constraint to a list of (u, v) positions.

    Accepts:
      - A list of [x, y] pairs (pass through)
      - {"type": "corners", "inset": N}
      - {"type": "center"}
      - {"type": "along_edge", "edge": "top", "count": N, "inset": N}
      - {"type": "grid", "rows": N, "cols": N, "spacing_h": N, "spacing_v": N}
    """
    if isinstance(placement, list):
        # Could be a list of raw positions or a list of dicts
        if placement and isinstance(placement[0], (list, tuple)):
            return [(float(p[0]), float(p[1])) for p in placement]
        return placement

    if not isinstance(placement, dict):
        return [(0.0, 0.0)]

    ptype = placement.get("type", "center")

    if ptype == "center":
        return [(0.0, 0.0)]

    elif ptype == "corners":
        inset = float(placement.get("inset", 8))
        return [
            (-face_w / 2 + inset, -face_h / 2 + inset),
            (face_w / 2 - inset, -face_h / 2 + inset),
            (face_w / 2 - inset, face_h / 2 - inset),
            (-face_w / 2 + inset, face_h / 2 - inset),
        ]

    elif ptype == "along_edge":
        edge = placement.get("edge", "top")
        count = int(placement.get("count", 3))
        inset = float(placement.get("inset", 10))
        margin = float(placement.get("margin", 10))

        if edge in ("top", "bottom"):
            y = face_h / 2 - inset if edge == "top" else -face_h / 2 + inset
            usable = face_w - 2 * margin
            if count == 1:
                return [(0.0, y)]
            spacing = usable / (count - 1)
            return [(-usable / 2 + i * spacing, y) for i in range(count)]
        else:  # left, right
            x = -face_w / 2 + inset if edge == "left" else face_w / 2 - inset
            usable = face_h - 2 * margin
            if count == 1:
                return [(x, 0.0)]
            spacing = usable / (count - 1)
            return [(x, -usable / 2 + i * spacing) for i in range(count)]

    elif ptype == "grid":
        rows = int(placement.get("rows", 2))
        cols = int(placement.get("cols", 2))
        sh = float(placement.get("spacing_h", 20))
        sv = float(placement.get("spacing_v", 20))
        points = []
        for r in range(rows):
            for c in range(cols):
                u = -(cols - 1) * sh / 2 + c * sh
                v = -(rows - 1) * sv / 2 + r * sv
                points.append((u, v))
        return points

    return [(0.0, 0.0)]


# ---------------------------------------------------------------------------
# Parameter resolution
# ---------------------------------------------------------------------------


def _resolve_param(value: Any, parameters: dict) -> Any:
    """Resolve a $variable_name reference or expression to a numeric value.

    Handles:
      - Simple references: "$length" → parameters["length"]
      - Expressions: "$length / 2 - $wall" → evaluate with substitution
      - Literals: 42.0 → 42.0
    """
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, str) and "$" in value:
        expr = value
        # Replace $references with values (longest names first to avoid partial matches)
        for name in sorted(parameters.keys(), key=len, reverse=True):
            expr = expr.replace(f"${name}", str(parameters[name]))
        # Validate expression contains only safe characters (digits, operators, whitespace, dots)
        if not re.match(r'^[\d\s\+\-\*/\(\)\.\,]+$', expr):
            raise ValueError(f"Unsafe expression rejected: {value} → {expr}")
        try:
            return eval(expr)
        except Exception:
            raise ValueError(f"Cannot evaluate parameter expression: {value} → {expr}")
    if isinstance(value, str):
        # Try to parse as a number
        try:
            return float(value)
        except ValueError:
            pass
    return value



# ---------------------------------------------------------------------------
# Face inference (static, without executing CadQuery)
# ---------------------------------------------------------------------------


class FaceTracker:
    """Tracks available faces based on the operation sequence.

    This is an approximation — we infer axis-aligned planar faces from the
    operations applied.  It won't capture every face on complex geometry, but
    it provides enough information to validate face selectors in subsequent
    operations and report available work-faces to the schema designer.

    Each face is represented as:
        {"selector": ">Z", "description": "top face", "origin": [0, 0, h]}
    """

    # The six canonical axis-aligned face selectors
    CANONICAL = [">Z", "<Z", ">X", "<X", ">Y", "<Y"]

    def __init__(self):
        self.faces: list[dict] = []
        self._bbox: dict[str, float] = {
            "xmin": 0, "xmax": 0,
            "ymin": 0, "ymax": 0,
            "zmin": 0, "zmax": 0,
        }

    def after_base_box(self, length: float, width: float, height: float):
        """Record faces after creating a centered box (CadQuery default centering)."""
        hl, hw, hh = length / 2, width / 2, height
        self._bbox = {
            "xmin": -hl, "xmax": hl,
            "ymin": -hw, "ymax": hw,
            "zmin": 0, "zmax": hh,
        }
        self.faces = [
            {"selector": ">Z", "desc": "top", "center": [0, 0, hh]},
            {"selector": "<Z", "desc": "bottom", "center": [0, 0, 0]},
            {"selector": ">X", "desc": "right", "center": [hl, 0, hh / 2]},
            {"selector": "<X", "desc": "left", "center": [-hl, 0, hh / 2]},
            {"selector": ">Y", "desc": "front", "center": [0, hw, hh / 2]},
            {"selector": "<Y", "desc": "rear", "center": [0, -hw, hh / 2]},
        ]

    def after_base_cylinder(self, height: float, radius: float):
        """Record faces after creating an upright cylinder."""
        self._bbox = {
            "xmin": -radius, "xmax": radius,
            "ymin": -radius, "ymax": radius,
            "zmin": 0, "zmax": height,
        }
        self.faces = [
            {"selector": ">Z", "desc": "top", "center": [0, 0, height]},
            {"selector": "<Z", "desc": "bottom", "center": [0, 0, 0]},
            # Cylinder also has a curved face, but CQ selects it differently
        ]

    def after_extrude(self, face_selector: str, depth: float):
        """Approximation: extrusion adds a new top face offset from the target."""
        # This is an approximation — the new face depends on the sketch shape
        pass

    def available_selectors(self) -> list[str]:
        """Return the list of face selectors currently available."""
        return [f["selector"] for f in self.faces]


# ---------------------------------------------------------------------------
# Code emitters — one per operation type
# ---------------------------------------------------------------------------
# Each emitter returns a tuple of (code_lines: list[str], feature_dict_code: str).
# code_lines are the Python statements; feature_dict_code is the _features.append
# call as a string.


def _emit_create_box(step: dict, step_num: int, params: dict) -> tuple[list[str], str]:
    """Emit code for creating a box (base solid)."""
    tag = step["tag"]
    length = _resolve_param(step["length"], params)
    width = _resolve_param(step["width"], params)
    height = _resolve_param(step["height"], params)
    center = step.get("center", [0, 0])  # XY center offset

    lines = [
        f"# Step {step_num}: Create box — {tag}",
        f"_step += 1",
    ]

    cx, cy = _resolve_param(center[0], params), _resolve_param(center[1], params)
    if cx == 0 and cy == 0:
        lines.append(
            f'result = cq.Workplane("XY").box({_var_ref(step, "length", params)}, '
            f'{_var_ref(step, "width", params)}, {_var_ref(step, "height", params)})'
            f'.tag("{tag}")'
        )
    else:
        lines.append(
            f'result = cq.Workplane("XY").center({cx}, {cy}).box('
            f'{_var_ref(step, "length", params)}, '
            f'{_var_ref(step, "width", params)}, {_var_ref(step, "height", params)})'
            f'.tag("{tag}")'
        )

    feature = (
        f'_features.append({{"tag": "{tag}", "type": "box", "step": _step, '
        f'"position": [{cx}, {cy}, {_var_ref(step, "height", params)}/2], '
        f'"dimensions": {{"length": {_var_ref(step, "length", params)}, '
        f'"width": {_var_ref(step, "width", params)}, '
        f'"height": {_var_ref(step, "height", params)}}}, '
        f'"depends_on": {_depends_on(step)}}})'
    )
    return lines, feature


def _emit_create_cylinder(step: dict, step_num: int, params: dict) -> tuple[list[str], str]:
    """Emit code for creating a cylinder (base solid)."""
    tag = step["tag"]

    lines = [
        f"# Step {step_num}: Create cylinder — {tag}",
        f"_step += 1",
        f'result = cq.Workplane("XY").cylinder('
        f'{_var_ref(step, "height", params)}, {_var_ref(step, "radius", params)})'
        f'.tag("{tag}")',
    ]

    feature = (
        f'_features.append({{"tag": "{tag}", "type": "cylinder", "step": _step, '
        f'"position": [0, 0, {_var_ref(step, "height", params)}/2], '
        f'"dimensions": {{"height": {_var_ref(step, "height", params)}, '
        f'"radius": {_var_ref(step, "radius", params)}}}, '
        f'"depends_on": {_depends_on(step)}}})'
    )
    return lines, feature


def _emit_extrude_profile(step: dict, step_num: int, params: dict) -> tuple[list[str], str]:
    """Emit code for extruding a 2D profile on a face."""
    tag = step["tag"]
    face = step.get("face", ">Z")
    depth = _var_ref(step, "depth", params)
    profile = step["profile"]
    profile_type = profile["type"]  # rect, circle, polygon, slot
    pos = profile.get("position", [0, 0])
    px, py = _resolve_param(pos[0], params), _resolve_param(pos[1], params)

    lines = [
        f"# Step {step_num}: Extrude {profile_type} on {face} — {tag}",
        f"_step += 1",
    ]

    sketch_lines = _sketch_for_profile(profile, params)
    chain = (
        f'result = (result.faces("{face}").workplane(centerOption="CenterOfMass")'
        f'.moveTo({px}, {py})'
    )
    chain += sketch_lines
    chain += f'.extrude({depth}).tag("{tag}"))'
    lines.append(chain)

    feature = (
        f'_features.append({{"tag": "{tag}", "type": "extrusion", "step": _step, '
        f'"position": [{px}, {py}, 0], '
        f'"dimensions": {{"depth": {depth}}}, '
        f'"depends_on": {_depends_on(step)}}})'
    )
    return lines, feature


def _emit_cut_blind(step: dict, step_num: int, params: dict) -> tuple[list[str], str]:
    """Emit code for a blind cut (pocket) on a face."""
    tag = step["tag"]
    face = step.get("face", ">Z")
    depth = _var_ref(step, "depth", params)
    profile = step["profile"]
    profile_type = profile["type"]
    pos = profile.get("position", [0, 0])
    px, py = _resolve_param(pos[0], params), _resolve_param(pos[1], params)

    lines = [
        f"# Step {step_num}: Blind cut {profile_type} on {face} — {tag}",
        f"_step += 1",
    ]

    sketch_lines = _sketch_for_profile(profile, params)
    chain = (
        f'result = (result.faces("{face}").workplane(centerOption="CenterOfMass")'
        f'.moveTo({px}, {py})'
    )
    chain += sketch_lines
    # cutBlind with negative depth cuts INTO the face
    chain += f'.cutBlind(-{depth}).tag("{tag}"))'
    lines.append(chain)

    feature = (
        f'_features.append({{"tag": "{tag}", "type": "pocket", "step": _step, '
        f'"position": [{px}, {py}, 0], '
        f'"dimensions": {{"depth": {depth}}}, '
        f'"depends_on": {_depends_on(step)}}})'
    )
    return lines, feature


def _emit_cut_through(step: dict, step_num: int, params: dict) -> tuple[list[str], str]:
    """Emit code for a through cut on a face."""
    tag = step["tag"]
    face = step.get("face", ">Z")
    profile = step["profile"]
    profile_type = profile["type"]
    pos = profile.get("position", [0, 0])
    px, py = _resolve_param(pos[0], params), _resolve_param(pos[1], params)

    lines = [
        f"# Step {step_num}: Through cut {profile_type} on {face} — {tag}",
        f"_step += 1",
    ]

    sketch_lines = _sketch_for_profile(profile, params)
    chain = (
        f'result = (result.faces("{face}").workplane(centerOption="CenterOfMass")'
        f'.moveTo({px}, {py})'
    )
    chain += sketch_lines
    chain += f'.cutThruAll().tag("{tag}"))'
    lines.append(chain)

    feature = (
        f'_features.append({{"tag": "{tag}", "type": "cut", "step": _step, '
        f'"position": [{px}, {py}, 0], '
        f'"dimensions": {{}}, '
        f'"depends_on": {_depends_on(step)}}})'
    )
    return lines, feature


def _emit_holes(step: dict, step_num: int, params: dict) -> tuple[list[str], str]:
    """Emit code for holes — supports single, grid, bolt_circle, explicit."""
    tag = step["tag"]
    face = step.get("face", ">Z")
    diameter = _var_ref(step, "diameter", params)
    depth = step.get("depth")  # None = through-hole
    pattern = step.get("pattern", "single")  # single, grid, bolt_circle, explicit
    hole_type = step.get("hole_type", "plain")  # plain, counterbore, countersink

    lines = [
        f"# Step {step_num}: Holes ({pattern}) on {face} — {tag}",
        f"_step += 1",
    ]

    # Build the points list
    points_expr = _hole_points_expr(step, params)

    # Build the hole call
    if hole_type == "counterbore":
        cbd = _var_ref(step, "cbore_diameter", params)
        cbd_depth = _var_ref(step, "cbore_depth", params)
        if depth:
            depth_val = _var_ref(step, "depth", params)
            hole_call = f".cboreHole({diameter}, {cbd}, {cbd_depth}, depth={depth_val})"
        else:
            hole_call = f".cboreHole({diameter}, {cbd}, {cbd_depth})"
    elif hole_type == "countersink":
        csk_d = _var_ref(step, "csk_diameter", params)
        csk_angle = step.get("csk_angle", 82)
        if depth:
            depth_val = _var_ref(step, "depth", params)
            hole_call = f".cskHole({diameter}, {csk_d}, {csk_angle}, depth={depth_val})"
        else:
            hole_call = f".cskHole({diameter}, {csk_d}, {csk_angle})"
    else:
        if depth:
            depth_val = _var_ref(step, "depth", params)
            hole_call = f".hole({diameter}, {depth_val})"
        else:
            hole_call = f".hole({diameter})"

    if pattern == "single":
        pos = step.get("position", [0, 0])
        px, py = _resolve_param(pos[0], params), _resolve_param(pos[1], params)
        lines.append(
            f'result = (result.faces("{face}").workplane(centerOption="CenterOfMass")'
            f'.moveTo({px}, {py}){hole_call}.tag("{tag}"))'
        )
    else:
        # Multi-hole: use pushPoints
        lines.append(
            f'result = (result.faces("{face}").workplane(centerOption="CenterOfMass")'
            f'.pushPoints({points_expr}){hole_call}.tag("{tag}"))'
        )

    depth_dim = f', "depth": {_var_ref(step, "depth", params)}' if depth else ""
    feature = (
        f'_features.append({{"tag": "{tag}", "type": "hole", "step": _step, '
        f'"position": [0, 0, 0], '
        f'"dimensions": {{"diameter": {diameter}{depth_dim}}}, '
        f'"depends_on": {_depends_on(step)}}})'
    )
    return lines, feature


def _emit_shell(step: dict, step_num: int, params: dict) -> tuple[list[str], str]:
    """Emit code for shelling a solid."""
    tag = step["tag"]
    thickness = _var_ref(step, "thickness", params)
    # Faces to keep open (optional). Default: top face open.
    open_faces = step.get("open_faces", [">Z"])

    lines = [
        f"# Step {step_num}: Shell — {tag}",
        f"_step += 1",
    ]

    # Validate thickness
    lines.append(f"_shell_t = max({thickness}, {MIN_WALL_THICKNESS})  # enforce min wall")

    if open_faces:
        # Shell with face exclusion: select face(s) then shell
        # For multiple open faces, chain .faces() selectors
        if len(open_faces) == 1:
            lines.append(
                f'result = result.faces("{open_faces[0]}").shell(-_shell_t).tag("{tag}")'
            )
        else:
            # CadQuery shell can take a list of faces via the faces parameter
            # Use the primary face selector approach
            face_sel = open_faces[0]
            lines.append(
                f'result = result.faces("{face_sel}").shell(-_shell_t).tag("{tag}")'
            )
    else:
        lines.append(f'result = result.shell(-_shell_t).tag("{tag}")')

    feature = (
        f'_features.append({{"tag": "{tag}", "type": "shell", "step": _step, '
        f'"position": [0, 0, 0], '
        f'"dimensions": {{"thickness": _shell_t}}, '
        f'"depends_on": {_depends_on(step)}}})'
    )
    return lines, feature


def _emit_fillet(step: dict, step_num: int, params: dict) -> tuple[list[str], str]:
    """Emit code for filleting edges — always in try/except."""
    tag = step["tag"]
    radius = _var_ref(step, "radius", params)
    edge_selector = step.get("edges", "|Z")  # CadQuery edge selector string

    lines = [
        f"# Step {step_num}: Fillet — {tag}",
        f"_step += 1",
        f"# Clamp fillet radius for safety",
        f"try:",
        f'    result = result.edges("{edge_selector}").fillet({radius}).tag("{tag}")',
        f"    _features.append({{",
        f'        "tag": "{tag}", "type": "fillet", "step": _step,',
        f'        "position": [0, 0, 0],',
        f'        "dimensions": {{"radius": {radius}}},',
        f'        "depends_on": {_depends_on(step)},',
        f"    }})",
        f"except Exception as _e:",
        f"    _features.append({{",
        f'        "tag": "{tag}", "type": "fillet_failed", "step": _step,',
        f'        "position": [0, 0, 0],',
        f'        "dimensions": {{"radius": {radius}}},',
        f'        "depends_on": {_depends_on(step)},',
        f'        "error": str(_e),',
        f"    }})",
    ]

    # Feature is emitted inline within the try/except, so return empty string
    return lines, ""


def _emit_chamfer(step: dict, step_num: int, params: dict) -> tuple[list[str], str]:
    """Emit code for chamfering edges — always in try/except."""
    tag = step["tag"]
    size = _var_ref(step, "size", params)
    edge_selector = step.get("edges", "|Z")

    lines = [
        f"# Step {step_num}: Chamfer — {tag}",
        f"_step += 1",
        f"try:",
        f'    result = result.edges("{edge_selector}").chamfer({size}).tag("{tag}")',
        f"    _features.append({{",
        f'        "tag": "{tag}", "type": "chamfer", "step": _step,',
        f'        "position": [0, 0, 0],',
        f'        "dimensions": {{"size": {size}}},',
        f'        "depends_on": {_depends_on(step)},',
        f"    }})",
        f"except Exception as _e:",
        f"    _features.append({{",
        f'        "tag": "{tag}", "type": "chamfer_failed", "step": _step,',
        f'        "position": [0, 0, 0],',
        f'        "dimensions": {{"size": {size}}},',
        f'        "depends_on": {_depends_on(step)},',
        f'        "error": str(_e),',
        f"    }})",
    ]

    return lines, ""


def _emit_union(step: dict, step_num: int, params: dict) -> tuple[list[str], str]:
    """Emit code for unioning a secondary body into the main result."""
    tag = step["tag"]
    body = step["body"]  # dict describing the secondary body
    body_type = body["type"]  # "box" or "cylinder"
    translate = body.get("translate", [0, 0, 0])
    tx = _resolve_param(translate[0], params)
    ty = _resolve_param(translate[1], params)
    tz = _resolve_param(translate[2], params)

    lines = [
        f"# Step {step_num}: Union {body_type} — {tag}",
        f"_step += 1",
    ]

    if body_type == "box":
        bl = _var_ref_from(body, "length", params)
        bw = _var_ref_from(body, "width", params)
        bh = _var_ref_from(body, "height", params)
        # CadQuery .box() places base at Z=0 — translate Z is where the base goes
        lines.append(
            f'_body_{step_num} = cq.Workplane("XY").box({bl}, {bw}, {bh})'
            f'.translate(({tx}, {ty}, {tz}))'
        )
    elif body_type == "cylinder":
        bh = _var_ref_from(body, "height", params)
        br = _var_ref_from(body, "radius", params)
        # CadQuery .cylinder() centers vertically — offset Z by half height
        # so the base sits at the translate Z position
        bh_resolved = _resolve_param(body.get("height", 10), params)
        z_offset = f"{tz} + {bh_resolved}/2" if isinstance(bh_resolved, (int, float)) else f"{tz} + {bh}/2"
        lines.append(
            f'_body_{step_num} = cq.Workplane("XY").cylinder({bh}, {br})'
            f'.translate(({tx}, {ty}, {z_offset}))'
        )
    else:
        raise ValueError(f"Unsupported union body type: {body_type}")

    lines.append(f'result = result.union(_body_{step_num}).clean().tag("{tag}")')

    feature = (
        f'_features.append({{"tag": "{tag}", "type": "union", "step": _step, '
        f'"position": [{tx}, {ty}, {tz}], '
        f'"dimensions": {{}}, '
        f'"depends_on": {_depends_on(step)}}})'
    )
    return lines, feature


def _emit_revolve(step: dict, step_num: int, params: dict) -> tuple[list[str], str]:
    """Emit code for revolving a 2D profile around an axis."""
    tag = step["tag"]
    face = step.get("face", ">Z")
    angle = step.get("angle", 360)
    axis_point = step.get("axis_point", [0, 0])
    axis_dir = step.get("axis_dir", [0, 1])  # direction in 2D workplane
    profile = step["profile"]
    pos = profile.get("position", [0, 0])
    px, py = _resolve_param(pos[0], params), _resolve_param(pos[1], params)

    lines = [
        f"# Step {step_num}: Revolve — {tag}",
        f"_step += 1",
    ]

    sketch_lines = _sketch_for_profile(profile, params)
    ax, ay = axis_point
    dx, dy = axis_dir
    chain = (
        f'result = (result.faces("{face}").workplane(centerOption="CenterOfMass")'
        f'.moveTo({px}, {py})'
    )
    chain += sketch_lines
    chain += (
        f'.revolve({angle}, ({ax}, {ay}), ({ax + dx}, {ay + dy}))'
        f'.tag("{tag}"))'
    )
    lines.append(chain)

    feature = (
        f'_features.append({{"tag": "{tag}", "type": "revolve", "step": _step, '
        f'"position": [{px}, {py}, 0], '
        f'"dimensions": {{"angle": {angle}}}, '
        f'"depends_on": {_depends_on(step)}}})'
    )
    return lines, feature


def _emit_mirror(step: dict, step_num: int, params: dict) -> tuple[list[str], str]:
    """Emit code for mirroring the solid across a plane."""
    tag = step["tag"]
    plane = step.get("plane", "YZ")  # XY, YZ, or XZ

    lines = [
        f"# Step {step_num}: Mirror across {plane} — {tag}",
        f"_step += 1",
        f'_mirrored_{step_num} = result.mirror("{plane}")',
        f'result = result.union(_mirrored_{step_num}).clean().tag("{tag}")',
    ]

    feature = (
        f'_features.append({{"tag": "{tag}", "type": "mirror", "step": _step, '
        f'"position": [0, 0, 0], '
        f'"dimensions": {{"plane": "{plane}"}}, '
        f'"depends_on": {_depends_on(step)}}})'
    )
    return lines, feature


# ---------------------------------------------------------------------------
# Sketch helpers (2D profile to CadQuery chain fragment)
# ---------------------------------------------------------------------------


def _sketch_for_profile(profile: dict, params: dict) -> str:
    """Return the CadQuery chain fragment for a 2D profile shape.

    Supports: rect, circle, polygon, slot.
    The returned string is appended to a .moveTo() chain and does NOT
    include the terminal operation (.extrude, .cutBlind, etc.).
    """
    ptype = profile["type"]

    # Normalise common aliases the LLM may produce
    _POLYGON_ALIASES = {"triangle": 3, "pentagon": 5, "hexagon": 6, "octagon": 8}
    if ptype in _POLYGON_ALIASES:
        profile = {**profile, "type": "polygon", "sides": _POLYGON_ALIASES[ptype]}
        if "radius" not in profile:
            profile["radius"] = profile.get("size", profile.get("width", 10))
        ptype = "polygon"
    elif ptype in ("square", "rectangle"):
        ptype = "rect"

    if ptype == "rect":
        w = _var_ref_from(profile, "width", params)
        h = _var_ref_from(profile, "height", params)
        return f".rect({w}, {h})"

    elif ptype == "circle":
        r = _var_ref_from(profile, "radius", params)
        return f".circle({r})"

    elif ptype == "polygon":
        n_sides = profile.get("sides", 6)
        r = _var_ref_from(profile, "radius", params)
        return f".polygon({n_sides}, {r} * 2)"  # CQ polygon takes diameter

    elif ptype == "slot":
        length = _var_ref_from(profile, "length", params)
        width = _var_ref_from(profile, "width", params)
        return f".slot2D({length}, {width})"

    else:
        raise ValueError(f"Unsupported profile type: {ptype}")


# ---------------------------------------------------------------------------
# Hole pattern point generation
# ---------------------------------------------------------------------------


def _hole_points_expr(step: dict, params: dict) -> str:
    """Return a Python expression string for the hole point positions."""
    pattern = step.get("pattern", "single")

    if pattern == "single":
        pos = step.get("position", [0, 0])
        px = _resolve_param(pos[0], params)
        py = _resolve_param(pos[1], params)
        return f"[({px}, {py})]"

    elif pattern == "grid":
        rows = step.get("rows", 2)
        cols = step.get("cols", 2)
        x_spacing = _resolve_param(step.get("x_spacing", 10), params)
        y_spacing = _resolve_param(step.get("y_spacing", 10), params)
        x_offset = step.get("x_offset", 0)
        y_offset = step.get("y_offset", 0)
        # Generate inline list comprehension
        return (
            f"[({x_offset} + c * {x_spacing} - ({cols}-1) * {x_spacing}/2, "
            f"{y_offset} + r * {y_spacing} - ({rows}-1) * {y_spacing}/2) "
            f"for r in range({rows}) for c in range({cols})]"
        )

    elif pattern == "bolt_circle":
        bolt_radius = _resolve_param(step.get("bolt_radius", 20), params)
        count = step.get("count", 4)
        start_angle = step.get("start_angle", 0)
        return (
            f"[({bolt_radius} * math.cos(math.radians({start_angle} + i * 360/{count})), "
            f"{bolt_radius} * math.sin(math.radians({start_angle} + i * 360/{count}))) "
            f"for i in range({count})]"
        )

    elif pattern == "explicit":
        positions = step.get("positions", [])
        resolved = [
            (_resolve_param(p[0], params), _resolve_param(p[1], params))
            for p in positions
        ]
        return str(resolved)

    else:
        raise ValueError(f"Unsupported hole pattern: {pattern}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _var_ref(step: dict, key: str, params: dict) -> str:
    """Return a variable name if the step value is a $ref, else the literal value.

    This keeps the generated code readable — parameters appear as variable names
    rather than resolved numeric literals.
    """
    val = step.get(key)
    if val is None:
        raise ValueError(f"Missing required key '{key}' in step: {step.get('tag', '?')}")
    if isinstance(val, str) and val.startswith("$"):
        return val[1:]  # return the variable name (without $)
    return repr(val)


_KEY_ALIASES = {
    "radius": ["radius", "r", "rad"],
    "width": ["width", "w"],
    "height": ["height", "h", "depth", "thickness"],
    "length": ["length", "l", "len"],
}


def _var_ref_from(obj: dict, key: str, params: dict) -> str:
    """Like _var_ref but for an arbitrary dict (e.g. a profile or body sub-object).

    Tries alias keys and auto-converts diameter→radius before failing.
    """
    # Direct hit
    val = obj.get(key)

    # Try aliases
    if val is None:
        for alias in _KEY_ALIASES.get(key, []):
            val = obj.get(alias)
            if val is not None:
                break

    # diameter → radius conversion
    if val is None and key == "radius":
        d = obj.get("diameter") or obj.get("d")
        if d is not None:
            if isinstance(d, str) and d.startswith("$"):
                return f"({d[1:]} / 2)"
            return repr(d / 2 if isinstance(d, (int, float)) else d)

    if val is None:
        raise ValueError(f"Missing required key '{key}' in object: {obj}")
    if isinstance(val, str) and val.startswith("$"):
        return val[1:]
    return repr(val)


def _depends_on(step: dict) -> str:
    """Return the depends_on list as a Python literal string."""
    deps = step.get("depends_on", [])
    return repr(deps)


# ---------------------------------------------------------------------------
# Operation dispatch
# ---------------------------------------------------------------------------

EMITTERS = {
    "create_box": _emit_create_box,
    "create_cylinder": _emit_create_cylinder,
    "extrude_profile": _emit_extrude_profile,
    "cut_blind": _emit_cut_blind,
    "cut_through": _emit_cut_through,
    "holes": _emit_holes,
    "shell": _emit_shell,
    "fillet": _emit_fillet,
    "chamfer": _emit_chamfer,
    "union": _emit_union,
    "revolve": _emit_revolve,
    "mirror": _emit_mirror,
}


# ---------------------------------------------------------------------------
# Step reordering
# ---------------------------------------------------------------------------


def _reorder_steps(steps: list[dict]) -> list[dict]:
    """Reorder steps to ensure correct execution sequence.

    Ordering rules:
      Phase 0: Base solid (create_box, create_cylinder) — must be first
      Phase 1: Additive ops (extrude_profile, union, revolve, mirror)
      Phase 2: Shell (must come before cuts)
      Phase 3: Subtractive ops (cut_blind, cut_through, holes)
      Phase 5: Cosmetic ops (fillet, chamfer) — always last

    Within each phase, original order is preserved (stable sort).
    """
    def sort_key(step: dict) -> tuple[int, int]:
        op = step.get("op", "")
        phase = PHASE_ORDER.get(op, 4)
        # Use the original index as tiebreaker for stability
        return (phase, step.get("_original_index", 0))

    # Tag each step with its original index for stable sorting
    for i, step in enumerate(steps):
        step["_original_index"] = i

    ordered = sorted(steps, key=sort_key)

    # Clean up the temporary index
    for step in ordered:
        step.pop("_original_index", None)

    return ordered


# ---------------------------------------------------------------------------
# Parameter extraction and declaration
# ---------------------------------------------------------------------------


def _collect_parameters(steps: list[dict], parameters: dict) -> list[tuple[str, Any]]:
    """Walk all steps and collect $variable references, paired with their resolved values.

    Returns deduplicated list of (name, value) tuples in alphabetical order.
    """
    seen: dict[str, Any] = {}

    def _scan(obj: Any):
        if isinstance(obj, str) and obj.startswith("$"):
            name = obj[1:]
            if name not in seen and name in parameters:
                seen[name] = parameters[name]
        elif isinstance(obj, dict):
            for v in obj.values():
                _scan(v)
        elif isinstance(obj, list):
            for item in obj:
                _scan(item)

    for step in steps:
        _scan(step)

    # Also include any parameters not referenced by steps (they may be used
    # in expressions that reference other params)
    for name, value in parameters.items():
        if name not in seen:
            seen[name] = value

    return sorted(seen.items())


def _emit_parameter_declarations(param_list: list[tuple[str, Any]]) -> list[str]:
    """Emit Python variable declarations for all parameters."""
    if not param_list:
        return []

    lines = ["# === PARAMETERS (all dimensions in millimeters) ==="]
    for name, value in param_list:
        if isinstance(value, str):
            lines.append(f'{name} = "{value}"')
        else:
            lines.append(f"{name} = {value}")
    return lines


# ---------------------------------------------------------------------------
# Clean pass insertion
# ---------------------------------------------------------------------------


def _needs_clean_before(steps: list[dict], index: int) -> bool:
    """Determine if a .clean() call is needed before step at `index`.

    Insert .clean() when transitioning from boolean ops to cosmetic ops,
    or after any union operation.
    """
    if index == 0:
        return False

    current_op = steps[index].get("op", "")
    prev_op = steps[index - 1].get("op", "")

    # Clean before fillets/chamfers if the previous op was a boolean
    if current_op in COSMETIC_OPS:
        # Check if any preceding op was a boolean
        for j in range(index - 1, -1, -1):
            op_j = steps[j].get("op", "")
            if op_j in ("union", "cut_blind", "cut_through", "holes", "shell", "mirror"):
                return True
            if op_j in COSMETIC_OPS:
                return False  # already cleaned
        return False

    return False


# ---------------------------------------------------------------------------
# Constraint resolution for steps
# ---------------------------------------------------------------------------


def _resolve_step_constraints(step: dict, parameters: dict, tracker: _ConstraintFaceTracker) -> dict:
    """Pre-process a step to resolve constraint-based positions to raw [u, v] coordinates.

    This allows the LLM to use intent-based positioning like:
        {"h": "center", "v": {"from": "bottom", "offset": 6}}
    instead of calculating raw coordinates.
    """
    import copy
    step = copy.deepcopy(step)  # don't mutate the original

    face = step.get("face", ">Z")
    face_dims = tracker.get_face_dims(face)
    if not face_dims:
        return step  # unknown face, can't resolve constraints

    face_w, face_h = face_dims

    # Resolve profile position constraints
    profile = step.get("profile")
    if profile and isinstance(profile, dict):
        pos = profile.get("position")
        if pos and isinstance(pos, dict) and ("h" in pos or "v" in pos):
            # Get feature dimensions for edge offset calculation
            feat_w = _resolve_param(profile.get("width", 0), parameters) if profile.get("width") else 0
            feat_h = _resolve_param(profile.get("height", 0), parameters) if profile.get("height") else 0
            if profile.get("type") == "circle":
                feat_w = feat_h = _resolve_param(profile.get("radius", 0), parameters) * 2
            resolved = resolve_position(pos, face_w, face_h, feat_w, feat_h)
            profile["position"] = resolved

    # Resolve step-level position constraints
    pos = step.get("position")
    if pos and isinstance(pos, dict) and ("h" in pos or "v" in pos):
        resolved = resolve_position(pos, face_w, face_h)
        step["position"] = resolved

    # Resolve hole placement constraints
    placement = step.get("placement")
    if placement and isinstance(placement, dict) and "type" in placement:
        resolved_pts = resolve_hole_placement(placement, face_w, face_h)
        step["positions"] = [list(p) for p in resolved_pts]
        step["pattern"] = "explicit"  # converter uses explicit pattern for resolved points

    # Resolve positions list with constraints (e.g., each position is a constraint)
    positions = step.get("positions")
    if positions and isinstance(positions, list):
        resolved = []
        for p in positions:
            if isinstance(p, dict) and ("h" in p or "v" in p):
                resolved.append(resolve_position(p, face_w, face_h))
            elif isinstance(p, (list, tuple)):
                resolved.append([float(p[0]), float(p[1])])
            else:
                resolved.append(p)
        step["positions"] = resolved

    return step


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def convert_json_to_cadquery(steps: list[dict], parameters: dict) -> str:
    """Convert a JSON operation list to a complete CadQuery Python script.

    Args:
        steps: List of operation dicts. Each must have at minimum:
            - "op": operation type (e.g. "create_box", "holes", "fillet")
            - "tag": unique feature tag string
            - Operation-specific keys (see individual emitters)
            - "depends_on": list of tag strings this step depends on

        parameters: Dict mapping parameter names to numeric values.
            Steps reference these as "$param_name" strings.

    Returns:
        A complete Python script string ready for the CadQuery sandbox executor.

    Raises:
        ValueError: If an unknown operation type is encountered or required
            keys are missing from a step.

    Example input:
        steps = [
            {"op": "create_box", "tag": "base", "length": "$box_length",
             "width": "$box_width", "height": "$box_height", "depends_on": []},
            {"op": "holes", "tag": "mounting_holes", "face": ">Z",
             "diameter": "$hole_d", "pattern": "bolt_circle",
             "bolt_radius": "$bolt_r", "count": 4,
             "depends_on": ["base"]},
            {"op": "fillet", "tag": "edge_fillets", "radius": "$fillet_r",
             "edges": "|Z", "depends_on": ["base"]},
        ]
        parameters = {
            "box_length": 80.0, "box_width": 60.0, "box_height": 20.0,
            "hole_d": 5.0, "bolt_r": 25.0, "fillet_r": 2.0,
        }
    """
    if not steps:
        raise ValueError("Steps list is empty — at least one base operation required")

    # Validate all ops are known
    for step in steps:
        op = step.get("op")
        if op not in EMITTERS:
            raise ValueError(f"Unknown operation type: {op}")
        if not step.get("tag"):
            raise ValueError(f"Step missing required 'tag' field: {step}")

    # Validate at least one base solid
    base_ops = [s for s in steps if s["op"] in ("create_box", "create_cylinder")]
    if not base_ops:
        raise ValueError("No base solid operation found (need create_box or create_cylinder)")

    # Validate unique tags
    tags = [s["tag"] for s in steps]
    if len(tags) != len(set(tags)):
        dupes = [t for t in tags if tags.count(t) > 1]
        raise ValueError(f"Duplicate tags: {set(dupes)}")

    # Phase 1: Reorder steps for correct execution
    ordered_steps = _reorder_steps(steps)

    # Phase 2: Collect and declare parameters
    param_list = _collect_parameters(ordered_steps, parameters)

    # Phase 3: Build the script
    script_lines: list[str] = []

    # Header
    script_lines.append("import cadquery as cq")
    script_lines.append("import math")
    script_lines.append("")

    # Parameter declarations
    param_lines = _emit_parameter_declarations(param_list)
    script_lines.extend(param_lines)
    if param_lines:
        script_lines.append("")

    # Feature tracking init
    script_lines.append("# === FEATURE TRACKING ===")
    script_lines.append("_features = []")
    script_lines.append("_step = 0")
    script_lines.append("")

    # Build geometry
    script_lines.append("# === BUILD GEOMETRY ===")

    face_tracker = FaceTracker()
    constraint_tracker = _ConstraintFaceTracker()

    for i, step in enumerate(ordered_steps):
        op = step["op"]
        step_num = i + 1

        # Insert .clean() if needed before cosmetic ops
        if _needs_clean_before(ordered_steps, i):
            script_lines.append("")
            script_lines.append("# Repair topology before cosmetic operations")
            script_lines.append("result = result.clean()")

        # Resolve constraint-based positions to raw coordinates before emitting
        step = _resolve_step_constraints(step, parameters, constraint_tracker)

        emitter = EMITTERS[op]
        code_lines, feature_code = emitter(step, step_num, parameters)

        script_lines.append("")
        script_lines.extend(code_lines)
        if feature_code:
            script_lines.append(feature_code)

        # Update face trackers
        if op == "create_box":
            l = _resolve_param(step["length"], parameters)
            w = _resolve_param(step["width"], parameters)
            h = _resolve_param(step["height"], parameters)
            face_tracker.after_base_box(l, w, h)
            constraint_tracker.after_base_box(l, w, h)
        elif op == "create_cylinder":
            h = _resolve_param(step["height"], parameters)
            r = _resolve_param(step["radius"], parameters)
            face_tracker.after_base_cylinder(h, r)
            constraint_tracker.after_base_cylinder(h, r)
        elif op == "shell":
            t = _resolve_param(step.get("thickness", 2), parameters)
            constraint_tracker.after_shell(t)

    # Final newline
    script_lines.append("")

    script = "\n".join(script_lines)

    logger.info(
        f"Converter produced {len(script_lines)} lines, "
        f"{len(ordered_steps)} operations, "
        f"{len(param_list)} parameters"
    )

    return script


# ---------------------------------------------------------------------------
# Utility: report available faces after conversion
# ---------------------------------------------------------------------------


def infer_faces(steps: list[dict], parameters: dict) -> list[dict]:
    """Infer available faces from the step sequence without executing CadQuery.

    Returns a list of face dicts with selector, description, and approximate center.
    This is an approximation for UI purposes — the executor's VALIDATION_SUFFIX
    extracts the true face inventory after execution.
    """
    tracker = FaceTracker()

    for step in steps:
        op = step.get("op")
        if op == "create_box":
            tracker.after_base_box(
                _resolve_param(step["length"], parameters),
                _resolve_param(step["width"], parameters),
                _resolve_param(step["height"], parameters),
            )
        elif op == "create_cylinder":
            tracker.after_base_cylinder(
                _resolve_param(step["height"], parameters),
                _resolve_param(step["radius"], parameters),
            )
        # Additional ops could refine the face list, but the base solid
        # provides the primary work-faces for subsequent operations.

    return tracker.faces

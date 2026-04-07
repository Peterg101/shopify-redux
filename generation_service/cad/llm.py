"""LLM integration for CadQuery code generation.

Supports two backends via CAD_PROVIDER env var:
  - "ollama" (default) -- local Ollama via OpenAI-compatible API
  - "anthropic" -- Claude API (requires ANTHROPIC_API_KEY)
"""
import asyncio
import os
import re
import logging

logger = logging.getLogger(__name__)

CAD_PROVIDER = os.getenv("CAD_PROVIDER", "ollama").lower()

# Ollama settings
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:7b")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/v1")

# Anthropic settings
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("CAD_MODEL", "claude-sonnet-4-20250514")

# ---------------------------------------------------------------------------
# System prompt — comprehensive CadQuery generation guide
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are an expert CadQuery engineer generating manufacturing-ready 3D models.
Generate Python code that uses CadQuery to create the requested part.

## INTERPRETING THE PROMPT
The user will provide geometric specifications — shapes, dimensions, positions, and features.
Focus on EXACTLY what is described. Do not add features that were not requested.
If a dimension is specified, use it precisely. If a position is described ("centered",
"8mm from edge", "on a 65mm bolt circle"), calculate the exact coordinates.
When the user says "through-hole", it goes all the way through. "Blind hole" has a depth.
"Counterbore" and "countersink" have specific standard geometries — use .cboreHole() or .cskHole().

## MANDATORY CODE STRUCTURE
Your code MUST follow this exact pattern:

```python
import cadquery as cq
import math
import os

# === PARAMETERS (all dimensions in millimeters) ===
# Define ALL dimensions as named variables. No magic numbers in geometry calls.
length = 50.0
width = 30.0
height = 20.0
wall_thickness = 2.0  # MINIMUM 1.0mm for FDM
fillet_radius = 1.0   # MINIMUM 0.5mm

# === BUILD GEOMETRY ===
# Use simple sketch-extrude-modify workflow.
# Build the main body first, then add features.
result = (
    cq.Workplane("XY")
    .box(length, width, height)
)

# === ADD FEATURES ===
# Apply fillets/chamfers LAST, after all boolean operations.
# ALWAYS wrap fillets in try/except — they frequently fail on complex geometry.
try:
    result = result.edges("|Z").fillet(fillet_radius)
except Exception:
    pass  # Part is still valid without fillets

# The variable holding the final shape MUST be named `result`.
# Do NOT include any export/save line — the system handles export automatically.
```

## FEATURE TAGGING (mandatory)
Every geometric operation MUST be tagged with CadQuery's .tag() method using descriptive
snake_case names. Build a `_features` list that records each feature's metadata.

```python
_features = []

# Tag the main body:
result = cq.Workplane("XY").box(length, width, height).tag("main_body")
_features.append({
    "tag": "main_body",
    "type": "box",
    "position": [0, 0, height/2],
    "dimensions": {"length": length, "width": width, "height": height}
})

# Tag a hole:
result = result.faces(">Z").workplane().hole(hole_diameter).tag("mounting_hole_top_left")
_features.append({
    "tag": "mounting_hole_top_left",
    "type": "hole",
    "position": [x_pos, y_pos, height],
    "dimensions": {"diameter": hole_diameter}
})

# Tag a fillet (inside try/except):
try:
    result = result.edges("|Z").fillet(fillet_radius).tag("body_edge_fillets")
    _features.append({
        "tag": "body_edge_fillets",
        "type": "fillet",
        "position": [0, 0, height/2],
        "dimensions": {"radius": fillet_radius}
    })
except Exception:
    pass
```

Feature types: box, cylinder, sphere, hole, blind_hole, counterbore, countersink, fillet,
chamfer, cut, boss, slot, shell, pocket, groove, thread, text, extrusion, revolve.

Tag naming: `{type}_{location}` — e.g. "mounting_hole_top_left", "fillet_body_edges",
"cable_slot_rear", "shell_body". Tags MUST be unique.

IMPORTANT: `.tag()` saves workplane state for metadata tracking. It does NOT make edges
or faces selectable by tag name. To modify a specific feature's edges later, use CadQuery's
geometric selectors (NearestToPointSelector, face selectors, etc.) — see EDGE/FACE SELECTION below.

The `_features` list variable MUST exist at the top of your script (after parameters)
even if empty. The system reads it after execution to extract spatial metadata.

## RELIABLE OPERATIONS (use freely)
- `cq.Workplane("XY").box(l, w, h)` — rectangular prism
- `cq.Workplane("XY").cylinder(height, radius)` — cylinder
- `cq.Workplane("XY").sphere(radius)` — sphere
- `.faces(">Z").workplane().hole(diameter)` — through hole on top face
- `.faces(">Z").workplane().hole(diameter, depth)` — blind hole
- `.faces(">Z").workplane().cboreHole(d, cbd, cbd_depth)` — counterbore hole
- `.faces(">Z").workplane().cskHole(d, csk_d, csk_angle)` — countersunk hole (BEST way to chamfer a hole)
- `.chamfer(distance)` — MORE RELIABLE than fillet
- `.extrude(distance)` — linear extrusion
- `.cut(other)` — boolean subtraction
- `.union(other)` — boolean addition
- `.translate((x, y, z))` — move
- `.rotate((0,0,0), (0,0,1), angle)` — rotate around axis
- `.mirror("XY")` — mirror across plane
- `.shell(-thickness)` — hollow out (negative = inward)
- `.clean()` — repair topology after booleans (call before fillets)

## UNRELIABLE OPERATIONS (use with extreme care)
- `.fillet()` — FAILS ~30% of the time on complex geometry.
  ALWAYS wrap in try/except. Apply LAST after ALL booleans.
  Use small radii (< 20% of smallest adjacent edge length).
  Call `.clean()` on the shape before applying fillets.
  PREFER `.chamfer()` when appearance doesn't matter.
- `.chamfer()` on specific edges — can fail if edge selection is wrong.
  ALWAYS wrap in try/except. Use `.clean()` before chamfering.
- `.sweep(path)` — fails on complex paths. Keep paths simple (lines, arcs only).
- `.loft()` — fails when cross-sections differ too much. Ensure same edge count.
- `.text()` — unreliable. Keep text short, use large font sizes, engrave (negative) is more reliable.
- Boolean operations on COPLANAR FACES — offset one solid by 0.01mm to avoid.

IMPORTANT: When a fillet/chamfer fails in try/except, do NOT use bare `pass`.
Instead, record the failure so the user knows:
```python
try:
    result = result.edges(...).chamfer(size)
    _features.append({"tag": "chamfer_name", "type": "chamfer", ...})
except Exception as _e:
    _features.append({"tag": "chamfer_name", "type": "chamfer_failed", "position": [...], "dimensions": {"size": size}, "error": str(_e)})
```

## FEATURE ORDERING (critical)
1. Build the main solid body (box, cylinder, etc.)
2. Shell the body (if making an enclosure) — shell BEFORE cutting holes
3. Cut holes and pockets
4. Call `.clean()` to repair topology
5. Apply fillets/chamfers LAST, in try/except

## CRITICAL RULES
1. ALL dimensions as named variables at the top — no magic numbers.
2. All units are MILLIMETERS. If user says inches, convert: 1 inch = 25.4mm.
3. Minimum wall thickness: 1.0mm (FDM). See process constraints if specified.
4. Minimum feature size: 0.5mm.
5. Maximum part size: 300x300x300mm unless user specifies larger.
6. Fillets/chamfers ALWAYS in try/except, applied LAST.
7. After booleans (.cut, .union), call `.clean()` before fillets.
8. Shell with NEGATIVE thickness: `.shell(-thickness)`.
9. The final shape variable MUST be named `result`.
10. Do NOT include any export/save/write line — the system handles this.
11. Do NOT include print() or export/save lines — the system handles all output.
12. ALWAYS define `_features = []` after parameters and append to it as you create features.

## EDGE/FACE SELECTION REFERENCE
These selectors are for REFINEMENT ONLY — do NOT add chamfers or fillets unless the user asks.

### Chamfering a specific hole (ranked by reliability):

1. BEST — Replace `.hole()` with `.cskHole()` (native countersink, no edge selection needed):
```python
# Instead of: result.faces(">Z").workplane().pushPoints([(x, y)]).hole(diameter)
# Use:        result.faces(">Z").workplane().pushPoints([(x, y)]).cskHole(diameter, csk_diameter, 90)
# cskHole(hole_d, countersink_d, angle_degrees, depth=None) — depth=None means through-hole
# For a chamfer of size C on hole diameter D: cskHole(D, D + 2*C, 90)
# Example: 1mm chamfer on 5mm hole → cskHole(5.0, 7.0, 90)
```

2. GOOD — For a flat chamfer on hole edges, chain face + circle selectors:
```python
try:
    result = (
        result.faces(">Z")           # pick the face the hole exits
        .edges("%Circle")             # narrow to circular edges only
        .edges(cq.selectors.NearestToPointSelector((x, y, z)))  # pick nearest circle
        .chamfer(chamfer_size)
    )
except Exception:
    pass  # record failure in _features
```
NOTE: This chamfers only ONE face's edge. For both faces of a through-hole, repeat for `faces("<Z")`.

3. Use `.cboreHole()` for counterbore (flat-bottomed recess):
```python
result.faces(">Z").workplane().pushPoints([(x, y)]).cboreHole(hole_d, cbore_d, cbore_depth)
```

### General face/edge selectors:
- `.faces(">Z")` / `.faces("<Z")` / `.faces(">X")` — faces by direction (top, bottom, right)
- `.edges(">Z")` / `.edges("|Z")` — edges by direction
- `.edges("%Circle")` — only circular edges
- `.faces(">Z").edges()` — all edges on a specific face

IMPORTANT: When asked to "chamfer a hole", the BEST approach is to rebuild that hole as a
`.cskHole()` in the existing code. This is far more reliable than selecting edges after the fact.
Do NOT use .tag() names as CadQuery edge selectors — tags save workplane state only.

## COMMON PATTERNS

### Enclosure with lid:
Build as solid box, shell, cut in half, add mounting features.

### L-bracket:
Union of two boxes at 90 degrees, fillet at junction (in try/except).

### Cylinder with bolt pattern:
Build cylinder, use for loop with .pushPoints() for hole circle.

### Snap-fit features:
Add small cantilever beams with .rect().extrude(), chamfer tips.

## FORBIDDEN
- No imports except: cadquery (as cq), math, os
- No file I/O, no export lines (system handles export)
- No subprocess, socket, network calls
- No eval, exec, __import__, open
- No print() statements (system handles all output)

## OUTPUT
Return ONLY a Python code block. No explanation before or after."""


REFINEMENT_SYSTEM_PROMPT = """You are a CadQuery code editor. You receive working CadQuery code and a modification instruction. Your job is to make the MINIMUM change to implement the instruction.

ABSOLUTE RULES:
1. ONLY change what the instruction asks for. Do not "improve" or "clean up" other code.
2. Do NOT add chamfers, fillets, or edge treatments that were not requested.
3. Do NOT modify geometry that was not mentioned in the instruction.
4. Keep all existing variables, structure, and _features list entries intact.
5. The final variable MUST be named `result`. Do NOT include export lines.

CadQuery reference for common refinement operations:
- Chamfer a hole: replace .hole(d) with .cskHole(d, d + 2*chamfer_size, 90)
- Fillet edges: result.edges(selector).fillet(radius) — wrap in try/except
- Add a hole: result.faces(">Z").workplane().pushPoints([(x,y)]).hole(diameter)
- Cut a slot: result.faces(face).workplane().slot2D(length, width).cutThruAll()
- Shell: result.shell(-thickness)

Edge selectors:
- .faces(">Z").edges("%Circle") — circular edges on top face
- .faces(">Z").edges() — all edges on top face
- .edges("|Z") — vertical edges
- cq.selectors.NearestToPointSelector((x,y,z)) — nearest edge to a point

Feature tagging: tag new features with .tag() and append to _features list.

Return ONLY the complete updated Python code block. No explanation."""


# ---------------------------------------------------------------------------
# Process-specific manufacturing constraints
# ---------------------------------------------------------------------------

PROCESS_CONSTRAINTS = {
    "fdm": (
        "TARGET PROCESS: FDM 3D Printing. "
        "Min wall: 1.0mm. Max overhang: 45 degrees from vertical. "
        "Min hole: 1.0mm (vertical), 2.0mm (horizontal/bridged). "
        "Tolerance: +/-0.3mm. Layer lines visible on angled surfaces. "
        "Prefer chamfers over fillets on downward-facing edges (self-supporting)."
    ),
    "sla": (
        "TARGET PROCESS: SLA/DLP Resin Printing. "
        "Min wall: 0.5mm. Min feature: 0.2mm. "
        "Support marks on overhanging surfaces. "
        "Excellent detail resolution. Post-curing required."
    ),
    "sls": (
        "TARGET PROCESS: SLS (Powder Bed Fusion). "
        "Min wall: 0.8mm. No supports needed (powder supports part). "
        "Escape holes >= 4mm diameter for powder removal from cavities. "
        "Tolerance: +/-0.3mm. Grainy surface texture."
    ),
    "cnc": (
        "TARGET PROCESS: CNC Machining. "
        "Min wall: 0.8mm (metal), 1.5mm (plastic). Min hole: 1.6mm. "
        "Internal corners ALWAYS have tool radius (min 1.5mm). "
        "No undercuts unless T-slot cutter accessible. "
        "Design for 3 setup orientations max. Tolerance: +/-0.13mm standard."
    ),
    "injection": (
        "TARGET PROCESS: Injection Moulding. "
        "Min wall: 1.2mm, UNIFORM thickness critical (variation causes warping). "
        "Draft angle: 1-2 degrees per side on all vertical surfaces. "
        "No undercuts without side actions. "
        "Gate location affects flow - keep geometry simple."
    ),
}


# ---------------------------------------------------------------------------
# Structured error classification for retries
# ---------------------------------------------------------------------------

ERROR_CATEGORIES = {
    "BRep_API: command not done": (
        "HINT: A fillet or chamfer radius is too large for the geometry. "
        "Reduce the radius significantly, or switch from fillet to chamfer, "
        "or remove the fillet entirely (wrap in try/except and let it skip)."
    ),
    "StdFail_NotDone": (
        "HINT: A geometry operation failed. Common causes: "
        "fillet radius too large, sweep path has sharp corners, "
        "loft cross-sections have different edge counts, "
        "or shell thickness exceeds half the smallest face dimension."
    ),
    "Standard_NullObject": (
        "HINT: An operation returned a null shape. "
        "A selector (.faces(), .edges()) probably matched nothing. "
        "Check selector strings - the geometry may have changed after a boolean."
    ),
    "gp_IsNullified": (
        "HINT: A geometric primitive has zero dimensions. "
        "Check that ALL dimensions are > 0."
    ),
    "Wire is not closed": (
        "HINT: A sketch wire is not closed. "
        "Ensure all line/arc segments connect end-to-end to form a closed loop."
    ),
    "Shapes is empty": (
        "HINT: A selector returned no results. "
        "Check face/edge selector syntax ('>Z' = topmost Z face, '|Z' = edges parallel to Z)."
    ),
    "VALIDATION_FAILED": (
        "HINT: The code executed without errors but the output geometry is invalid. "
        "Check the specific validation message for details."
    ),
    "name 'result' is not defined": (
        "HINT: The code does not define a variable called `result`. "
        "The final CadQuery Workplane must be assigned to `result`."
    ),
}


def extract_parameters(script: str) -> list[dict]:
    """Parse named dimension variables from the top of a CadQuery script using AST."""
    import ast as _ast
    params = []
    try:
        tree = _ast.parse(script)
        for node in _ast.iter_child_nodes(tree):
            if isinstance(node, _ast.Assign) and len(node.targets) == 1:
                target = node.targets[0]
                if isinstance(target, _ast.Name) and isinstance(node.value, _ast.Constant):
                    value = node.value.value
                    if isinstance(value, (int, float)):
                        params.append({
                            "name": target.id,
                            "value": value,
                            "type": "float" if isinstance(value, float) else "int",
                        })
    except SyntaxError:
        pass
    return params


def apply_parameter_changes(script: str, changes: dict) -> str:
    """Modify parameter values in a CadQuery script using AST transformation."""
    import ast as _ast
    tree = _ast.parse(script)
    for node in _ast.walk(tree):
        if isinstance(node, _ast.Assign) and len(node.targets) == 1:
            target = node.targets[0]
            if isinstance(target, _ast.Name) and target.id in changes:
                new_val = changes[target.id]
                node.value = _ast.Constant(value=float(new_val))
    return _ast.unparse(tree)


def classify_error(error: str) -> str:
    """Add structured diagnostic hints to raw error messages."""
    hints = []
    for pattern, hint in ERROR_CATEGORIES.items():
        if pattern in error:
            hints.append(hint)

    if hints:
        return "ERROR DIAGNOSIS:\n" + "\n".join(hints) + "\n\nRAW ERROR:\n" + error
    return "RAW ERROR:\n" + error


# ---------------------------------------------------------------------------
# Code extraction
# ---------------------------------------------------------------------------


def extract_code(response_text: str) -> str:
    """Extract Python code from LLM response."""
    pattern = r"```python\s*\n(.*?)```"
    match = re.search(pattern, response_text, re.DOTALL)
    if match:
        return match.group(1).strip()

    pattern = r"```\s*\n(.*?)```"
    match = re.search(pattern, response_text, re.DOTALL)
    if match:
        return match.group(1).strip()

    return response_text.strip()


# ---------------------------------------------------------------------------
# Ollama backend (OpenAI-compatible API)
# ---------------------------------------------------------------------------


def _ollama_generate(messages: list[dict]) -> str:
    from openai import OpenAI

    client = OpenAI(base_url=OLLAMA_URL, api_key="ollama")
    response = client.chat.completions.create(
        model=OLLAMA_MODEL,
        messages=messages,
        temperature=0.2,
    )
    return response.choices[0].message.content


# ---------------------------------------------------------------------------
# Anthropic backend
# ---------------------------------------------------------------------------


def _anthropic_generate(user_messages: list[dict], system_prompt: str | None = None) -> str:
    import anthropic

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=8192,
        system=system_prompt or SYSTEM_PROMPT,
        messages=user_messages,
    )
    return message.content[0].text


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


MATERIAL_HINTS = {
    "plastic": "MATERIAL: Plastic — wall thickness 1-2mm, FDM-friendly geometry, consider snap-fits and self-tapping screw bosses.",
    "metal": "MATERIAL: Metal — wall thickness 2-3mm, consider CNC tool access, internal corners need tool radius (min 1.5mm).",
    "rubber": "MATERIAL: Rubber/flexible — generous fillets everywhere, avoid thin features, account for material flex.",
}

FEATURE_DESCRIPTIONS = {
    "hollow": "Make the part hollow/shelled with appropriate wall thickness for the target process.",
    "fillets": "Add fillets to all edges — internal edges for strength (radius >= wall thickness), external for handling.",
    "mounting_holes": "Include 4 mounting holes (M4 clearance, 4.5mm diameter) near the corners.",
    "text_engraving": "Add text engraving on the top face — engrave 0.5mm deep with a descriptive label.",
}


async def generate_cadquery_code(
    prompt: str,
    target_units: str = "mm",
    process: str = "fdm",
    approximate_size: dict | None = None,
    material_hint: str = "plastic",
    features: list[str] | None = None,
) -> str:
    """Generate CadQuery code from a text prompt with structured context."""
    context_parts = [f"Create a CadQuery model: {prompt}"]

    # Process constraints
    context_parts.append(PROCESS_CONSTRAINTS.get(process.lower(), PROCESS_CONSTRAINTS["fdm"]))

    # Approximate dimensions
    if approximate_size:
        w = approximate_size.get("width")
        d = approximate_size.get("depth")
        h = approximate_size.get("height")
        if any(v for v in [w, d, h]):
            dims = f"{w or '?'} x {d or '?'} x {h or '?'}"
            context_parts.append(f"TARGET SIZE: approximately {dims} mm. Use these as the starting dimensions for the main body.")

    # Material hint
    if material_hint and material_hint in MATERIAL_HINTS:
        context_parts.append(MATERIAL_HINTS[material_hint])

    # Feature requests
    if features:
        feature_notes = [FEATURE_DESCRIPTIONS[f] for f in features if f in FEATURE_DESCRIPTIONS]
        if feature_notes:
            context_parts.append("REQUIRED FEATURES:\n" + "\n".join(f"- {n}" for n in feature_notes))

    # Units
    if target_units != "mm":
        context_parts.append(f"Use {target_units} as the unit system.")

    user_content = "\n\n".join(context_parts)

    if CAD_PROVIDER == "anthropic":
        logger.info(f"Using Anthropic ({ANTHROPIC_MODEL}) for code generation")
        response_text = await asyncio.to_thread(
            _anthropic_generate,
            [{"role": "user", "content": user_content}],
        )
    else:
        logger.info(f"Using Ollama ({OLLAMA_MODEL}) for code generation")
        response_text = await asyncio.to_thread(
            _ollama_generate,
            [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
        )

    return extract_code(response_text)


async def fix_cadquery_code(
    original_prompt: str, code: str, error: str, target_units: str = "mm"
) -> str:
    """Fix broken CadQuery code using structured error diagnostics."""
    classified = classify_error(error)

    user_msg_1 = f"Create a CadQuery model: {original_prompt}"
    assistant_msg = f"```python\n{code}\n```"
    fix_msg = (
        f"The code above failed:\n\n{classified}\n\n"
        "Fix the code following these rules:\n"
        "- If a fillet failed, reduce the radius or remove it (try/except)\n"
        "- If a selector failed, check that the face/edge exists after prior operations\n"
        "- If a boolean failed, try adding tol=0.01 or offset shapes by 0.01mm\n"
        "- If validation failed, fix the specific issue mentioned\n"
        "- Keep ALL dimensions as named variables\n"
        "- Do NOT include any export line\n"
        "Return ONLY the corrected Python code block."
    )

    if CAD_PROVIDER == "anthropic":
        logger.info(f"Using Anthropic ({ANTHROPIC_MODEL}) for code fix")
        response_text = await asyncio.to_thread(
            _anthropic_generate,
            [
                {"role": "user", "content": user_msg_1},
                {"role": "assistant", "content": assistant_msg},
                {"role": "user", "content": fix_msg},
            ],
        )
    else:
        logger.info(f"Using Ollama ({OLLAMA_MODEL}) for code fix")
        response_text = await asyncio.to_thread(
            _ollama_generate,
            [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_msg_1},
                {"role": "assistant", "content": assistant_msg},
                {"role": "user", "content": fix_msg},
            ],
        )

    return extract_code(response_text)


def build_geometry_context(metadata: dict) -> str:
    """Build tiered spatial context string for refinement prompts."""
    from collections import Counter
    sections = []

    # Tier 1: Feature tags (always included — compact, semantic)
    features = metadata.get("features", [])
    if features:
        lines = [
            f"  - {f['tag']} ({f['type']}): position {f['position']}, dims {f.get('dimensions', {})}"
            for f in features
        ]
        sections.append("Tagged features:\n" + "\n".join(lines))

    # Tier 2: Face/edge summary by type (always included)
    faces = metadata.get("faces", [])
    edges = metadata.get("edges", [])
    if faces:
        face_types = Counter(f["type"] for f in faces)
        summary = ", ".join(f"{count} {ftype}" for ftype, count in face_types.items())
        sections.append(f"Face summary ({len(faces)} total): {summary}")
    if edges:
        edge_types = Counter(e["type"] for e in edges)
        summary = ", ".join(f"{count} {etype}" for etype, count in edge_types.items())
        sections.append(f"Edge summary ({len(edges)} total): {summary}")

    # Tier 3: Full inventory when geometry is simple enough
    if 0 < len(faces) < 50:
        face_lines = [
            f"  {f['id']}: {f['type']} at ({f['center'][0]}, {f['center'][1]}, {f['center'][2]})"
            f" area={f['area']}mm\u00b2"
            + (f" normal=({f['normal'][0]}, {f['normal'][1]}, {f['normal'][2]})" if "normal" in f else "")
            for f in faces
        ]
        sections.append("All faces:\n" + "\n".join(face_lines))
    if 0 < len(edges) < 80:
        edge_lines = [
            f"  {e['id']}: {e['type']} at ({e['center'][0]}, {e['center'][1]}, {e['center'][2]})"
            f" length={e['length']}mm"
            for e in edges
        ]
        sections.append("All edges:\n" + "\n".join(edge_lines))

    if not sections:
        return ""

    return (
        "\n\nGeometry context for the current model:\n"
        + "\n\n".join(sections)
        + "\n\nTo chamfer a specific hole, replace the .hole() call with .cskHole() in the code — "
        "this is the most reliable approach. For other edge modifications, use chained selectors: "
        ".faces(direction).edges('%Circle').edges(NearestToPointSelector((x,y,z))).chamfer(size). "
        "Do NOT use .tag() names as CadQuery edge/face selectors — tags save workplane state only. "
        "If the instruction is ambiguous (e.g. 'chamfer the hole' when multiple holes exist), "
        "respond with ONLY: CLARIFICATION: <list the available features and ask which one>. "
        "Do NOT guess."
    )


async def refine_cadquery_code(
    original_prompt: str, script: str, instruction: str,
    geometry_metadata: dict | None = None,
) -> str:
    """Refine existing CadQuery code with a user instruction and geometry context."""
    user_msg_1 = f"Create a CadQuery model: {original_prompt}"
    assistant_msg = f"```python\n{script}\n```"

    geometry_context = build_geometry_context(geometry_metadata) if geometry_metadata else ""

    refine_msg = (
        f"The code above produces a working model.{geometry_context}\n\n"
        f"Modification requested: {instruction}\n\n"
        "Make the MINIMUM code change to implement this. Do NOT modify any other geometry."
    )

    if CAD_PROVIDER == "anthropic":
        logger.info(f"Using Anthropic ({ANTHROPIC_MODEL}) for refinement")
        response_text = await asyncio.to_thread(
            _anthropic_generate,
            [
                {"role": "user", "content": user_msg_1},
                {"role": "assistant", "content": assistant_msg},
                {"role": "user", "content": refine_msg},
            ],
            REFINEMENT_SYSTEM_PROMPT,
        )
    else:
        logger.info(f"Using Ollama ({OLLAMA_MODEL}) for refinement")
        response_text = await asyncio.to_thread(
            _ollama_generate,
            [
                {"role": "system", "content": REFINEMENT_SYSTEM_PROMPT},
                {"role": "user", "content": user_msg_1},
                {"role": "assistant", "content": assistant_msg},
                {"role": "user", "content": refine_msg},
            ],
        )

    return extract_code(response_text)

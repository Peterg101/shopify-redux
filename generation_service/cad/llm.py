"""LLM integration for CadQuery code generation.

Supports two backends via CAD_PROVIDER env var:
  - "ollama" (default) -- local Ollama via OpenAI-compatible API
  - "anthropic" -- Claude API (requires ANTHROPIC_API_KEY)
"""
import asyncio
import json as _json_mod
import os
import pathlib
import re
import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Few-shot example library
# ---------------------------------------------------------------------------

_EXAMPLES_DIR = pathlib.Path(__file__).parent / "examples"
_EXAMPLE_CACHE: list[dict] | None = None
_VERIFIED_CACHE: list[dict] | None = None
_VERIFIED_CACHE_TIME: float = 0
_VERIFIED_CACHE_TTL: float = 300  # 5 minutes
_embedding_model_cache = None  # cached SentenceTransformer (loaded once, ~2-3s)


def _load_examples() -> list[dict]:
    global _EXAMPLE_CACHE
    if _EXAMPLE_CACHE is not None:
        return _EXAMPLE_CACHE
    examples = []
    if _EXAMPLES_DIR.is_dir():
        for path in sorted(_EXAMPLES_DIR.glob("*.json")):
            if path.stem == "cadquery_api":
                continue
            try:
                data = _json_mod.loads(path.read_text())
                if isinstance(data, list):
                    for ex in data:
                        ex["_category"] = path.stem
                        ex["_source"] = "curated"
                    examples.extend(data)
            except Exception as e:
                logger.warning(f"Failed to load examples from {path}: {e}")
    _EXAMPLE_CACHE = examples
    logger.info(f"Loaded {len(examples)} curated examples from {_EXAMPLES_DIR}")
    return examples


def _load_verified_examples() -> list[dict]:
    """Load user-verified examples from api_service (cached 5 minutes)."""
    import time
    global _VERIFIED_CACHE, _VERIFIED_CACHE_TIME
    now = time.time()
    if _VERIFIED_CACHE is not None and (now - _VERIFIED_CACHE_TIME) < _VERIFIED_CACHE_TTL:
        return _VERIFIED_CACHE

    try:
        import httpx
        from jwt_auth import generate_token
        api_url = os.getenv("API_SERVICE_URL", "http://api_service:8000")
        token = generate_token("generation_service", audience="api_service")
        resp = httpx.get(
            f"{api_url}/verified_examples",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5,
        )
        if resp.status_code == 200:
            raw = resp.json().get("examples", [])
            verified = []
            for ex in raw:
                entry = {
                    "description": ex.get("description", ""),
                    "_source": "verified",
                    "_category": ex.get("category", "general"),
                    "_upvotes": ex.get("upvotes", 1),
                }
                if ex.get("keywords"):
                    try:
                        entry["keywords"] = _json_mod.loads(ex["keywords"])
                    except (ValueError, TypeError):
                        entry["keywords"] = []
                if ex.get("parameters"):
                    try:
                        entry["parameters"] = _json_mod.loads(ex["parameters"])
                    except (ValueError, TypeError):
                        pass
                if ex.get("steps"):
                    try:
                        entry["steps"] = _json_mod.loads(ex["steps"])
                    except (ValueError, TypeError):
                        pass
                if ex.get("cadquery_script"):
                    entry["cadquery_script"] = ex["cadquery_script"]
                if ex.get("embedding_json"):
                    entry["_embedding_json"] = ex["embedding_json"]
                verified.append(entry)
            _VERIFIED_CACHE = verified
            _VERIFIED_CACHE_TIME = now
            logger.info(f"Loaded {len(verified)} verified examples from api_service")
            return verified
    except Exception as e:
        logger.warning(f"Failed to load verified examples: {e}")

    return _VERIFIED_CACHE or []


def _load_all_examples() -> list[dict]:
    """Merge curated + verified examples."""
    return _load_examples() + _load_verified_examples()


_API_SNIPPETS_CACHE: list[dict] | None = None


def _load_api_snippets() -> list[dict]:
    global _API_SNIPPETS_CACHE
    if _API_SNIPPETS_CACHE is not None:
        return _API_SNIPPETS_CACHE
    path = _EXAMPLES_DIR / "cadquery_api.json"
    if path.is_file():
        try:
            _API_SNIPPETS_CACHE = _json_mod.loads(path.read_text())
        except Exception:
            _API_SNIPPETS_CACHE = []
    else:
        _API_SNIPPETS_CACHE = []
    return _API_SNIPPETS_CACHE


def _select_api_snippets(error_text: str, max_snippets: int = 2) -> str:
    """Select relevant CadQuery API snippets based on an error message."""
    snippets = _load_api_snippets()
    if not snippets:
        return ""

    error_lower = error_text.lower()
    scored = []
    for s in snippets:
        score = sum(1 for kw in s.get("keywords", []) if kw in error_lower)
        scored.append((score, s))
    scored.sort(key=lambda x: x[0], reverse=True)

    relevant = [s for score, s in scored[:max_snippets] if score > 0]
    if not relevant:
        return ""

    parts = ["\n## RELEVANT CADQUERY API REFERENCE:"]
    for s in relevant:
        parts.append(f"\n### {s['operation']}")
        parts.append(s["snippet"])
        if s.get("notes"):
            parts.append(f"Note: {s['notes']}")
    return "\n".join(parts)


def _parse_error_structured(error: str) -> str:
    """Parse a raw CadQuery/OCCT error into a structured diagnostic."""
    error_lower = error.lower()

    if "brep_api" in error_lower or "command not done" in error_lower:
        return f"FILLET/CHAMFER FAILURE: Edge radius too large for geometry.\nRaw: {error[:200]}\nFix: Reduce radius to < 40% of smallest edge, or remove the fillet entirely."
    if "stdfail_notdone" in error_lower:
        if "loft" in error_lower:
            return f"LOFT FAILURE: Cross-sections incompatible.\nRaw: {error[:200]}\nFix: Ensure all sections have the same type (all circles or all rects). Try ruled=True."
        if "sweep" in error_lower:
            return f"SWEEP FAILURE: Path too complex.\nRaw: {error[:200]}\nFix: Simplify path — use a single arc instead of multiple segments."
        return f"GEOMETRY OPERATION FAILED.\nRaw: {error[:200]}\nFix: Reduce complexity, check that shell thickness < half smallest dimension."
    if "standard_nullobject" in error_lower or "shapes is empty" in error_lower:
        return f"SELECTOR FOUND NOTHING: A .faces() or .edges() call matched no geometry.\nRaw: {error[:200]}\nFix: After boolean operations, face/edge topology changes. Use different selectors."
    if "wire is not closed" in error_lower:
        return f"SKETCH NOT CLOSED: Polyline/arc segments don't form a closed loop.\nRaw: {error[:200]}\nFix: Ensure .close() is called, or verify endpoints connect."
    if "validation_failed" in error_lower:
        return f"VALIDATION FAILURE: {error[:300]}"
    if "timeout" in error_lower:
        return f"TIMEOUT: Script took too long.\nFix: Simplify geometry — fewer booleans, simpler shapes."
    if "name 'result' is not defined" in error_lower:
        return f"MISSING RESULT: The script must assign the final solid to a variable called `result`."

    return f"ERROR: {error[:300]}"


def _select_examples(prompt_text: str, max_examples: int = 3, prefer_json_ops: bool = False) -> list[dict]:
    """Select the most relevant few-shot examples.

    Tries embedding-based cosine similarity first (sentence-transformers).
    Falls back to BM25 keyword ranking if embeddings are unavailable.

    Merges curated + user-verified examples. Curated get a boost to ensure
    quality floor. Verified examples are weighted by upvote count.

    When prefer_json_ops=True (structured path), examples with parameters+steps
    get a boost over code-only examples.
    """
    examples = _load_all_examples()
    if not examples:
        return []

    # --- Attempt 1: Embedding-based retrieval ---
    scored_by_embedding = _select_examples_by_embedding(
        prompt_text, examples, max_examples, prefer_json_ops
    )
    if scored_by_embedding is not None:
        return scored_by_embedding

    # --- Attempt 2: BM25 fallback ---
    return _select_examples_by_bm25(prompt_text, examples, max_examples, prefer_json_ops)


def _select_examples_by_embedding(
    prompt_text: str,
    examples: list[dict],
    max_examples: int,
    prefer_json_ops: bool,
) -> list[dict] | None:
    """Rank examples by cosine similarity to prompt embedding.

    Returns None if sentence-transformers is not available or no examples
    have embeddings, signalling the caller to fall back to BM25.
    """
    import math

    try:
        import numpy as np
        from sklearn.feature_extraction.text import HashingVectorizer
    except ImportError:
        return None

    # Check whether any example has an embedding — if not, skip
    has_any_embedding = any(ex.get("_embedding_json") for ex in examples)
    if not has_any_embedding:
        return None

    global _embedding_model_cache
    if _embedding_model_cache is None:
        _embedding_model_cache = HashingVectorizer(
            n_features=384, alternate_sign=False, norm='l2', ngram_range=(1, 2),
        )
    import re
    tokenized = ' '.join(t for t in re.split(r'[^a-z0-9]+', prompt_text.lower()) if len(t) > 1)
    prompt_vec = _embedding_model_cache.transform([tokenized]).toarray()[0]

    scored = []
    for ex in examples:
        emb_json = ex.get("_embedding_json")
        if emb_json:
            ex_vec = np.array(_json_mod.loads(emb_json))
            # Both vectors are L2-normalised so dot product == cosine similarity
            sim = float(np.dot(prompt_vec, ex_vec))
        else:
            # No embedding — lightweight keyword overlap as a fallback score
            desc = ex.get("description", "").lower()
            overlap = sum(1 for w in prompt_text.lower().split() if w in desc)
            sim = overlap * 0.1

        # Source weighting
        if ex.get("_source") == "curated":
            sim *= 2.0
        else:
            upvotes = ex.get("_upvotes", 1)
            sim *= (1 + math.log(max(upvotes, 1)))

        # Structured-path boosting
        if prefer_json_ops:
            has_ops = bool(ex.get("parameters") and ex.get("steps"))
            if has_ops:
                sim *= 3.0
            elif ex.get("cadquery_script") and not has_ops:
                sim *= 0.3

        scored.append((sim, ex))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [ex for _, ex in scored[:max_examples]]


def _select_examples_by_bm25(
    prompt_text: str,
    examples: list[dict],
    max_examples: int,
    prefer_json_ops: bool,
) -> list[dict]:
    """Rank examples using BM25 keyword matching (original approach)."""
    import math

    corpus = []
    for ex in examples:
        tokens = list(ex.get("keywords", []))
        if ex.get("description"):
            tokens.extend(ex["description"].lower().split())
        corpus.append(tokens)

    query = prompt_text.lower().split()

    try:
        from rank_bm25 import BM25Okapi
        bm25 = BM25Okapi(corpus)
        raw_scores = bm25.get_scores(query)

        weighted = []
        for i, score in enumerate(raw_scores):
            if score <= 0:
                continue
            ex = examples[i]
            if ex.get("_source") == "curated":
                weight = score * 2.0
            else:
                upvotes = ex.get("_upvotes", 1)
                weight = score * (1 + math.log(max(upvotes, 1)))
            if prefer_json_ops:
                has_ops = bool(ex.get("parameters") and ex.get("steps"))
                if has_ops:
                    weight *= 3.0
                elif ex.get("cadquery_script") and not has_ops:
                    weight *= 0.3
            weighted.append((weight, ex))

        weighted.sort(key=lambda x: x[0], reverse=True)
        return [ex for _, ex in weighted[:max_examples]]
    except ImportError:
        prompt_lower = prompt_text.lower()
        scored = []
        for ex in examples:
            score = sum(1 for kw in ex.get("keywords", []) if kw.lower() in prompt_lower)
            scored.append((score, ex))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [ex for score, ex in scored[:max_examples] if score > 0]


def _format_examples_for_prompt(examples: list[dict]) -> str:
    """Format selected examples as text to include in the generation prompt."""
    if not examples:
        return ""
    parts = ["REFERENCE EXAMPLES (verified working parts — use similar patterns):\n"]
    for i, ex in enumerate(examples, 1):
        parts.append(f"Example {i}: {ex.get('description', 'Part')}")
        if ex.get("parameters") and ex.get("steps"):
            # JSON ops example (structured path)
            parts.append(f"```json\n{_json_mod.dumps({'parameters': ex['parameters'], 'steps': ex['steps']}, indent=2)}\n```\n")
        elif ex.get("cadquery_script"):
            # Direct CadQuery code example
            parts.append(f"```python\n{ex['cadquery_script']}\n```\n")
        else:
            # Description only
            parts.append("")
    return "\n".join(parts)

CAD_PROVIDER = os.getenv("CAD_PROVIDER", "ollama").lower()

# ---------------------------------------------------------------------------
# Structured output schema for JSON operations (Claude structured outputs)
# ---------------------------------------------------------------------------

CAD_OPS_SCHEMA = {
    "name": "cad_operations",
    "strict": True,
    "schema": {
        "type": "object",
        "required": ["parameters", "steps"],
        "additionalProperties": False,
        "properties": {
            "parameters": {
                "type": "object",
                "description": "Named dimension variables (all in mm)",
                "additionalProperties": {"type": "number"},
            },
            "steps": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["op", "tag"],
                    "properties": {
                        "op": {
                            "type": "string",
                            "enum": [
                                "create_box", "create_cylinder", "create_sphere",
                                "loft", "sweep",
                                "extrude_profile", "cut_blind", "cut_through",
                                "holes", "shell", "fillet", "chamfer",
                                "union", "revolve", "mirror", "pattern",
                                "intersect", "split",
                            ],
                        },
                        "tag": {"type": "string"},
                        "depends_on": {"type": "array", "items": {"type": "string"}},
                    },
                    "additionalProperties": True,
                },
            },
        },
    },
}

# Ollama settings
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:7b")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/v1")

# Anthropic settings
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("CAD_MODEL", "claude-opus-4-20250514")

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

If reference images (sketches, photos) are provided, use them to understand topology
and relative positions of features. Derive ALL dimensions from the text specification,
not from image pixel measurements. Sketches show approximate layout, not exact geometry.

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
Use a `_step` counter to number operations sequentially, and declare `depends_on` to list
which prior features each operation requires (for the feature tree).

```python
_features = []
_step = 0

# Step 1: Main body (depends_on is empty — this is the base)
_step += 1
result = cq.Workplane("XY").box(length, width, height).tag("main_body")
_features.append({
    "tag": "main_body", "type": "box", "step": _step,
    "position": [0, 0, height/2],
    "dimensions": {"length": length, "width": width, "height": height},
    "depends_on": [],
})

# Step 2: Hole (depends on main_body)
_step += 1
result = result.faces(">Z").workplane().hole(hole_diameter).tag("mounting_hole_top_left")
_features.append({
    "tag": "mounting_hole_top_left", "type": "hole", "step": _step,
    "position": [x_pos, y_pos, height],
    "dimensions": {"diameter": hole_diameter},
    "depends_on": ["main_body"],
})

# Step 3: Fillet (depends on main_body — wrapped in try/except)
_step += 1
try:
    result = result.edges("|Z").fillet(fillet_radius).tag("body_edge_fillets")
    _features.append({
        "tag": "body_edge_fillets", "type": "fillet", "step": _step,
        "position": [0, 0, height/2],
        "dimensions": {"radius": fillet_radius},
        "depends_on": ["main_body"],
    })
except Exception as _e:
    _features.append({
        "tag": "body_edge_fillets", "type": "fillet_failed", "step": _step,
        "position": [0, 0, height/2],
        "dimensions": {"radius": fillet_radius},
        "depends_on": ["main_body"],
        "error": str(_e),
    })
```

Dependency rules for `depends_on`:
- The base body (step 1) has `depends_on: []`
- Holes/pockets depend on the body or face they're cut into
- Chamfers/countersinks depend on the hole they modify
- Fillets depend on the body whose edges they round
- Shell operations depend on the body
- Features added AFTER a shell depend on the shell

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
5. Use the dimensions specified by the user. Do NOT invent default sizes.
6. Fillets/chamfers ALWAYS in try/except, applied LAST.
7. After booleans (.cut, .union), call `.clean()` before fillets.
8. Shell with NEGATIVE thickness: `.shell(-thickness)`.
9. The final shape variable MUST be named `result`.
10. Do NOT include any export/save/write line — the system handles this.
11. Do NOT include print() or export/save lines — the system handles all output.
12. ALWAYS define `_features = []` and `_step = 0` after parameters. Increment _step and append to _features for every operation. Include `step` and `depends_on` fields.

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

## CADQUERY WORKPLANE COORDINATE SYSTEM (critical)

For a box created with `cq.Workplane("XY").box(L, W, H)`, the box is centered at origin:
X: [-L/2, L/2], Y: [-W/2, W/2], Z: [0, H]

When you select a face and create a workplane, the LOCAL axes depend on the face:

| Face Selector | Which wall | Local X direction | Local Y direction |
|---|---|---|---|
| faces(">Z") | Top | +global X | +global Y |
| faces("<Z") | Bottom | -global X | +global Y |
| faces(">Y") | Front | +global Z | +global X |
| faces("<Y") | Rear | -global Z | +global X |
| faces(">X") | Right | +global Z | -global Y |
| faces("<X") | Left | -global Z | -global Y |

CRITICAL: On side walls, local X is VERTICAL (along Z), local Y is HORIZONTAL.
The workplane origin is at the CENTER of the face. All moveTo() coordinates are offsets from center.
Always use `.workplane(centerOption="CenterOfMass")` on face selections.

## COMMON PATTERNS

### Enclosure with mounting bosses:
1. Build solid box, shell with negative thickness (open top = shell excluding top face)
2. Create mounting bosses as cylinders on the BOTTOM INTERIOR:
   boss = cq.Workplane("XY").workplane(offset=wall_thickness).moveTo(x, y).circle(r).extrude(boss_height)
   result = result.union(boss)
3. Add mounting holes into the bosses
4. Cut wall features (ports, vents) with .cutBlind(-wall_thickness) NOT .cutThruAll()

### Wall cutouts on shelled bodies:
ALWAYS use .cutBlind(-wall_thickness) for cutouts on walls.
.cutThruAll() will pierce BOTH opposite walls — this is almost never what you want.

### Interior shelves/ledges along a wall:
For a shelf running along the LEFT and RIGHT inner walls at height shelf_z:
  shelf_left = cq.Workplane("XY").box(shelf_depth, width - 2*wall_thickness, shelf_thickness).translate((-length/2 + wall_thickness + shelf_depth/2, 0, shelf_z))
  shelf_right = cq.Workplane("XY").box(shelf_depth, width - 2*wall_thickness, shelf_thickness).translate((length/2 - wall_thickness - shelf_depth/2, 0, shelf_z))
  result = result.union(shelf_left).union(shelf_right)

For a shelf along the REAR inner wall at height shelf_z:
  shelf = cq.Workplane("XY").box(length - 2*wall_thickness, shelf_depth, shelf_thickness).translate((0, -width/2 + wall_thickness + shelf_depth/2, shelf_z))
  result = result.union(shelf)

Key: position with .translate() using GLOBAL coordinates. Inner walls are at ±(dimension/2 - wall_thickness).

### L-bracket:
Union of two boxes at 90 degrees, fillet at junction (in try/except).

### Cylinder with bolt pattern:
Build cylinder, use for loop with .pushPoints() for hole circle.

## FORBIDDEN
- No imports except: cadquery (as cq), math, os
- No file I/O, no export lines (system handles export)
- No subprocess, socket, network calls
- No eval, exec, __import__, open
- No print() statements (system handles all output)

## OUTPUT
Return ONLY a Python code block. No explanation before or after."""


REFINEMENT_SYSTEM_PROMPT = """You are a CadQuery code editor. You receive working CadQuery code and a modification instruction. Your job is to make the MINIMUM change to implement the instruction.

## ABSOLUTE RULES
1. ONLY change what the instruction asks for. Do not "improve" or "clean up" other code.
2. Do NOT add chamfers, fillets, edge treatments, or ANY features that were not explicitly requested.
3. Do NOT modify, move, resize, or reshape ANY geometry that was not mentioned in the instruction.
4. Do NOT change parameter values (lengths, widths, heights, offsets) unless the instruction asks you to.
5. Keep all existing variables, structure, and _features list entries intact.
6. The final variable MUST be named `result`. Do NOT include export lines or print statements.
7. For wall cutouts on shelled bodies, use .cutBlind(-wall_thickness), NOT .cutThruAll().

## CADQUERY WORKPLANE COORDINATE SYSTEM (critical — read carefully)

For a box created with `cq.Workplane("XY").box(L, W, H)`, the box is centered at origin:
X: [-L/2, L/2], Y: [-W/2, W/2], Z: [0, H]

When you select a face and create a workplane, the LOCAL axes depend on the face:

| Face Selector | Which wall | Workplane origin (global) | Local X direction | Local Y direction |
|---|---|---|---|---|
| faces(">Z") | Top | (0, 0, H) | +global X | +global Y |
| faces("<Z") | Bottom | (0, 0, 0) | -global X | +global Y |
| faces(">Y") | Front (+Y) | (0, +W/2, H/2) | +global Z | +global X |
| faces("<Y") | Rear (-Y) | (0, -W/2, H/2) | -global Z | +global X |
| faces(">X") | Right (+X) | (+L/2, 0, H/2) | +global Z | -global Y |
| faces("<X") | Left (-X) | (-L/2, 0, H/2) | -global Z | -global Y |

CRITICAL: On side walls, local X is VERTICAL (along Z), local Y is HORIZONTAL.
The workplane origin is at the CENTER of the face. All moveTo() coordinates are offsets from this center.

Always use `.workplane(centerOption="CenterOfMass")` to ensure the origin is at the face center.

## POSITION CALCULATION FORMULAS

To convert user positions ("Nmm from bottom", "centered") to workplane local coordinates:

For side walls (faces ">Y", "<Y", ">X", "<X"):
  - Local X is VERTICAL. Workplane origin is at face center (height H/2 from bottom).
  - "N mm from bottom edge": globalZ = N + feature_height/2
  - For faces(">Y") or faces(">X"): localX = globalZ - H/2
  - For faces("<Y") or faces("<X"): localX = -(globalZ - H/2) = H/2 - globalZ
  - "N mm from top edge": globalZ = H - N - feature_height/2, then convert as above
  - "Centered horizontally": localY = 0
  - "Spaced D apart, centered": localY positions at -D/2, +D/2 (for 2 items)

For top/bottom faces (">Z", "<Z"):
  - Local X = global X direction, local Y = global Y direction (intuitive)
  - "N mm from edge": inset by N from the face boundary

Always use .workplane(centerOption="CenterOfMass") on face selections.

IMPORTANT: Use the ACTUAL variable names from the existing script for dimensions.
Do NOT introduce new variable names like "usb_local_x" — use the existing parameter names.
Define new parameters at the top of the PARAMETERS section with descriptive names.

## OPERATIONS REFERENCE

Wall cutouts (ports, slots, vents on side walls of a shelled body):
  ALWAYS use .cutBlind(-wall_thickness) — NOT .cutThruAll()!
  .cutThruAll() pierces BOTH walls. .cutBlind(-wall_thickness) pierces only the selected wall.
  Example: result.faces("<Y").workplane(centerOption="CenterOfMass").moveTo(lx, ly).rect(h, w).cutBlind(-wall_thickness)

Holes on flat surfaces (top, bottom):
  result.faces(">Z").workplane(centerOption="CenterOfMass").pushPoints([(lx, ly)]).hole(d)

Mounting bosses inside a shelled enclosure:
  Create as a cylinder on the BOTTOM INTERIOR surface, NOT floating.
  boss = cq.Workplane("XY").workplane(offset=wall_thickness).moveTo(x, y).circle(boss_d/2).extrude(boss_height)
  result = result.union(boss)
  Then add the mounting hole: result = result.faces(">Z").workplane().pushPoints([(x, y)]).hole(hole_d, boss_height)

Rounded slot: .faces(sel).workplane(centerOption="CenterOfMass").moveTo(lx, ly).slot2D(length, width, angle).cutBlind(-wall_thickness)
Groove on a surface: .faces(sel).workplane(centerOption="CenterOfMass").moveTo(lx, ly).rect(w, h).cutBlind(-depth)
Shelf/ledge along a wall: create as a box, .translate() to GLOBAL position against the inner wall.
  Inner wall positions: ±(dimension/2 - wall_thickness). E.g. rear inner wall Y = -width/2 + wall_thickness + shelf_depth/2
  shelf = cq.Workplane("XY").box(shelf_length, shelf_depth, shelf_thickness).translate((x, y, z))
  result = result.union(shelf)
Chamfer a hole: replace .hole(d) with .cskHole(d, d + 2*C, 90)
Fillet: result.edges(selector).fillet(r) — ALWAYS in try/except

## FEATURE TAGGING
Tag new features with .tag() and append to _features list.
Continue the existing _step counter. Include step and depends_on fields.

## REMINDERS
- Add new dimension variables in the PARAMETERS section
- Use .clean() after booleans, before fillets
- Wrap fillets/chamfers in try/except
- For multiple similar features, use a loop or .pushPoints()
- For shelled bodies, use .cutBlind(-wall_thickness) for wall cutouts — NOT .cutThruAll()

ALWAYS return the COMPLETE Python code block, even if no changes are needed.
If the requested feature already exists, return the code unchanged.
NEVER return explanations, commentary, or prose — ONLY Python code in a ```python block."""


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
    "Standard_ConstructionError": (
        "HINT: Invalid geometry construction. Common causes: "
        "zero-length edge, degenerate face, or overlapping geometry. "
        "Check that all dimensions are > 0 and shapes don't overlap exactly."
    ),
    "No pending wires": (
        "HINT: A workplane operation expected pending wires but found none. "
        "This usually means a sketch operation (.rect(), .circle()) was not called "
        "before an extrude/cut operation."
    ),
    "TopAbs": (
        "HINT: Topology error from a boolean operation (cut/union/intersect). "
        "The shapes may be coincident or barely touching. "
        "Try offsetting one shape by 0.01mm before the boolean."
    ),
    "SyntaxError": (
        "HINT: The generated code has a Python syntax error. "
        "Check for missing parentheses, unmatched brackets, or invalid indentation."
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
    """Extract Python code from LLM response.

    If the response contains a code block, extract it.
    If no code block is found, check if the raw text looks like Python code.
    If the response is prose/explanation, return it as-is (will be caught downstream
    as a CLARIFICATION or syntax error).
    """
    # Try ```python blocks first
    pattern = r"```python\s*\n(.*?)```"
    match = re.search(pattern, response_text, re.DOTALL)
    if match:
        return match.group(1).strip()

    # Try generic ``` blocks
    pattern = r"```\s*\n(.*?)```"
    match = re.search(pattern, response_text, re.DOTALL)
    if match:
        return match.group(1).strip()

    # No code block found — check if it looks like Python code
    stripped = response_text.strip()
    if stripped.startswith("import ") or stripped.startswith("import\n") or stripped.startswith("# "):
        return stripped

    # Looks like prose — prefix with CLARIFICATION so pipeline handles it gracefully
    logger.warning(f"LLM returned prose instead of code ({len(stripped)} chars): {stripped[:100]}")
    return f"CLARIFICATION: {stripped}"


# ---------------------------------------------------------------------------
# Visual verification (CADCodeVerify pattern)
# ---------------------------------------------------------------------------

VERIFICATION_PROMPT = """\
You are a CAD quality inspector. You are given a design specification and \
multi-view renders of the generated model. Evaluate whether the model matches \
the specification.

Check:
1. Does the overall shape match the description?
2. Are all requested features present (holes, slots, cutouts, bosses)?
3. Are proportions approximately correct?
4. Any obvious geometric defects (missing faces, inside-out surfaces)?

Respond with exactly one of:
- PASS — if the model acceptably matches the spec
- FAIL: <specific issues> — if there are problems, list them concisely"""


async def verify_generation(
    spec_text: str,
    view_images_b64: dict[str, str],
) -> tuple[bool, str]:
    """Send rendered views to Claude for visual verification.

    Returns (passed, feedback). If passed is False, feedback contains
    specific issues to address.
    """
    if CAD_PROVIDER != "anthropic" or not ANTHROPIC_API_KEY:
        return True, ""

    import anthropic

    content: list[dict] = [
        {"type": "text", "text": f"Design specification:\n{spec_text}\n\nRendered views of the generated model:"},
    ]
    for view_name, b64_data in view_images_b64.items():
        content.append({"type": "text", "text": f"\n{view_name} view:"})
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/png", "data": b64_data},
        })
    content.append({"type": "text", "text": "\nEvaluate this model against the spec. PASS or FAIL?"})

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model=os.getenv("CAD_VERIFY_MODEL", "claude-sonnet-4-5-20250929"),
            max_tokens=512,
            temperature=0,
            system=VERIFICATION_PROMPT,
            messages=[{"role": "user", "content": content}],
        )
        result = response.content[0].text.strip()
        logger.info(f"Visual verification result: {result[:100]}")

        if result.startswith("PASS"):
            return True, ""
        else:
            feedback = result.replace("FAIL:", "").strip() if result.startswith("FAIL") else result
            return False, feedback
    except Exception as e:
        logger.warning(f"Visual verification failed (non-fatal): {e}")
        return True, ""


# ---------------------------------------------------------------------------
# Ollama backend (OpenAI-compatible API)
# ---------------------------------------------------------------------------


def _ollama_generate(messages: list[dict], client=None) -> str:
    from openai import OpenAI

    client = client or OpenAI(base_url=OLLAMA_URL, api_key="ollama")
    response = client.chat.completions.create(
        model=OLLAMA_MODEL,
        messages=messages,
        temperature=0.2,
    )
    return response.choices[0].message.content


# ---------------------------------------------------------------------------
# Anthropic backend
# ---------------------------------------------------------------------------


def _anthropic_generate(user_messages: list[dict], system_prompt: str | None = None, client=None) -> str:
    import anthropic

    client = client or anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=8192,
        temperature=0,
        system=system_prompt or SYSTEM_PROMPT,
        messages=user_messages,
    )
    return message.content[0].text


# ---------------------------------------------------------------------------
# JSON-based structured CAD generation (new approach)
# ---------------------------------------------------------------------------

JSON_SYSTEM_PROMPT = """\
You are a CAD operation planner. Convert part descriptions into a structured JSON
operation sequence. You do NOT write code. A converter turns your JSON into CadQuery.

Think of yourself as placing 2D shapes onto flat surfaces, then pushing them in or out.

## OUTPUT FORMAT

Return a JSON object with "parameters" (dict of name→value) and "steps" (array of operations).

```json
{
  "parameters": {"length": 100.0, "width": 60.0, "thickness": 5.0},
  "steps": [
    {"op": "create_box", "tag": "plate", "length": "$length", "width": "$width", "height": "$thickness", "depends_on": []},
    {"op": "holes", "tag": "holes", "face": ">Z", "diameter": 4.5, "pattern": "explicit", "positions": [[42, 22], [-42, 22], [-42, -22], [42, -22]], "depends_on": ["plate"]}
  ]
}
```

## PARAMETERS
All dimensions as named parameters. No magic numbers. Values in mm.
Parameters are referenced as "$name" in steps.

## OPERATIONS

| op | what it does | key fields |
|----|-------------|------------|
| create_box | Base rectangular solid | length, width, height |
| create_cylinder | Base cylinder | radius, height |
| create_sphere | Base sphere | radius |
| extrude_profile | Push a 2D shape out from a face | face, profile, depth |
| cut_blind | Cut a shape into a face to a depth | face, profile, depth |
| cut_through | Cut a shape all the way through | face, profile |
| holes | Drill holes (explicit positions) | face, diameter, pattern, positions/points |
| shell | Hollow out, leaving walls | thickness, open_faces |
| fillet | Round edges | radius, edges |
| chamfer | Bevel edges | size, edges |
| union | Merge a sub-body into the result | body: {type, radius/length/width/height, translate} |
| revolve | Spin a 2D profile around an axis | face, profile, axis, angle |
| mirror | Mirror the body across a plane | plane ("XY", "XZ", "YZ") |
| loft | Blend between 2+ cross-sections | sections: [{profile, offset?}], ruled |
| sweep | Extrude profile along a path | profile, path: {type: "arc"/"line", radius, angle} |
| pattern | Repeat geometry in array | type: "linear"/"circular", count, spacing, direction |
| intersect | Boolean intersection with tool body | body: {type, dims}, translate |
| split | Split with a plane, keep one half | plane, keep: "positive"/"negative" |

## FACES (which surface to draw on)
| selector | meaning |
|----------|---------|
| >Z | Top |
| <Z | Bottom |
| >Y | Front |
| <Y | Rear |
| >X | Right |
| <X | Left |

Face origin is at the CENTER. Positions are offsets from center.

## PROFILES (for extrude/cut)
```json
{"type": "rect", "width": 10, "height": 5, "position": [0, 0]}
{"type": "circle", "radius": 3, "position": [5, 0]}
{"type": "slot", "length": 20, "width": 3, "position": [0, 0]}
{"type": "rounded_rect", "width": 10, "height": 5, "corner_radius": 2}
{"type": "polygon", "sides": 6, "radius": 5}
```

## EDGES (for fillet/chamfer)
"|Z" = vertical edges, "|X" = X-parallel edges, "%Circle" = circular edges

## HOLES
Pattern types: "explicit" (positions list), "bolt_circle" (bolt_radius, count), "grid" (rows, cols, spacing)
Omit "depth" for through-holes. Include "depth" for blind holes.

## UNIONS (adding sub-bodies)
For bosses, brackets, flanges — build a sub-body and merge:
```json
{"op": "union", "tag": "boss", "body": {"type": "cylinder", "radius": 3, "height": 10, "translate": [20, 15, 2]}, "depends_on": ["shell"]}
```

## EVERY STEP MUST HAVE
- "op": operation type
- "tag": unique snake_case name
- "depends_on": list of parent tags

## POSITIONING — CONSTRAINT TYPES

Instead of calculating raw coordinates, you can use constraint-based positioning:

### h/v constraints (position relative to face edges/center):
  "position": {"h": "center", "v": {"from": "bottom", "offset": 6}}

### Distribute features evenly along a dimension:
  "position": {"distribute": "evenly", "count": 3, "along": "width", "margin": 10}
  Spaces `count` features equally along the face's width (or height), with `margin` mm from edges.

### Position relative to another feature:
  "position": {"relative_to": "boss_center", "offset": [10, 0]}
  Places this feature offset from a previously defined feature's position. The referenced feature
  must appear earlier in the steps list. If the tag is not found, falls back to center + offset.

## RULES
1. Shell BEFORE cuts and holes (operation ordering is automatic, but list shell early)
2. Fillets LAST
3. Do NOT write Python code — JSON only
4. If a SPECIFIC FEATURE is too complex but the base geometry is simple, use {"op": "placeholder", "tag": "...", "description": "what this feature should do"} — the system will fill it in with direct CadQuery code
5. If the ENTIRE SHAPE is too complex for 2D operations (organic forms, complex curves), return {"unsupported": true, "reason": "..."} — the system will generate direct CadQuery code instead
5. IMAGES (sketches/photos): These are ROUGH references only. Use them to understand the
   general shape and relative feature placement. Do NOT replicate sketch imperfections —
   overlapping lines, uneven edges, and wobbly shapes are drawing artifacts, not design
   intent. A hand-drawn rectangle with slightly overlapping corners is still a rectangle,
   not a pentagon. Always derive dimensions from the text specification, never from pixels.
   Simplify the sketch into clean geometric primitives (boxes, cylinders, holes).

## EXAMPLE: L-bracket with holes

User: "An L-bracket, horizontal leg 80x40x5mm, vertical leg extending up 60mm from the back edge. Two 6mm holes on each leg, 12mm from the ends."

```json
{
  "parameters": {"leg_length": 80.0, "leg_width": 40.0, "thickness": 5.0, "vert_height": 60.0, "hole_dia": 6.0, "hole_inset": 12.0},
  "steps": [
    {"op": "create_box", "tag": "horiz_leg", "length": "$leg_length", "width": "$leg_width", "height": "$thickness", "depends_on": []},
    {"op": "union", "tag": "vert_leg", "body": {"type": "box", "length": "$leg_length", "width": "$thickness", "height": "$vert_height", "translate": [0, -17.5, 30]}, "depends_on": ["horiz_leg"]},
    {"op": "holes", "tag": "horiz_holes", "face": ">Z", "diameter": "$hole_dia", "pattern": "explicit", "positions": [[28, 0], [-28, 0]], "depends_on": ["horiz_leg"]},
    {"op": "holes", "tag": "vert_holes", "face": "<Y", "diameter": "$hole_dia", "pattern": "explicit", "positions": [[0, 18], [0, -18]], "depends_on": ["vert_leg"]},
    {"op": "fillet", "tag": "junction_fillet", "radius": 3.0, "edges": "|X", "depends_on": ["vert_leg"]}
  ]
}
```

## EXAMPLE: Enclosure with bosses and cutouts

User: "A 120x80x40mm enclosure, 2mm walls, open top. Four M3 mounting bosses inside, 8mm from corners, 12mm tall. USB-C cutout (9x3.5mm) centered on rear wall, 6mm from bottom. Three vent slots on left wall."

```json
{
  "parameters": {"length": 120.0, "width": 80.0, "height": 40.0, "wall": 2.0, "boss_dia": 6.0, "boss_h": 12.0, "screw_dia": 3.2, "usb_w": 9.0, "usb_h": 3.5, "usb_z": 6.0, "vent_w": 25.0, "vent_h": 1.5},
  "steps": [
    {"op": "create_box", "tag": "body", "length": "$length", "width": "$width", "height": "$height", "depends_on": []},
    {"op": "shell", "tag": "shell", "thickness": "$wall", "open_faces": [">Z"], "depends_on": ["body"]},
    {"op": "union", "tag": "boss_fl", "body": {"type": "cylinder", "radius": 3.0, "height": "$boss_h", "translate": [-52, 32, 2]}, "depends_on": ["shell"]},
    {"op": "union", "tag": "boss_fr", "body": {"type": "cylinder", "radius": 3.0, "height": "$boss_h", "translate": [52, 32, 2]}, "depends_on": ["shell"]},
    {"op": "union", "tag": "boss_rl", "body": {"type": "cylinder", "radius": 3.0, "height": "$boss_h", "translate": [-52, -32, 2]}, "depends_on": ["shell"]},
    {"op": "union", "tag": "boss_rr", "body": {"type": "cylinder", "radius": 3.0, "height": "$boss_h", "translate": [52, -32, 2]}, "depends_on": ["shell"]},
    {"op": "holes", "tag": "screw_holes", "face": ">Z", "diameter": "$screw_dia", "pattern": "explicit", "positions": [[-52,32],[52,32],[-52,-32],[52,-32]], "depth": "$boss_h", "depends_on": ["boss_fl","boss_fr","boss_rl","boss_rr"]},
    {"op": "cut_blind", "tag": "usb", "face": "<Y", "profile": {"type": "rect", "width": "$usb_w", "height": "$usb_h", "position": [0, -14]}, "depth": "$wall", "depends_on": ["shell"]},
    {"op": "cut_blind", "tag": "vent_1", "face": "<X", "profile": {"type": "slot", "length": "$vent_w", "width": "$vent_h", "position": [0, -5]}, "depth": "$wall", "depends_on": ["shell"]},
    {"op": "cut_blind", "tag": "vent_2", "face": "<X", "profile": {"type": "slot", "length": "$vent_w", "width": "$vent_h", "position": [0, 0]}, "depth": "$wall", "depends_on": ["shell"]},
    {"op": "cut_blind", "tag": "vent_3", "face": "<X", "profile": {"type": "slot", "length": "$vent_w", "width": "$vent_h", "position": [0, 5]}, "depth": "$wall", "depends_on": ["shell"]},
    {"op": "fillet", "tag": "fillets", "radius": 1.5, "edges": "|Z", "depends_on": ["body"]}
  ]
}
```

Return ONLY the JSON object. No explanation."""




async def generate_operations(
    prompt: str | list[dict],
    process: str = "fdm",
    material_hint: str = "plastic",
    approximate_size: dict | None = None,
    features: list[str] | None = None,
    target_units: str = "mm",
) -> dict:
    """Generate structured JSON operations from a prompt.

    Includes few-shot examples selected by BM25 similarity for better accuracy.
    """
    import json as _json

    process_info = PROCESS_CONSTRAINTS.get(process.lower(), PROCESS_CONSTRAINTS["fdm"])

    extra_context = [f"Manufacturing: {process_info}", f"Material: {material_hint}"]
    if approximate_size:
        w = approximate_size.get("width")
        d = approximate_size.get("depth")
        h = approximate_size.get("height")
        if any(v for v in [w, d, h]):
            extra_context.append(f"Approximate size: {w or '?'} x {d or '?'} x {h or '?'} mm")
    if features:
        extra_context.append(f"Requested features: {', '.join(features)}")
    if target_units != "mm":
        extra_context.append(f"Units: {target_units}")

    extra_text = "\n".join(extra_context)

    # Select relevant few-shot examples via BM25
    prompt_text = prompt if isinstance(prompt, str) else " ".join(
        b.get("text", "") for b in prompt if isinstance(b, dict) and b.get("type") == "text"
    )
    examples = _select_examples(prompt_text, prefer_json_ops=True)
    examples_text = _format_examples_for_prompt(examples)
    if examples:
        logger.info(f"Selected {len(examples)} few-shot examples: {[e.get('description', '?') for e in examples]}")

    context_suffix = f"{examples_text}\n{extra_text}" if examples_text else extra_text
    if isinstance(prompt, list):
        user_content = list(prompt) + [{"type": "text", "text": f"\n\n{context_suffix}"}]
    else:
        user_content = f"{prompt}\n\n{context_suffix}"

    if CAD_PROVIDER == "anthropic":
        logger.info(f"Using Anthropic ({ANTHROPIC_MODEL}) for JSON operation generation")
        response_text = await asyncio.to_thread(
            _anthropic_generate,
            [{"role": "user", "content": user_content}],
            JSON_SYSTEM_PROMPT,
        )
    else:
        logger.info(f"Using Ollama ({OLLAMA_MODEL}) for JSON operation generation")
        response_text = await asyncio.to_thread(
            _ollama_generate,
            [
                {"role": "system", "content": JSON_SYSTEM_PROMPT},
                {"role": "user", "content": user_content if isinstance(user_content, str) else "\n\n".join(b["text"] for b in user_content if b.get("type") == "text")},
            ],
        )

    return _extract_json(response_text)


def _extract_json(text: str) -> dict:
    """Extract a JSON object from LLM response text."""
    import json as _json

    # Try to find JSON in code fences
    json_match = re.search(r'```(?:json)?\s*\n(.*?)```', text, re.DOTALL)
    if json_match:
        try:
            return _json.loads(json_match.group(1))
        except _json.JSONDecodeError:
            pass

    # Try to parse the whole response as JSON
    try:
        return _json.loads(text.strip())
    except _json.JSONDecodeError:
        pass

    # Try to find a JSON object using json.JSONDecoder (handles braces in strings correctly)
    decoder = _json.JSONDecoder()
    brace_start = text.find('{')
    if brace_start != -1:
        try:
            obj, _ = decoder.raw_decode(text, brace_start)
            if isinstance(obj, dict):
                return obj
        except _json.JSONDecodeError:
            pass

    logger.error(f"Could not extract JSON from response: {text[:200]}")
    return {"parameters": {}, "steps": [], "error": "Failed to parse JSON from LLM response"}


async def fix_operations(
    original_prompt: str | list[dict],
    operations: dict,
    error: str,
    attempt: int = 1,
    max_attempts: int = 3,
    process: str = "fdm",
) -> dict:
    """Fix a broken JSON operation sequence based on validation or execution errors."""
    import json as _json

    ops_json = _json.dumps(operations, indent=2)

    escalation = ""
    if attempt >= 2:
        escalation = (
            f"\nThis is fix attempt {attempt} of {max_attempts}. Previous fixes failed.\n"
            "Be more aggressive: simplify geometry, remove fillets, reduce dimensions.\n"
        )

    fix_content = (
        f"The JSON operations below produced an error:\n\n"
        f"```json\n{ops_json}\n```\n\n"
        f"Error: {error}\n\n"
        f"{escalation}"
        f"Fix the JSON and return the corrected version. Return ONLY the JSON object."
    )

    messages = [
        {"role": "user", "content": original_prompt},
        {"role": "assistant", "content": f"```json\n{ops_json}\n```"},
        {"role": "user", "content": fix_content},
    ]

    if CAD_PROVIDER == "anthropic":
        logger.info(f"Using Anthropic ({ANTHROPIC_MODEL}) for JSON fix (attempt {attempt})")
        response_text = await asyncio.to_thread(
            _anthropic_generate, messages, JSON_SYSTEM_PROMPT,
        )
    else:
        response_text = await asyncio.to_thread(
            _ollama_generate,
            [{"role": "system", "content": JSON_SYSTEM_PROMPT}] + messages,
        )

    return _extract_json(response_text)


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


PLANNING_PROMPT = """You are a CAD build planner. Given a design specification, output a step-by-step
build plan as a JSON array. Each step describes ONE CadQuery operation.

Rules:
- Start with the base shape (box, cylinder, etc.)
- Shell BEFORE cutting holes/features
- Cut features AFTER shelling
- Apply fillets LAST (wrap in try/except)
- Order: base geometry → shell → boolean ops (union/cut) → fillets/chamfers

Output ONLY a JSON array, no explanation:
```json
[
  {"step": 1, "operation": "box", "description": "Base plate 100x60x5mm"},
  {"step": 2, "operation": "hole", "description": "4x M4 clearance holes (4.5mm) at corners, 8mm inset"},
  {"step": 3, "operation": "cutout", "description": "40x20mm rectangular cutout centered on top face"},
  {"step": 4, "operation": "fillet", "description": "2mm fillets on all external edges (try/except)"}
]
```"""


async def plan_cadquery_build(prompt: str, process: str = "fdm") -> str:
    """Generate a JSON build plan before code generation (chain-of-thought)."""
    user_content = f"Design specification:\n\n{prompt}\n\nTarget process: {process.upper()}"

    if CAD_PROVIDER == "anthropic":
        response_text = await asyncio.to_thread(
            _anthropic_generate,
            [{"role": "user", "content": user_content}],
            PLANNING_PROMPT,
        )
    else:
        response_text = await asyncio.to_thread(
            _ollama_generate,
            [
                {"role": "system", "content": PLANNING_PROMPT},
                {"role": "user", "content": user_content},
            ],
        )

    return response_text


SCAFFOLD_PROMPT = """\
You are given a partially-generated CadQuery script. The simple geometry (boxes,
cylinders, holes, etc.) is already written correctly. Your job is to fill in the
PLACEHOLDER sections with working CadQuery code.

Rules:
- Only modify lines marked with "# PLACEHOLDER" or "# TODO"
- Do NOT change existing working code
- Keep all parameter variables and _features list intact
- The variable `result` holds the current solid — modify it in place
- Wrap complex operations (loft, sweep, fillet) in try/except
- Return the COMPLETE script (all original code + your additions)"""


async def fill_scaffold_placeholders(
    scaffold_code: str,
    prompt: str,
    process: str = "fdm",
) -> str:
    """Take converter output with placeholder comments and fill them in with CadQuery code."""
    if "# PLACEHOLDER" not in scaffold_code and "# TODO:" not in scaffold_code:
        return scaffold_code

    process_info = PROCESS_CONSTRAINTS.get(process.lower(), PROCESS_CONSTRAINTS["fdm"])

    user_content = (
        f"Original design request:\n{prompt}\n\n"
        f"Manufacturing: {process_info}\n\n"
        f"Here is the partially-generated CadQuery script. Fill in the PLACEHOLDER sections:\n\n"
        f"```python\n{scaffold_code}\n```"
    )

    if CAD_PROVIDER == "anthropic":
        response_text = await asyncio.to_thread(
            _anthropic_generate,
            [{"role": "user", "content": user_content}],
            SCAFFOLD_PROMPT,
        )
    else:
        response_text = await asyncio.to_thread(
            _ollama_generate,
            [
                {"role": "system", "content": SCAFFOLD_PROMPT},
                {"role": "user", "content": user_content},
            ],
        )

    return extract_code(response_text)


async def generate_cadquery_code(
    prompt: str | list[dict],
    target_units: str = "mm",
    process: str = "fdm",
    approximate_size: dict | None = None,
    material_hint: str = "plastic",
    features: list[str] | None = None,
) -> str:
    """Generate CadQuery code from a prompt with structured context.

    Args:
        prompt: Either a plain string (one-shot flow) or a list of Claude
                content blocks with text + images (conversation flow).

    Uses a two-step approach: first generates a build plan (chain-of-thought),
    then generates code with the plan as context.
    """
    # For planning, extract text-only version of the prompt
    prompt_text = prompt if isinstance(prompt, str) else "\n".join(
        b["text"] for b in prompt if b.get("type") == "text"
    )

    # Step 1: Generate build plan (chain-of-thought)
    logger.info("Generating build plan (chain-of-thought)...")
    build_plan = await plan_cadquery_build(prompt_text, process)
    logger.info(f"Build plan: {build_plan[:200]}")

    # Build additional text context (process, size, material, features)
    extra_context = []
    extra_context.append(f"## BUILD PLAN (follow this step-by-step):\n{build_plan}")
    extra_context.append(PROCESS_CONSTRAINTS.get(process.lower(), PROCESS_CONSTRAINTS["fdm"]))

    if approximate_size:
        w = approximate_size.get("width")
        d = approximate_size.get("depth")
        h = approximate_size.get("height")
        if any(v for v in [w, d, h]):
            dims = f"{w or '?'} x {d or '?'} x {h or '?'}"
            extra_context.append(f"TARGET SIZE: approximately {dims} mm. Use these as the starting dimensions for the main body.")

    if material_hint and material_hint in MATERIAL_HINTS:
        extra_context.append(MATERIAL_HINTS[material_hint])

    if features:
        feature_notes = [FEATURE_DESCRIPTIONS[f] for f in features if f in FEATURE_DESCRIPTIONS]
        if feature_notes:
            extra_context.append("REQUIRED FEATURES:\n" + "\n".join(f"- {n}" for n in feature_notes))

    if target_units != "mm":
        extra_context.append(f"Use {target_units} as the unit system.")

    # RAG: retrieve relevant CadQuery API snippets for the prompt
    api_snippets = _select_api_snippets(prompt_text)
    if api_snippets:
        extra_context.append(api_snippets)

    extra_text = "\n\n".join(extra_context)

    # Build the user message content — multi-modal if images present
    if isinstance(prompt, list):
        user_content = prompt + [{"type": "text", "text": extra_text}]
    else:
        user_content = f"Create a CadQuery model: {prompt}\n\n{extra_text}"

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
    original_prompt: str | list[dict],
    code: str,
    error: str,
    target_units: str = "mm",
    attempt: int = 1,
    max_attempts: int = 3,
    process: str = "fdm",
    material_hint: str = "plastic",
    build_plan: str = "",
    fix_history: list[tuple[str, str]] | None = None,
) -> str:
    """Fix broken CadQuery code with full context and memory between attempts.

    Args:
        original_prompt: The original generation prompt (str or content blocks with images)
        code: The broken code from the latest attempt
        error: The error message from the latest attempt
        build_plan: The chain-of-thought build plan (if available)
        fix_history: List of (code, error) tuples from previous fix attempts
    """
    classified = _parse_error_structured(error)
    api_context = _select_api_snippets(error + " " + code)
    process_info = PROCESS_CONSTRAINTS.get(process.lower(), PROCESS_CONSTRAINTS["fdm"])

    # Build the first message with full context (may include images)
    if isinstance(original_prompt, list):
        # Content blocks with images — build multi-modal message
        context_blocks = list(original_prompt)
        context_blocks.append({"type": "text", "text": f"\n\n{process_info}"})
        if build_plan:
            context_blocks.append({"type": "text", "text": f"\n## BUILD PLAN:\n{build_plan}"})
        user_msg_1_content = context_blocks
    else:
        text = f"Create a CadQuery model: {original_prompt}\n\n{process_info}"
        if build_plan:
            text += f"\n\n## BUILD PLAN:\n{build_plan}"
        user_msg_1_content = text

    # Build error-type-aware escalation
    escalation = ""
    if attempt >= 2:
        escalation = f"\nIMPORTANT: This is fix attempt {attempt} of {max_attempts}. Previous fixes failed.\n"
        error_lower = error.lower()
        classified_lower = classified.lower()
        if "fillet" in classified_lower or "brep_api" in error_lower or "chamfer" in classified_lower:
            escalation += "- REMOVE all fillets/chamfers entirely (wrap in try/except with pass)\n"
        elif "selector" in classified_lower or "nullobject" in error_lower or "shapes is empty" in error_lower:
            escalation += "- Use NearestToPointSelector instead of string selectors\n"
            escalation += "- After boolean ops, face/edge topology changes — recheck selectors\n"
        elif "timeout" in error_lower:
            escalation += "- SIMPLIFY geometry — fewer boolean operations, simpler shapes\n"
        else:
            escalation += "- SIMPLIFY the code — remove complex features, get basic geometry right first\n"

    fix_msg = (
        f"The code above failed (attempt {attempt}/{max_attempts}):\n\n{classified}\n\n"
        f"{escalation}"
        f"{api_context}\n\n"
        "Fix the code following these rules:\n"
        "- If a fillet failed, wrap in try/except OR remove entirely\n"
        "- If a selector failed, check that the face/edge exists after prior operations\n"
        "- If a boolean failed, try adding tol=0.01 or offset shapes by 0.01mm\n"
        "- If validation failed, fix the specific issue mentioned\n"
        "- Keep ALL dimensions as named variables\n"
        "- Do NOT include any export line\n"
        "Return ONLY the corrected Python code block."
    )

    # Build multi-turn conversation with fix history (memory between attempts)
    messages = [{"role": "user", "content": user_msg_1_content}]

    if fix_history:
        # Include previous attempts so the LLM can see what was already tried
        for prev_code, prev_error in fix_history:
            messages.append({"role": "assistant", "content": f"```python\n{prev_code}\n```"})
            prev_classified = classify_error(prev_error)
            messages.append({"role": "user", "content": f"This failed:\n{prev_classified}\nTry a different approach."})

    # Add the current broken code and error
    messages.append({"role": "assistant", "content": f"```python\n{code}\n```"})
    messages.append({"role": "user", "content": fix_msg})

    if CAD_PROVIDER == "anthropic":
        logger.info(f"Using Anthropic ({ANTHROPIC_MODEL}) for code fix (attempt {attempt})")
        response_text = await asyncio.to_thread(
            _anthropic_generate, messages,
        )
    else:
        logger.info(f"Using Ollama ({OLLAMA_MODEL}) for code fix (attempt {attempt})")
        response_text = await asyncio.to_thread(
            _ollama_generate,
            [{"role": "system", "content": SYSTEM_PROMPT}] + messages,
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


# ---------------------------------------------------------------------------
# Stepwise CAD generation — build plan + per-step code generation
# ---------------------------------------------------------------------------

BUILD_PLAN_SYSTEM = """\
You are a CAD build planner. Given a part description, decompose it into
a sequence of manufacturing steps. Each step should be ONE geometric operation.

Return a JSON array of steps. Each step has:
- step: number (1-based)
- feature: short snake_case name
- description: what this step does (one sentence)
- depends_on: list of step numbers as integers (e.g. [1, 2], NOT strings)

Rules:
- Base geometry first (box, cylinder, sphere)
- Shell/hollow BEFORE cuts and holes
- Cuts and holes AFTER the main body
- Fillets and chamfers LAST
- Each step should be simple enough to express in 1-5 lines of CadQuery

Return ONLY the JSON array, no explanation or commentary."""


STEP_CODE_SYSTEM = """\
You are a CadQuery code generator. You are given an existing CadQuery script
and a description of the NEXT feature to add.

Rules:
- Generate ONLY the new code to APPEND to the existing script
- Do NOT repeat or modify any existing code
- The variable `result` holds the current solid — modify it
- Use .tag() on the new feature
- Wrap fillets/chamfers in try/except
- All dimensions as named variables
- Return ONLY Python code in a ```python block, no explanation"""


def _extract_json_array(text: str) -> list[dict]:
    """Extract a JSON array from LLM response text."""
    import json as _json

    # Try code fences first
    json_match = re.search(r'```(?:json)?\s*\n(.*?)```', text, re.DOTALL)
    if json_match:
        try:
            parsed = _json.loads(json_match.group(1))
            if isinstance(parsed, list):
                return parsed
        except _json.JSONDecodeError:
            pass

    # Try parsing the whole response
    try:
        parsed = _json.loads(text.strip())
        if isinstance(parsed, list):
            return parsed
    except _json.JSONDecodeError:
        pass

    # Try to find a JSON array using bracket scanning
    bracket_start = text.find('[')
    if bracket_start != -1:
        decoder = _json.JSONDecoder()
        try:
            obj, _ = decoder.raw_decode(text, bracket_start)
            if isinstance(obj, list):
                return obj
        except _json.JSONDecodeError:
            pass

    logger.error(f"Could not extract JSON array from response: {text[:200]}")
    return []


async def generate_build_plan(
    spec_text: str,
    process: str = "fdm",
    material: str = "plastic",
) -> list[dict]:
    """Generate a stepwise build plan from a part description.

    Uses Sonnet (fast, cheap) to decompose the part into sequential build steps.
    Returns a list of step dicts: [{step, feature, description, depends_on}, ...]
    """
    process_info = PROCESS_CONSTRAINTS.get(process.lower(), PROCESS_CONSTRAINTS.get("fdm", ""))
    user_content = (
        f"Part description: {spec_text}\n\n"
        f"Manufacturing process: {process} — {process_info}\n"
        f"Material: {material}\n\n"
        "Decompose this into sequential build steps."
    )

    try:
        if CAD_PROVIDER == "anthropic":
            import anthropic
            sonnet_model = os.getenv("CAD_PLAN_MODEL", "claude-sonnet-4-5-20250929")
            logger.info(f"Generating build plan with {sonnet_model}")

            def _call():
                client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
                resp = client.messages.create(
                    model=sonnet_model,
                    max_tokens=2048,
                    temperature=0,
                    system=BUILD_PLAN_SYSTEM,
                    messages=[{"role": "user", "content": user_content}],
                )
                return resp.content[0].text

            response_text = await asyncio.to_thread(_call)
        else:
            response_text = await asyncio.to_thread(
                _ollama_generate,
                [
                    {"role": "system", "content": BUILD_PLAN_SYSTEM},
                    {"role": "user", "content": user_content},
                ],
            )
    except Exception as e:
        logger.error(f"Build plan generation failed: {e}")
        return []

    return _extract_json_array(response_text)


async def generate_step_code(
    existing_script: str,
    step_description: str,
    process: str = "fdm",
) -> str:
    """Generate CadQuery code for a single build step.

    Uses Opus (high quality) to produce the code fragment to append.
    The existing_script provides context of what has been built so far.
    Returns the new code string (not the full combined script).
    """
    process_info = PROCESS_CONSTRAINTS.get(process.lower(), PROCESS_CONSTRAINTS.get("fdm", ""))

    user_content = (
        f"Existing script:\n```python\n{existing_script}\n```\n\n"
        f"Next step to add: {step_description}\n"
        f"Manufacturing process: {process} — {process_info}\n\n"
        "Generate ONLY the new code to append."
    )

    try:
        if CAD_PROVIDER == "anthropic":
            logger.info(f"Generating step code with {ANTHROPIC_MODEL}: {step_description[:80]}")
            response_text = await asyncio.to_thread(
                _anthropic_generate,
                [{"role": "user", "content": user_content}],
                STEP_CODE_SYSTEM,
            )
        else:
            response_text = await asyncio.to_thread(
                _ollama_generate,
                [
                    {"role": "system", "content": STEP_CODE_SYSTEM},
                    {"role": "user", "content": user_content},
                ],
            )
    except Exception as e:
        logger.error(f"Step code generation failed: {e}")
        return f"# Generation failed: {e}\n# Please try again or write the code manually"

    return extract_code(response_text)

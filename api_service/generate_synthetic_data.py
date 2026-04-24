"""Generate synthetic CAD training data by randomising parameters on templates.

Usage:
  docker compose exec api_service python generate_synthetic_data.py --count 500
  docker compose exec api_service python generate_synthetic_data.py --count 100 --validate-percent 10
"""
import argparse
import ast
import copy
import hashlib
import json
import logging
import os
import random
import sys
from datetime import datetime
from uuid import uuid4

# ---------------------------------------------------------------------------
# Path setup — we need generation_service on the path for the converter
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "generation_service"))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from fitd_schemas.fitd_db_schemas import Base, VerifiedExample

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:admin@postgres:5432/fitd")

# ---------------------------------------------------------------------------
# Description templates — keyed by JSON filename (minus .json)
# ---------------------------------------------------------------------------
DESCRIPTION_TEMPLATES: dict[str, list[str]] = {
    # Top-level examples
    "plates": [
        "A {length}x{width}x{thickness}mm rectangular mounting plate with corner holes",
        "A mounting plate measuring {length}mm by {width}mm, {thickness}mm thick with {hole_d}mm holes",
        "Flat {length}x{width}mm plate, {thickness}mm thick, {fillet_r}mm edge fillets",
    ],
    "simple": [
        "A {size}x{size}x{size}mm cube with a {hole_d}mm center hole",
        "A cylinder {height}mm tall with {radius}mm radius and chamfered edges",
        "An {length}x{width}x{height}mm block with counterbore mounting holes",
    ],
    "hooks": [
        "A wall hook with {plate_l}x{plate_w}mm base and {arm_l}mm arm",
        "An S-hook {height}mm tall with {bar_r}mm bar radius",
        "A carabiner clip {outer_l}mm long and {outer_w}mm wide",
        "A double coat hook with {hook_spacing}mm prong spacing",
    ],
    "brackets": [
        "An L-bracket with {leg_h}x{leg_d}mm legs, {thickness}mm thick",
        "A U-bracket {width}x{depth}x{height}mm with {thickness}mm walls",
    ],
    "enclosures": [
        "A {length}x{width}x{height}mm electronics enclosure with {wall}mm walls",
        "A simple box container {length}x{width}x{height}mm with {wall}mm walls",
    ],
    "containers": [
        "A round container {height}mm tall with {outer_r}mm radius and {wall}mm walls",
        "A hexagonal storage container {height}mm tall with {wall}mm walls",
        "A stackable storage bin with lip and handles",
    ],
    "cylindrical": [
        "A threaded standoff {height}mm tall with {outer_r}mm radius and {hole_d}mm bore",
        "A flanged bushing {body_h}mm tall with {flange_r}mm flange",
    ],
    "mechanical": [
        "A pulley wheel with {outer_r}mm radius and {bore_d}mm bore",
        "A roller {body_l}mm long with {body_r}mm radius and flanges",
    ],
    "gears": [
        "A spur gear {height}mm tall with {outer_r}mm radius and {bore_d}mm bore",
        "A gear wheel with {outer_r}mm radius and {bore_d}mm center bore",
    ],
    "shelf_brackets": [
        "An L-bracket shelf mount with {vertical_h}mm vertical leg and {horizontal_d}mm shelf depth",
    ],
    "desk_office": [
        "A pen holder {height}mm tall with {outer_r}mm radius",
        "A desk organiser tray {length}x{width}x{height}mm with divider",
    ],
    "handles_knobs": [
        "A round knob {knob_h}mm tall with {knob_r}mm radius",
        "A T-handle {bar_l}mm wide with {grip_r}mm grip radius",
    ],
    "tapered": [
        "A hollow funnel tapering from {top_r}mm to {bottom_r}mm, {height}mm tall",
        "A solid tapered reducer from {top_r}mm to {bottom_r}mm",
    ],
    "phone_stands": [
        "An angled phone stand with {base_l}x{base_w}mm base and cable slot",
    ],
    "pcb_electronics": [
        "A PCB standoff {height}mm tall with {hex_r}mm hex radius",
        "A DIN rail mounting clip {body_l}x{body_w}mm",
    ],
    "clips_fasteners": [
        "A cable clip with {base_l}x{base_w}mm base and {clip_r}mm cable radius",
    ],
    "threaded": [
        "A threaded insert pocket {body_h}mm tall with {body_r}mm radius",
    ],
    "pipe_fittings": [
        "A 90-degree pipe elbow with {pipe_od}mm OD",
        "A pipe tee connector with {pipe_r}mm radius",
        "A pipe reducer from {large_r}mm to {small_r}mm",
        "A straight pipe coupling {length}mm long with {od}mm OD",
        "A pipe flange plate with {flange_r}mm radius and bolt holes",
    ],
    # Standard parts
    "standard_fasteners": [
        "A hex bolt with {hex_af}mm across flats, {shaft_l}mm shaft",
        "A flat washer {od}mm OD, {id}mm ID, {thickness}mm thick",
    ],
    "standard_spacers": [
        "A round standoff {height}mm tall, {od}mm OD, {hole_d}mm through hole",
    ],
    "standard_enclosures": [
        "A {length}x{width}x{height}mm electronics enclosure with {wall}mm walls and mounting bosses",
    ],
    "standard_brackets": [
        "An L-bracket with {leg_h}x{leg_d}mm legs, {width}mm wide, {thickness}mm thick",
        "A U-bracket {width}x{depth}x{height}mm with {thickness}mm walls",
        "A Z-bracket with {flange_l}mm flanges and {offset_h}mm offset, {width}mm wide",
    ],
    "standard_pipe_fittings": [
        "A 90-degree pipe elbow with {pipe_od}mm OD and {pipe_wall}mm wall",
        "A pipe tee connector, {pipe_r}mm radius, {main_l}mm main run",
        "A pipe reducer from {large_r}mm to {small_r}mm radius",
        "A straight pipe coupling {od}mm OD, {wall}mm wall, {length}mm long",
        "A pipe flange plate {flange_r}mm radius with {bolt_count}-bolt circle",
    ],
}

# Fallback for categories not in the template map
DEFAULT_TEMPLATES = [
    "A {category} part with customised dimensions",
]


# ---------------------------------------------------------------------------
# Geometry hashing (same as seed_examples.py)
# ---------------------------------------------------------------------------
def geometry_hash(steps: list[dict]) -> str | None:
    """Hash the op+tag skeleton of a step list for dedup."""
    if not steps:
        return None
    skeleton = [{"op": s.get("op", ""), "tag": s.get("tag", "")} for s in steps]
    return hashlib.sha256(json.dumps(skeleton, sort_keys=True).encode()).hexdigest()[:16]


# ---------------------------------------------------------------------------
# Parameter randomisation
# ---------------------------------------------------------------------------
def randomise_params(params: dict, min_vals: dict | None = None) -> dict:
    """Randomise numeric parameters within +/-30-50% of original values.

    Enforces manufacturing minimums:
      - wall/thickness >= 1.0mm
      - radius/diameter/hole >= 0.5mm
      - all other dimensions >= 1.0mm
    """
    if min_vals is None:
        min_vals = {}
    result = {}
    for key, value in params.items():
        if isinstance(value, (int, float)) and value > 0:
            # Random factor between 0.5x and 1.5x
            factor = random.uniform(0.5, 1.5)
            new_val = value * factor
            # Round to 1 decimal place
            new_val = round(new_val, 1)
            # Enforce minimums
            if key in min_vals:
                new_val = max(new_val, min_vals[key])
            elif "thickness" in key or "wall" in key:
                new_val = max(new_val, 1.0)
            elif "radius" in key or "diameter" in key or "hole" in key or key in ("id", "od"):
                new_val = max(new_val, 0.5)
            elif "chamfer" in key or "fillet" in key:
                new_val = max(new_val, 0.3)
            else:
                new_val = max(new_val, 1.0)
            result[key] = new_val
        else:
            result[key] = value
    return result


def enforce_fillet_constraint(params: dict) -> dict:
    """Fillet radius must be < 40% of the smallest box/plate dimension."""
    fillet_keys = [k for k in params if "fillet" in k or "fillet_r" == k]
    dimension_keys = [k for k in params if k in (
        "length", "width", "height", "thickness", "depth",
        "leg_h", "leg_d", "outer_r", "body_r",
    )]
    if not fillet_keys or not dimension_keys:
        return params
    smallest_dim = min(params[k] for k in dimension_keys if isinstance(params[k], (int, float)))
    max_fillet = smallest_dim * 0.4
    for fk in fillet_keys:
        if isinstance(params[fk], (int, float)) and params[fk] > max_fillet:
            params[fk] = round(max_fillet, 1)
    return params


# ---------------------------------------------------------------------------
# Description generation
# ---------------------------------------------------------------------------
def extract_keywords(description: str) -> list[str]:
    """Extract keywords from a description, excluding stop words."""
    stop = {
        "a", "an", "the", "with", "and", "or", "for", "of", "in", "on", "to",
        "mm", "from", "is", "it", "by", "its",
    }
    return [
        w.lower().strip(".,;:!?()")
        for w in description.split()
        if len(w) > 2 and w.lower().strip(".,;:!?()") not in stop
    ]


def generate_description(category: str, params: dict) -> str:
    """Generate a natural-language description from templates and parameters."""
    templates = DESCRIPTION_TEMPLATES.get(category, DEFAULT_TEMPLATES)
    template = random.choice(templates)
    # Build a safe format dict: only fill keys that exist, leave others as-is
    fmt = {**params, "category": category}
    try:
        return template.format(**fmt)
    except KeyError:
        # Fallback if template references params that don't exist
        return f"A {category} part with customised dimensions"


# ---------------------------------------------------------------------------
# Category classification from filename
# ---------------------------------------------------------------------------
def category_from_filename(filepath: str, is_standard: bool = False) -> str:
    """Derive category slug from the JSON filename."""
    basename = os.path.basename(filepath).replace(".json", "")
    if is_standard:
        return f"standard_{basename}"
    return basename


# ---------------------------------------------------------------------------
# Template loading
# ---------------------------------------------------------------------------
def load_all_templates() -> list[tuple[str, dict]]:
    """Load all JSON example templates, returning (category, example_dict) pairs."""
    base_dir = os.path.join(os.path.dirname(__file__), "..", "generation_service", "cad", "examples")
    templates: list[tuple[str, dict]] = []

    # Top-level examples
    if os.path.isdir(base_dir):
        for fname in sorted(os.listdir(base_dir)):
            if not fname.endswith(".json") or fname == "cadquery_api.json":
                continue
            fpath = os.path.join(base_dir, fname)
            category = category_from_filename(fpath, is_standard=False)
            with open(fpath) as f:
                data = json.load(f)
            for ex in data:
                templates.append((category, ex))

    # Standard parts
    parts_dir = os.path.join(base_dir, "standard_parts")
    if os.path.isdir(parts_dir):
        for fname in sorted(os.listdir(parts_dir)):
            if not fname.endswith(".json"):
                continue
            fpath = os.path.join(parts_dir, fname)
            category = category_from_filename(fpath, is_standard=True)
            with open(fpath) as f:
                data = json.load(f)
            for ex in data:
                templates.append((category, ex))

    return templates


# ---------------------------------------------------------------------------
# Converter import
# ---------------------------------------------------------------------------
def get_converter():
    """Import and return the convert_json_to_cadquery function."""
    try:
        from cad.converter import convert_json_to_cadquery
        return convert_json_to_cadquery
    except ImportError as e:
        logger.error(f"Could not import converter: {e}")
        logger.error("Make sure generation_service is accessible on the Python path.")
        sys.exit(1)


# ---------------------------------------------------------------------------
# Main generation loop
# ---------------------------------------------------------------------------
def generate_synthetic_data(
    count: int = 500,
    validate_percent: int = 0,
    seed: int | None = None,
) -> None:
    """Generate synthetic CAD training data and insert into verified_examples."""
    if seed is not None:
        random.seed(seed)

    convert_fn = get_converter()
    templates = load_all_templates()

    if not templates:
        logger.error("No templates found. Check that generation_service/cad/examples/ exists.")
        sys.exit(1)

    logger.info(f"Loaded {len(templates)} templates across {len(set(c for c, _ in templates))} categories")

    engine = create_engine(DATABASE_URL)
    Base.metadata.create_all(engine)

    # Try to import embedding utility
    compute_embedding = None
    try:
        from embedding_utils import compute_embedding as _ce
        compute_embedding = _ce
        logger.info("Embedding computation available")
    except ImportError:
        logger.info("sentence-transformers not installed -- skipping embeddings")

    # Track existing geometry hashes for dedup
    with Session(engine) as session:
        existing_hashes: set[str] = set()
        rows = session.query(VerifiedExample.geometry_hash).filter(
            VerifiedExample.geometry_hash.isnot(None)
        ).all()
        for (h,) in rows:
            existing_hashes.add(h)
        logger.info(f"Found {len(existing_hashes)} existing geometry hashes for dedup")

    generated = 0
    failures = 0
    duplicates = 0
    to_validate: list[tuple[str, str]] = []  # (id, cadquery_script) pairs for validation

    with Session(engine) as session:
        while generated < count:
            # Pick a random template
            category, template = random.choice(templates)
            params = template.get("parameters", {})
            steps = template.get("steps", [])

            if not steps:
                continue

            # Randomise parameters
            new_params = randomise_params(copy.deepcopy(params))
            new_params = enforce_fillet_constraint(new_params)

            # Dedup check
            ghash = geometry_hash(steps)
            # We hash the skeleton + rounded params together for dedup of this variant
            param_key = json.dumps(
                {k: round(v, 1) if isinstance(v, float) else v for k, v in sorted(new_params.items())},
                sort_keys=True,
            )
            variant_hash = hashlib.sha256(
                f"{ghash}:{param_key}".encode()
            ).hexdigest()[:16]

            if variant_hash in existing_hashes:
                duplicates += 1
                if duplicates > count * 3:
                    logger.warning("Too many duplicates, stopping early")
                    break
                continue

            # Convert to CadQuery script
            try:
                cadquery_script = convert_fn(steps, new_params)
            except (ValueError, KeyError, TypeError) as e:
                failures += 1
                logger.debug(f"Conversion failed for {category}: {e}")
                continue

            # Verify the script parses as valid Python
            try:
                ast.parse(cadquery_script)
            except SyntaxError:
                failures += 1
                logger.debug(f"Generated script has syntax error for {category}")
                continue

            # Generate description
            description = generate_description(category, new_params)
            keywords = extract_keywords(description)
            # Also include original keywords from the template
            orig_keywords = template.get("keywords", [])
            merged_keywords = list(set(keywords + orig_keywords))

            # Compute embedding if available
            embedding_json = None
            if compute_embedding:
                embedding_json = compute_embedding(description)

            # Determine complexity
            complexity = "simple" if len(steps) <= 3 else ("medium" if len(steps) <= 6 else "complex")

            example_id = str(uuid4())
            ve = VerifiedExample(
                id=example_id,
                description=description,
                keywords=json.dumps(merged_keywords),
                category=category,
                complexity=complexity,
                source="synthetic",
                parameters=json.dumps(new_params),
                steps=json.dumps(steps),
                cadquery_script=cadquery_script,
                generation_path="structured",
                is_curated=False,
                is_active=True,
                upvotes=1,
                geometry_hash=variant_hash,
                op_count=len(steps),
                embedding_json=embedding_json,
                created_at=datetime.now().isoformat(),
            )
            session.add(ve)
            existing_hashes.add(variant_hash)
            generated += 1

            # Track for optional validation
            if validate_percent > 0 and random.randint(1, 100) <= validate_percent:
                to_validate.append((example_id, cadquery_script))

            if generated % 50 == 0:
                session.commit()
                logger.info(
                    f"Generated {generated}/{count} variants "
                    f"({failures} failures skipped, {duplicates} duplicates skipped)"
                )

        # Final commit
        session.commit()
        logger.info(
            f"Done: generated {generated}/{count} variants "
            f"({failures} failures, {duplicates} duplicates)"
        )

        # Optional validation pass
        if to_validate:
            validated = _validate_scripts(to_validate, session)
            logger.info(f"Validated {validated}/{len(to_validate)} scripts in Docker sandbox")

    return


# ---------------------------------------------------------------------------
# Optional Docker validation
# ---------------------------------------------------------------------------
def _validate_scripts(
    scripts: list[tuple[str, str]],
    session: Session,
) -> int:
    """Execute scripts in the cad_sandbox Docker container to verify they work.

    Successfully validated examples get their upvotes bumped to 3.
    """
    import subprocess

    validated = 0
    for example_id, script in scripts:
        try:
            result = subprocess.run(
                [
                    "docker", "exec", "cad_sandbox",
                    "python", "-c", script,
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode == 0:
                # Bump upvotes for validated scripts
                ex = session.query(VerifiedExample).filter(
                    VerifiedExample.id == example_id
                ).first()
                if ex:
                    ex.upvotes = 3
                validated += 1
            else:
                logger.debug(
                    f"Validation failed for {example_id}: {result.stderr[:200]}"
                )
        except (subprocess.TimeoutExpired, FileNotFoundError) as e:
            logger.debug(f"Validation error for {example_id}: {e}")

    session.commit()
    return validated


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Generate synthetic CAD training data by randomising templates."
    )
    parser.add_argument(
        "--count", type=int, default=500,
        help="Total number of synthetic examples to generate (default: 500)",
    )
    parser.add_argument(
        "--validate-percent", type=int, default=0,
        help="Percentage of generated scripts to validate in Docker (0-100, default: 0)",
    )
    parser.add_argument(
        "--seed", type=int, default=None,
        help="Random seed for reproducibility",
    )
    args = parser.parse_args()

    if not 0 <= args.validate_percent <= 100:
        parser.error("--validate-percent must be between 0 and 100")

    generate_synthetic_data(
        count=args.count,
        validate_percent=args.validate_percent,
        seed=args.seed,
    )


if __name__ == "__main__":
    main()

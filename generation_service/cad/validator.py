"""Post-execution validation for CadQuery refinements.

Checks that the LLM's refined script didn't make unwanted changes:
- Parameter values not mentioned in the instruction shouldn't change
- Existing feature tags shouldn't be removed
- Bounding box shouldn't change for subtractive operations
- Volume change should match the operation direction
"""
import re
import logging

from cad.llm import extract_parameters

logger = logging.getLogger(__name__)

SUBTRACTIVE_KEYWORDS = {
    "hole", "pocket", "slot", "groove", "shell", "hollow",
    "cut", "drill", "vent", "cutout", "opening", "remove",
}

ADDITIVE_KEYWORDS = {
    "boss", "shelf", "ledge", "flange", "rib", "wall",
    "post", "mount", "extrude", "extend", "add material",
}


def check_parameters(original_script: str, refined_script: str, instruction: str) -> str | None:
    """Hard reject if parameters changed that weren't mentioned in the instruction."""
    try:
        old_params = extract_parameters(original_script)
        new_params = extract_parameters(refined_script)
    except Exception:
        return None  # Can't parse — don't block

    old_map = {p["name"]: p["value"] for p in old_params}
    new_map = {p["name"]: p["value"] for p in new_params}

    instruction_lower = instruction.lower()
    changed = []

    for name, old_val in old_map.items():
        if name in new_map and new_map[name] != old_val:
            # Check if the parameter name appears in the instruction
            if name.lower() not in instruction_lower:
                changed.append(f"'{name}' ({old_val} → {new_map[name]})")

    if changed:
        return f"Parameters changed without being requested: {', '.join(changed)}"
    return None


def check_tags(original_script: str, refined_script: str) -> str | None:
    """Hard reject if existing feature tags were removed from the script."""
    old_tags = set(re.findall(r'\.tag\(["\'](\w+)["\']\)', original_script))
    new_tags = set(re.findall(r'\.tag\(["\'](\w+)["\']\)', refined_script))
    removed = old_tags - new_tags

    if removed:
        return f"Features removed: {', '.join(sorted(removed))}"
    return None


def check_bbox(old_meta: dict, new_meta: dict, instruction: str) -> str | None:
    """Warn if bounding box changed unexpectedly for subtractive operations."""
    TOLERANCE = 0.5  # mm

    old_bb = old_meta.get("bbox", {})
    new_bb = new_meta.get("bbox", {})

    if not old_bb or not new_bb:
        return None

    instruction_lower = instruction.lower()
    is_subtractive = any(kw in instruction_lower for kw in SUBTRACTIVE_KEYWORDS)

    if not is_subtractive:
        return None  # Additive ops may change bbox — don't warn

    for axis in ("xlen", "ylen", "zlen"):
        old_val = old_bb.get(axis, 0)
        new_val = new_bb.get(axis, 0)
        diff = abs(new_val - old_val)
        if diff > TOLERANCE:
            return f"Bounding box {axis} changed by {diff:.1f}mm for a subtractive operation"

    return None


def check_volume(old_meta: dict, new_meta: dict, instruction: str) -> str | None:
    """Warn if volume change contradicts the operation type."""
    old_vol = old_meta.get("volume_mm3", 0)
    new_vol = new_meta.get("volume_mm3", 0)

    if old_vol == 0 or new_vol == 0:
        return None

    change_pct = abs(new_vol - old_vol) / old_vol * 100

    instruction_lower = instruction.lower()
    is_subtractive = any(kw in instruction_lower for kw in SUBTRACTIVE_KEYWORDS)

    if is_subtractive and new_vol > old_vol * 1.01:
        return f"Volume increased by {change_pct:.1f}% for a subtractive operation"

    if change_pct > 50:
        return f"Volume changed by {change_pct:.1f}% — model may have been rewritten"

    return None


def validate_refinement(
    original_script: str,
    refined_script: str,
    instruction: str,
    old_metadata: dict | None,
    new_metadata: dict | None,
) -> tuple[str | None, list[str]]:
    """Validate a refinement before committing.

    Returns:
        (hard_reject_reason, warnings)
        - hard_reject_reason: if not None, the refinement should be rejected
        - warnings: list of warning strings (refinement proceeds but logged)
    """
    # Hard checks — reject if violated
    hard = check_parameters(original_script, refined_script, instruction)
    if not hard:
        hard = check_tags(original_script, refined_script)

    # Soft checks — warn but don't reject
    warnings = []
    w = check_bbox(old_metadata or {}, new_metadata or {}, instruction)
    if w:
        warnings.append(w)
    w = check_volume(old_metadata or {}, new_metadata or {}, instruction)
    if w:
        warnings.append(w)

    if hard:
        logger.warning(f"Validation REJECTED: {hard}")
    if warnings:
        logger.warning(f"Validation warnings: {warnings}")

    return hard, warnings

"""Claude API integration for CadQuery code generation."""
import os
import re
import logging
import anthropic

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL = os.getenv("CAD_MODEL", "claude-sonnet-4-20250514")

SYSTEM_PROMPT = """You are a CadQuery expert. Generate Python code that uses CadQuery to create the requested 3D model.

## Rules
1. Import cadquery as cq at the top
2. Your code MUST define a variable called `result` containing the final CadQuery Workplane object
3. At the end, export to STEP: `cq.exporters.export(result, OUTPUT_PATH)`
4. OUTPUT_PATH is provided as an environment variable — use `os.environ["OUTPUT_PATH"]`
5. Use millimeters as the default unit
6. All dimensions should be realistic for manufacturing

## Manufacturing Constraints
- Minimum wall thickness: 1mm
- No unsupported overhangs greater than 45 degrees (design for 3D printing)
- Avoid extremely thin features (< 0.5mm)
- Prefer chamfers over sharp external edges

## CadQuery Quick Reference
- Box: `cq.Workplane("XY").box(length, width, height)`
- Cylinder: `cq.Workplane("XY").cylinder(height, radius)`
- Sphere: `cq.Workplane("XY").sphere(radius)`
- Holes: `.faces(">Z").workplane().hole(diameter)`
- Fillets: `.edges("|Z").fillet(radius)`
- Chamfers: `.edges("|Z").chamfer(distance)`
- Shell: `.shell(thickness)` (negative = inward)
- Extrude: `.extrude(distance)`
- Cut: `.cut(other_shape)`
- Union: `.union(other_shape)`
- Translate: `.translate((x, y, z))`
- Rotate: `.rotate((0,0,0), (0,0,1), angle_degrees)`
- Mirror: `.mirror("XY")`
- Loft: `.loft()` between multiple sketches
- Sweep: `.sweep(path)`
- Text: `.text("text", fontsize, distance)` for engraving

## Output Format
Return ONLY a Python code block. No explanation before or after.

```python
import cadquery as cq
import os

# ... your code here ...

result = ...
cq.exporters.export(result, os.environ["OUTPUT_PATH"])
```"""


def extract_code(response_text: str) -> str:
    """Extract Python code from Claude's response."""
    # Try to find a Python code block
    pattern = r"```python\s*\n(.*?)```"
    match = re.search(pattern, response_text, re.DOTALL)
    if match:
        return match.group(1).strip()

    # Try generic code block
    pattern = r"```\s*\n(.*?)```"
    match = re.search(pattern, response_text, re.DOTALL)
    if match:
        return match.group(1).strip()

    # If no code blocks, return the raw text (might be valid Python)
    return response_text.strip()


async def generate_cadquery_code(prompt: str, target_units: str = "mm") -> str:
    """Call Claude API to generate CadQuery code from a text prompt."""
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    units_note = f"\nUse {target_units} as the unit system." if target_units != "mm" else ""

    message = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Create a CadQuery model: {prompt}{units_note}",
            }
        ],
    )

    response_text = message.content[0].text
    return extract_code(response_text)


async def fix_cadquery_code(
    original_prompt: str, code: str, error: str, target_units: str = "mm"
) -> str:
    """Call Claude API to fix broken CadQuery code given the error."""
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    message = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Create a CadQuery model: {original_prompt}",
            },
            {
                "role": "assistant",
                "content": f"```python\n{code}\n```",
            },
            {
                "role": "user",
                "content": (
                    f"The code above failed with this error:\n\n```\n{error}\n```\n\n"
                    "Please fix the code. Return ONLY the corrected Python code block."
                ),
            },
        ],
    )

    response_text = message.content[0].text
    return extract_code(response_text)

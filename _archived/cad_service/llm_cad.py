"""LLM integration for CadQuery code generation.

Supports two backends via CAD_PROVIDER env var:
  - "ollama" (default) — local Ollama via OpenAI-compatible API
  - "anthropic" — Claude API (requires ANTHROPIC_API_KEY)
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

## Allowed Imports
You may ONLY use these imports:
- import cadquery as cq
- import math
- import os (ONLY for os.environ["OUTPUT_PATH"])

Do NOT use: subprocess, socket, requests, httpx, open(), eval(), exec(), or any other standard library modules.
Any code using forbidden imports will be rejected by the validator.

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
    """Extract Python code from LLM response."""
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


# ---------------------------------------------------------------------------
# Ollama backend (OpenAI-compatible API)
# ---------------------------------------------------------------------------

def _ollama_generate(messages: list[dict]) -> str:
    """Call Ollama via the OpenAI-compatible chat completions endpoint."""
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

def _anthropic_generate(user_messages: list[dict]) -> str:
    """Call the Anthropic Messages API."""
    import anthropic

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=user_messages,
    )
    return message.content[0].text


# ---------------------------------------------------------------------------
# Public API — dispatch based on CAD_PROVIDER
# ---------------------------------------------------------------------------

async def generate_cadquery_code(prompt: str, target_units: str = "mm") -> str:
    """Generate CadQuery code from a text prompt using the configured LLM."""
    units_note = f"\nUse {target_units} as the unit system." if target_units != "mm" else ""
    user_content = f"Create a CadQuery model: {prompt}{units_note}"

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
    """Fix broken CadQuery code using the configured LLM."""
    user_msg_1 = f"Create a CadQuery model: {original_prompt}"
    assistant_msg = f"```python\n{code}\n```"
    fix_msg = (
        f"The code above failed with this error:\n\n```\n{error}\n```\n\n"
        "Please fix the code. Return ONLY the corrected Python code block."
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

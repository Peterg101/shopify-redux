"""Conversational pre-generation flow for CAD.

Manages a multi-turn chat with the user to gather requirements before
generating CadQuery code.  The conversation progresses through phases:
  freeform -> guided -> confirmation -> confirmed

Images (Excalidraw sketches, photos) are forwarded to Claude Vision.
Responses are streamed via SSE for real-time feedback.
"""
import asyncio
import json
import logging
import os
from collections.abc import AsyncGenerator

from redis.asyncio import Redis as AsyncRedis

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CHAT_MODEL = os.getenv("CAD_CHAT_MODEL", "claude-sonnet-4-20250514")
CHAT_HISTORY_TTL = 3600  # 1 hour

# ---------------------------------------------------------------------------
# System prompt for requirements gathering
# ---------------------------------------------------------------------------

REQUIREMENTS_GATHERING_PROMPT = """\
You are a CAD design requirements analyst helping a user specify a manufacturable 3D part.
Your job is to have a natural conversation to understand what they need, then produce a
precise specification that a CadQuery code generator can work from.

## Conversation phases

You manage three phases.  Always include a JSON block in your response (see format below).

### 1. Freeform (phase: "freeform")
Ask open-ended questions to understand:
- What the part IS and what it's FOR (purpose, use-case)
- What it connects to or interfaces with (mounting, enclosures, mating parts)
- Environmental constraints (indoor/outdoor, temperature, loads, vibration)
- Any reference standards or off-the-shelf components it must accommodate

Keep questions conversational and one or two at a time.  Do NOT ask about
exact dimensions yet -- understand the intent first.

### 2. Guided (phase: "guided")
Once you understand the purpose, transition to specific engineering questions:
- Overall dimensions (length x width x height)
- Hole positions, diameters, patterns (bolt circles, mounting holes)
- Wall thickness requirements
- Fillets, chamfers, draft angles
- Tolerances and surface finish
- Symmetry, orientation for manufacturing
- Any features: slots, pockets, bosses, ribs, snap-fits, threads

Ask about the spatial details LLMs are bad at inferring.  Be specific:
"What diameter are the mounting holes, and how far from each corner?"
not "Tell me about the holes."

### 3. Confirmation (phase: "confirmation")
When you have enough information, present a structured specification for the
user to review.  Include ALL gathered parameters.  The user can approve,
edit, or ask for changes.

If the user approves (says "looks good", "generate", "yes", etc.), respond
with phase "confirmed" and the final spec.

## Interpreting images

Users may attach:
- **Excalidraw sketches**: Rough schematics.  Extract topology (shapes, relative
  positions, hole count/pattern) but do NOT trust exact pixel dimensions --
  always confirm actual measurements verbally.
- **Photos**: Reference objects, existing parts, or hand-drawn sketches.
  Describe what you see and use it to inform your questions.

When an image is provided, acknowledge it and describe what you observe before
asking follow-up questions.

## Design intent context

The user has already selected manufacturing process, material, and approximate
size via UI toggles.  These values are provided in a DESIGN_INTENT block in the
first message.  Reference them but allow the user to override via chat.

## Response format

IMPORTANT: Your response MUST end with a JSON block wrapped in ```json fences:

```json
{
  "phase": "freeform" | "guided" | "confirmation" | "confirmed",
  "spec": null | { ... }
}
```

Everything before the JSON block is your conversational reply shown to the user.
The JSON block is parsed by the system and hidden from the user.

When phase is "confirmation" or "confirmed", the spec object should contain:

```json
{
  "description": "One-line summary of the part",
  "purpose": "What it's for and how it's used",
  "dimensions": {
    "length": 100,
    "width": 60,
    "height": 5,
    "units": "mm"
  },
  "features": [
    {
      "type": "through_hole",
      "description": "M4 clearance holes for mounting",
      "diameter": 4.5,
      "count": 4,
      "position": "8mm from each corner"
    }
  ],
  "wall_thickness": 2.0,
  "process": "fdm",
  "material": "plastic",
  "tolerances": "+/- 0.3mm",
  "notes": "Any additional requirements"
}
```
"""


# ---------------------------------------------------------------------------
# Conversation state helpers (Redis-backed)
# ---------------------------------------------------------------------------

def _redis_key(task_id: str) -> str:
    return f"cad_chat:{task_id}"


async def _load_history(redis: AsyncRedis, task_id: str) -> list[dict]:
    raw = await redis.get(_redis_key(task_id))
    if raw:
        return json.loads(raw)
    return []


async def _save_history(redis: AsyncRedis, task_id: str, history: list[dict]):
    await redis.set(
        _redis_key(task_id),
        json.dumps(history),
        ex=CHAT_HISTORY_TTL,
    )


async def get_history_for_persistence(task_id: str, redis: AsyncRedis) -> str:
    """Load conversation from Redis and return text-only JSON for DB storage."""
    history = await _load_history(redis, task_id)
    clean = [{"role": msg["role"], "content": msg["content"]} for msg in history]
    return json.dumps(clean)


# ---------------------------------------------------------------------------
# Message building
# ---------------------------------------------------------------------------

def _build_design_intent_block(design_intent: dict | None) -> str:
    """Format design intent settings as a context block for the system."""
    if not design_intent:
        return ""
    parts = ["DESIGN_INTENT (selected by user via UI):"]
    if design_intent.get("process"):
        parts.append(f"  Process: {design_intent['process'].upper()}")
    if design_intent.get("material_hint"):
        parts.append(f"  Material: {design_intent['material_hint']}")
    size = design_intent.get("approximate_size")
    if size:
        w, d, h = size.get("width"), size.get("depth"), size.get("height")
        if any(v for v in [w, d, h]):
            parts.append(f"  Approximate size: {w or '?'} x {d or '?'} x {h or '?'} mm")
    units = design_intent.get("target_units", "mm")
    if units != "mm":
        parts.append(f"  Units: {units}")
    features = design_intent.get("features", [])
    if features:
        parts.append(f"  Requested features: {', '.join(features)}")
    return "\n".join(parts)


def _clean_image_b64(img_b64: str) -> tuple[str, str]:
    """Detect media type and strip data URI prefix from a base64 image string.

    Returns (media_type, clean_base64).
    """
    media_type = "image/png"
    if img_b64.startswith("/9j/"):
        media_type = "image/jpeg"
    elif img_b64.startswith("data:"):
        header, img_b64 = img_b64.split(",", 1)
        if "jpeg" in header or "jpg" in header:
            media_type = "image/jpeg"
    return media_type, img_b64


def _make_image_block(img_b64: str) -> dict:
    """Build a Claude Vision image content block from a base64 string."""
    media_type, clean_b64 = _clean_image_b64(img_b64)
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": media_type, "data": clean_b64},
    }


def _build_claude_content(message: dict) -> list[dict] | str:
    """Build a Claude content block from a stored message (text + optional images)."""
    images = message.get("images", [])
    if not images:
        return message["content"]

    blocks: list[dict] = [{"type": "text", "text": message["content"]}]
    for img_b64 in images:
        blocks.append(_make_image_block(img_b64))
    return blocks


def _history_to_messages(history: list[dict], design_intent: dict | None) -> list[dict]:
    """Convert stored history to Claude messages format, injecting design intent."""
    messages = []
    for i, msg in enumerate(history):
        content = _build_claude_content(msg)

        # Inject design intent context into the first user message
        if i == 0 and msg["role"] == "user" and design_intent:
            intent_block = _build_design_intent_block(design_intent)
            if intent_block:
                if isinstance(content, str):
                    content = f"{intent_block}\n\n{content}"
                else:
                    # Prepend as a text block
                    content.insert(0, {"type": "text", "text": intent_block + "\n\n"})

        messages.append({"role": msg["role"], "content": content})
    return messages


# ---------------------------------------------------------------------------
# Response parsing
# ---------------------------------------------------------------------------

def _parse_response(text: str) -> tuple[str, str, dict | None]:
    """Parse assistant response into (display_text, phase, spec).

    Extracts the trailing ```json block and returns the user-visible text
    before it.
    """
    phase = "freeform"
    spec = None
    display_text = text

    # Find the last ```json ... ``` block
    json_start = text.rfind("```json")
    if json_start != -1:
        json_end = text.find("```", json_start + 7)
        if json_end != -1:
            json_str = text[json_start + 7:json_end].strip()
            display_text = text[:json_start].strip()
            try:
                parsed = json.loads(json_str)
                phase = parsed.get("phase", "freeform")
                spec = parsed.get("spec")
            except json.JSONDecodeError:
                logger.warning("Failed to parse JSON block from chat response")

    return display_text, phase, spec


# ---------------------------------------------------------------------------
# Streaming chat (SSE)
# ---------------------------------------------------------------------------

async def chat_stream(
    task_id: str,
    content: str,
    images: list[str],
    design_intent: dict | None,
    redis: AsyncRedis,
) -> AsyncGenerator[str, None]:
    """Stream a chat response via SSE events.

    Yields SSE-formatted data lines:
      - "token:<text>"        — incremental text token
      - "done:<json>"         — final message with phase/spec metadata
      - "error:<message>"     — error occurred
    """
    history = await _load_history(redis, task_id)

    # Append user message
    user_msg = {"role": "user", "content": content, "images": images}
    history.append(user_msg)

    # Build Claude messages
    claude_messages = _history_to_messages(history, design_intent)

    full_text = ""

    try:
        # Stream from Claude
        async for token in _anthropic_stream(claude_messages):
            full_text += token
            yield json.dumps({"type": "token", "text": token})

        # Parse the complete response
        display_text, phase, spec = _parse_response(full_text)

        logger.info(
            f"[{task_id}] Complete — phase: {phase}, "
            f"reply: {len(display_text)} chars, has_spec: {spec is not None}"
        )

        # Save to history (display text only, no JSON block)
        assistant_msg = {"role": "assistant", "content": display_text}
        history.append(assistant_msg)
        await _save_history(redis, task_id, history)

        # Send final metadata event
        yield json.dumps({"type": "done", "reply": display_text, "phase": phase, "spec": spec, "task_id": task_id})

    except Exception as e:
        logger.error(f"[{task_id}] Stream error: {e}")
        yield json.dumps({"type": "error", "message": str(e)})


async def _anthropic_stream(messages: list[dict]) -> AsyncGenerator[str, None]:
    """Stream tokens from Anthropic Claude API."""
    import anthropic

    def _stream_sync():
        """Synchronous generator that yields text deltas from Claude."""
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        with client.messages.stream(
            model=CHAT_MODEL,
            max_tokens=4096,
            temperature=0,
            system=REQUIREMENTS_GATHERING_PROMPT,
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                yield text

    # Run the sync generator in a thread, yielding tokens back to async
    import queue
    import threading

    q: queue.Queue[str | None | Exception] = queue.Queue()

    def _run():
        try:
            for token in _stream_sync():
                q.put(token)
            q.put(None)  # signal done
        except Exception as e:
            q.put(e)

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()

    while True:
        # Poll the queue, yielding to the event loop between checks
        try:
            item = q.get(timeout=0.05)
        except queue.Empty:
            await asyncio.sleep(0.01)
            continue

        if item is None:
            break
        if isinstance(item, Exception):
            raise item
        yield item

    thread.join(timeout=5)


# ---------------------------------------------------------------------------
# Non-streaming chat (kept as fallback)
# ---------------------------------------------------------------------------

async def chat(
    task_id: str,
    content: str,
    images: list[str],
    design_intent: dict | None,
    redis: AsyncRedis,
) -> dict:
    """Process a user chat message and return the assistant's response (non-streaming)."""
    history = await _load_history(redis, task_id)
    user_msg = {"role": "user", "content": content, "images": images}
    history.append(user_msg)
    claude_messages = _history_to_messages(history, design_intent)

    response_text = await asyncio.to_thread(_anthropic_chat, claude_messages)
    display_text, phase, spec = _parse_response(response_text)

    assistant_msg = {"role": "assistant", "content": display_text}
    history.append(assistant_msg)
    await _save_history(redis, task_id, history)

    return {
        "task_id": task_id,
        "reply": display_text,
        "phase": phase,
        "spec": spec,
    }


def _anthropic_chat(messages: list[dict]) -> str:
    """Call Anthropic Claude (non-streaming fallback)."""
    import anthropic

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model=CHAT_MODEL,
        max_tokens=4096,
        temperature=0,
        system=REQUIREMENTS_GATHERING_PROMPT,
        messages=messages,
    )
    return message.content[0].text


# ---------------------------------------------------------------------------
# Spec -> generation prompt bridge
# ---------------------------------------------------------------------------

def spec_to_prompt(spec: dict, design_intent: dict | None = None) -> str:
    """Convert a confirmed spec dict into a rich text prompt for generate_cadquery_code()."""
    parts = []

    desc = spec.get("description", "")
    purpose = spec.get("purpose", "")
    if desc:
        parts.append(f"Create: {desc}")
    if purpose:
        parts.append(f"Purpose: {purpose}")

    dims = spec.get("dimensions")
    if dims:
        l = dims.get("length", "?")
        w = dims.get("width", "?")
        h = dims.get("height", "?")
        units = dims.get("units", "mm")
        parts.append(f"Overall dimensions: {l} x {w} x {h} {units}")

    wall = spec.get("wall_thickness")
    if wall:
        parts.append(f"Wall thickness: {wall}mm")

    features = spec.get("features", [])
    if features:
        feature_lines = []
        for f in features:
            line = f.get("description", f.get("type", ""))
            if f.get("diameter"):
                line += f" (diameter: {f['diameter']}mm)"
            if f.get("count"):
                line += f" x{f['count']}"
            if f.get("position"):
                line += f" at {f['position']}"
            feature_lines.append(f"  - {line}")
        parts.append("Features:\n" + "\n".join(feature_lines))

    tolerances = spec.get("tolerances")
    if tolerances:
        parts.append(f"Tolerances: {tolerances}")

    notes = spec.get("notes")
    if notes:
        parts.append(f"Notes: {notes}")

    # Include design intent settings if provided
    if design_intent:
        intent_parts = []
        if design_intent.get("process"):
            intent_parts.append(f"Process: {design_intent['process'].upper()}")
        if design_intent.get("material_hint"):
            intent_parts.append(f"Material: {design_intent['material_hint']}")
        if intent_parts:
            parts.append("Manufacturing: " + ", ".join(intent_parts))

    return "\n\n".join(parts)


async def build_generation_context(
    task_id: str,
    spec: dict,
    design_intent: dict | None,
    redis: AsyncRedis,
) -> list[dict]:
    """Build rich context for code generation from the conversation history + spec.

    Returns a list of Claude content blocks (text + images) so the code
    generation LLM can see sketches, photos, and the full design discussion.
    """
    history = await _load_history(redis, task_id)

    blocks: list[dict] = []

    # Structured spec as JSON
    blocks.append({
        "type": "text",
        "text": "## CONFIRMED DESIGN SPECIFICATION\n\n" + json.dumps(spec, indent=2),
    })

    # Design conversation with images
    if history:
        blocks.append({
            "type": "text",
            "text": (
                "\n## DESIGN CONVERSATION\n"
                "The following conversation led to the specification above. "
                "Use it to understand spatial relationships, context, and design intent. "
                "Any attached sketches or photos show the intended layout.\n"
            ),
        })
        for msg in history:
            role = "User" if msg["role"] == "user" else "Design Engineer"
            blocks.append({"type": "text", "text": f"**{role}:** {msg['content']}"})
            # Include images from this message (sketches, photos)
            for img_b64 in msg.get("images", []):
                blocks.append(_make_image_block(img_b64))

    # Flat spec summary as generation instructions
    blocks.append({
        "type": "text",
        "text": "\n## GENERATION INSTRUCTIONS\n\n" + spec_to_prompt(spec, design_intent),
    })

    return blocks

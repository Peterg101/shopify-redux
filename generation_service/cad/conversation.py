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
import random
import time
from collections.abc import AsyncGenerator

from redis.asyncio import Redis as AsyncRedis

from cad.tools import CAD_TOOLS

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CHAT_MODEL = os.getenv("CAD_CHAT_MODEL", "claude-sonnet-4-5")
CHAT_HISTORY_TTL = 3600  # 1 hour
ANTHROPIC_BETA_HEADER = "compact-2026-01-12"  # automatic conversation compaction
MAX_RETRIES = 4

# ---------------------------------------------------------------------------
# System prompt for requirements gathering
# ---------------------------------------------------------------------------

REQUIREMENTS_GATHERING_PROMPT = """\
<role>
You are a CAD design assistant helping a user specify a manufacturable 3D part.
You produce structured specifications that a deterministic CadQuery generator
turns into STEP files.
</role>

<goal>
Help the user describe their part clearly enough to generate it. Ask targeted
questions when you need more information, and submit a complete spec the
moment you have enough to proceed. Do not over-ask. Trust the user's intent.
</goal>

<tools>
You MUST respond by calling exactly one tool — never reply with plain text.

- ask_clarification: use when you need more information from the user. Ask ONE
  focused question per turn. Set phase="freeform" when exploring purpose, or
  phase="guided" when nailing down specific engineering numbers.

- submit_cad_spec: use when you have enough information to produce a complete
  spec. Required minimum: a description, overall dimensions (length, width,
  height in mm or inches), manufacturing process, and material. If the user
  has given you "a 50mm cube", that IS enough — submit immediately, don't ask
  more questions.
</tools>

<manufacturing_constraints>
- FDM: minimum wall 1.6mm, avoid overhangs >45° without supports.
- SLA: thinner walls OK (0.8mm), watch for resin drainage holes on hollow parts.
- SLS: minimum wall 1.0mm, escape holes needed for trapped powder.
- CNC: minimum internal radius 1mm, all features must be tool-accessible from
  one or two setups; no internal undercuts.
- Injection: requires draft angles (typically 1°), uniform wall thickness,
  no thick solid sections (sink marks).
</manufacturing_constraints>

<style>
- Be concise. One clarifying question per turn — never multi-part.
- Do not narrate your reasoning. Just ask the question or submit the spec.
- If the user's request is already specific ("50mm cube with a 20mm hole"),
  submit the spec immediately. Don't fish for unnecessary detail.
- The user has a UI for picking process and material — those values are
  available in the DESIGN_INTENT block on the first user turn. Use them
  unless the user overrides in chat.
</style>

<images>
- Excalidraw sketches show topology only — extract shapes and relative
  positions, but never trust pixel dimensions. Confirm measurements verbally.
- Photos may reference real objects or existing parts. Describe what you see
  before asking follow-up questions.
</images>
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


async def _persist_to_db(task_id: str, history: list[dict]):
    """Persist conversation history to Postgres (text-only, no images).

    Called after every chat turn so the conversation survives Redis TTL expiry.
    Failures are logged but don't break the chat flow.
    """
    import httpx
    from jwt_auth import generate_token

    clean = [{"role": msg["role"], "content": msg["content"]} for msg in history]
    conversation_json = json.dumps(clean)

    try:
        api_url = os.getenv("API_SERVICE_URL", "http://api_service:8000")
        token = generate_token("generation_service", audience="api_service")
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.patch(
                f"{api_url}/tasks/{task_id}/script",
                json={
                    "cadquery_script": "",
                    "generation_prompt": "",
                    "conversation_history": conversation_json,
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            if resp.status_code != 200:
                logger.warning(f"[{task_id}] Failed to persist conversation: {resp.status_code}")
    except Exception as e:
        logger.warning(f"[{task_id}] Failed to persist conversation: {e}")


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
# Observability + retry helpers
# ---------------------------------------------------------------------------

def _log_claude_call(task_id: str, response, duration_ms: float, tool_called: str | None) -> None:
    """Emit a structured log line summarising one Claude call."""
    usage = getattr(response, "usage", None)
    payload = {
        "event": "claude_call",
        "task_id": task_id,
        "model": getattr(response, "model", CHAT_MODEL),
        "stop_reason": getattr(response, "stop_reason", None),
        "tool_called": tool_called,
        "duration_ms": round(duration_ms, 1),
        "request_id": getattr(response, "_request_id", None) or getattr(response, "id", None),
    }
    if usage is not None:
        payload.update({
            "input_tokens": getattr(usage, "input_tokens", None),
            "output_tokens": getattr(usage, "output_tokens", None),
            "cache_creation_input_tokens": getattr(usage, "cache_creation_input_tokens", None),
            "cache_read_input_tokens": getattr(usage, "cache_read_input_tokens", None),
        })
    logger.info(json.dumps(payload))


def _call_claude_with_retry(call_fn):
    """Run a synchronous Anthropic call with bounded exponential backoff + jitter.

    Retries on 429 (rate limited) and 529 (overloaded). Connection errors get
    one retry per attempt. All other API errors propagate.
    """
    import anthropic

    last_err: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            return call_fn()
        except anthropic.APIStatusError as e:
            last_err = e
            if e.status_code not in (429, 529):
                raise
            reset_hint = None
            try:
                reset_hint = e.response.headers.get("anthropic-ratelimit-tokens-reset")
            except Exception:
                pass
            if reset_hint:
                try:
                    delay = max(0.0, float(reset_hint))
                except ValueError:
                    delay = (2 ** attempt) + random.uniform(0, 0.5)
            else:
                delay = (2 ** attempt) + random.uniform(0, 0.5)
            logger.warning(f"Claude {e.status_code}, retry {attempt + 1}/{MAX_RETRIES} after {delay:.1f}s")
            time.sleep(delay)
        except anthropic.APIConnectionError as e:
            last_err = e
            time.sleep(1 + attempt)
    raise RuntimeError(f"Claude API retries exhausted: {last_err}")


def _build_system_param() -> list[dict]:
    """Build the cacheable system prompt block.

    Uses ephemeral cache_control so the (multi-kB) static instructions are
    cached on the first turn and read back at ~10% of input cost on subsequent
    turns.
    """
    return [
        {
            "type": "text",
            "text": REQUIREMENTS_GATHERING_PROMPT,
            "cache_control": {"type": "ephemeral"},
        }
    ]


# ---------------------------------------------------------------------------
# Tool-use chat (single round-trip, no streaming text — Claude responds with
# a tool_use block, never a free-form essay).
# ---------------------------------------------------------------------------

def _interpret_tool_use(response) -> tuple[str, str, dict | None]:
    """Extract (display_reply, phase, spec) from a Claude tool_use response."""
    text_chunks: list[str] = []
    tool_block = None

    for block in response.content:
        block_type = getattr(block, "type", None)
        if block_type == "text":
            text_chunks.append(getattr(block, "text", "") or "")
        elif block_type == "tool_use":
            tool_block = block

    leading_text = "\n".join(t for t in text_chunks if t).strip()

    if tool_block is None:
        # Claude went off-script and returned only prose. Treat as a freeform reply.
        reply = leading_text or "(empty response)"
        return reply, "freeform", None

    tool_input = getattr(tool_block, "input", None) or {}

    if tool_block.name == "ask_clarification":
        question = tool_input.get("question", "").strip() or "(no question)"
        phase = tool_input.get("phase") or "guided"
        if phase not in ("freeform", "guided"):
            phase = "guided"
        reply = f"{leading_text}\n\n{question}".strip() if leading_text else question
        return reply, phase, None

    if tool_block.name == "submit_cad_spec":
        spec = dict(tool_input)
        reply = leading_text or "Here's the spec I've put together — review and approve below."
        return reply, "confirmation", spec

    # Unknown tool — degrade gracefully.
    logger.warning(f"Unknown tool_use name: {tool_block.name}")
    return leading_text or "(unrecognised response)", "freeform", None


def _claude_chat_call(messages: list[dict], client=None):
    """Single Claude chat call configured for tool use, caching, and compaction."""
    import anthropic

    _client = client or anthropic.Anthropic(
        api_key=ANTHROPIC_API_KEY,
        default_headers={"anthropic-beta": ANTHROPIC_BETA_HEADER},
    )

    return _client.messages.create(
        model=CHAT_MODEL,
        max_tokens=2048,
        temperature=0,
        system=_build_system_param(),
        tools=CAD_TOOLS,
        tool_choice={"type": "any"},  # force the model to call one of our tools
        messages=messages,
    )


# ---------------------------------------------------------------------------
# Streaming chat (SSE) — single tool-use round-trip, emitted as one done event.
# ---------------------------------------------------------------------------

async def chat_stream(
    task_id: str,
    content: str,
    images: list[str],
    design_intent: dict | None,
    redis: AsyncRedis,
) -> AsyncGenerator[str, None]:
    """Run one Claude turn and emit a 'done' SSE event with phase + spec.

    The frontend already consumes {type:"done", reply, phase, spec}. With tool
    use there is no incremental token stream — the model's structured output
    arrives as a single block — so we skip the {type:"token"} events.
    """
    history = await _load_history(redis, task_id)

    user_msg = {"role": "user", "content": content, "images": images}
    history.append(user_msg)

    claude_messages = _history_to_messages(history, design_intent)

    try:
        started = time.perf_counter()
        response = await asyncio.to_thread(
            _call_claude_with_retry, lambda: _claude_chat_call(claude_messages)
        )
        duration_ms = (time.perf_counter() - started) * 1000

        display_text, phase, spec = _interpret_tool_use(response)

        tool_called = None
        for block in response.content:
            if getattr(block, "type", None) == "tool_use":
                tool_called = block.name
                break
        _log_claude_call(task_id, response, duration_ms, tool_called)

        logger.info(
            f"[{task_id}] Complete — phase: {phase}, "
            f"reply: {len(display_text)} chars, has_spec: {spec is not None}"
        )

        assistant_msg = {"role": "assistant", "content": display_text}
        history.append(assistant_msg)
        await _save_history(redis, task_id, history)
        await _persist_to_db(task_id, history)

        yield json.dumps({
            "type": "done",
            "reply": display_text,
            "phase": phase,
            "spec": spec,
            "task_id": task_id,
        })

    except Exception as e:
        logger.error(f"[{task_id}] Stream error: {e}")
        yield json.dumps({"type": "error", "message": str(e)})


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

    started = time.perf_counter()
    response = await asyncio.to_thread(
        _call_claude_with_retry, lambda: _claude_chat_call(claude_messages)
    )
    duration_ms = (time.perf_counter() - started) * 1000

    display_text, phase, spec = _interpret_tool_use(response)

    tool_called = None
    for block in response.content:
        if getattr(block, "type", None) == "tool_use":
            tool_called = block.name
            break
    _log_claude_call(task_id, response, duration_ms, tool_called)

    assistant_msg = {"role": "assistant", "content": display_text}
    history.append(assistant_msg)
    await _save_history(redis, task_id, history)

    return {
        "task_id": task_id,
        "reply": display_text,
        "phase": phase,
        "spec": spec,
    }


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

    # 1. Structured spec as JSON (authoritative source of truth)
    blocks.append({
        "type": "text",
        "text": "## CONFIRMED DESIGN SPECIFICATION (authoritative — use these exact dimensions)\n\n" + json.dumps(spec, indent=2),
    })

    # 2. Manufacturing constraints (process + material)
    if design_intent:
        intent_text = _build_design_intent_block(design_intent)
        if intent_text:
            blocks.append({"type": "text", "text": f"\n## MANUFACTURING CONSTRAINTS\n{intent_text}"})

    # 3. Design conversation with images (for reference/context)
    if history:
        blocks.append({
            "type": "text",
            "text": (
                "\n## DESIGN CONVERSATION (reference — the spec above is authoritative)\n"
                "Use this conversation to understand spatial relationships, context, "
                "and design intent. Sketches/photos show approximate layout.\n"
            ),
        })
        for msg in history:
            role = "User" if msg["role"] == "user" else "Design Engineer"
            blocks.append({"type": "text", "text": f"**{role}:** {msg['content']}"})
            for img_b64 in msg.get("images", []):
                blocks.append(_make_image_block(img_b64))

    return blocks

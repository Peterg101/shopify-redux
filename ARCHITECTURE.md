# FITD CAD Generation — Architecture Document

Last updated: 19 April 2026

## System Overview

FITD is a manufacturing marketplace where users describe parts in natural language, the system generates 3D models (STEP files), and community manufacturers fulfil orders. This document covers the CAD generation pipeline specifically.

---

## Services

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────┐
│  Frontend    │────▶│  api_service     │     │ media_service  │
│  :3000       │     │  :8000           │     │ :1235          │
│              │────▶│                  │     │                │
│  React (web) │     │  Auth, orders,   │     │  STEP → glB    │
│  Expo (mob)  │     │  tasks, claims,  │     │  Thumbnails    │
│              │     │  files, events,  │     │  Multi-view    │
│              │     │  feedback        │     │  rendering     │
└──────┬───────┘     └────────┬─────────┘     └───────▲────────┘
       │                      │                        │
       │              ┌───────▼─────────┐              │
       └─────────────▶│ generation_svc  │──────────────┘
                      │ :1234           │
                      │                 │
                      │ Conversation    │     ┌──────────────┐
                      │ Classification  │────▶│ cad_sandbox   │
                      │ Structured ops  │     │ (Docker)      │
                      │ Direct code gen │     │ CadQuery exec │
                      │ Visual verify   │     └──────────────┘
                      └─────────────────┘
```

### api_service (port 8000)
- Core API: auth, users, orders, claims, files, Stripe, SSE events
- Stores tasks in PostgreSQL (task_id, cadquery_script, generation_prompt, conversation_history, geometry_metadata)
- **Verified examples table** (`verified_examples`) — user-approved generations + curated examples for retrieval
- **Feedback endpoint** (`POST /tasks/{taskId}/feedback`) — thumbs up/down on generated models
- Session cookies (web) / Bearer tokens (mobile)

### generation_service (port 1234)
- All CAD generation logic lives here
- Conversation chat (Claude tool_use)
- **Complexity classification** — routes SIMPLE shapes to structured path, COMPLEX to direct code gen
- Structured JSON ops generation + deterministic converter (18 operations)
- Direct CadQuery code generation (full language capability)
- **Scaffold approach** — placeholder ops filled by LLM
- Fix/retry loops with structured error diagnostics + API snippet RAG
- Visual verification via media_service
- SSE progress streaming to frontend
- **Example retrieval** — BM25 over curated JSON examples + verified DB examples (105+ total)

### media_service (port 1235)
- Receives STEP files, validates, extracts metadata (bbox, volume, surface area)
- Tessellates STEP → glTF/glB for web 3D preview
- Generates thumbnails (pyrender + OSMesa headless rendering)
- **Multi-view rendering** for visual verification (front, right, top, isometric)
- S3-compatible storage (MinIO in dev)

### cad_sandbox (Docker)
- Pre-built Docker image with CadQuery installed
- Runs LLM-generated Python scripts in complete isolation
- `--network=none`, `--memory=512m`, `--read-only`, non-root user
- Produces STEP files + metadata JSON
- Spun up per-execution, destroyed after

---

## The CAD Generation Pipeline

This is the core of the system. Here's every step, in order.

### Step 0: Conversation (gathering the spec)

**Files:** `generation_service/cad/conversation.py`, `cad/tools.py`

The user chats with Claude via the frontend CadChat component. Claude has two tools:

- `ask_clarification` — asks the user a question (returns phase: freeform or guided)
- `submit_cad_spec` — submits a structured specification (returns phase: confirmation)

`tool_choice: "auto"` — Claude can also reply with plain text for natural conversation.

The spec includes: `part_name`, `description`, `base_shape` (box/cylinder/cone/sphere/loft), `dimensions` (with shape-specific fields like `top_diameter`/`bottom_diameter` for cones), `features`, `hollow`, `wall_thickness`, `open_faces`, `process`, `material`.

The system prompt instructs Claude to always ask at least one clarifying question before submitting, focusing on spatial details the generator needs.

**On approve:** `spec_to_prompt()` converts the spec to a text description that preserves spatial intent (e.g., "Base shape: cone/taper, top diameter 50mm, bottom diameter 15mm"). This text goes to the generation pipeline.

**State storage:** Conversation history lives in Redis (with images, TTL 1 hour) and is persisted to Postgres (text + phase + spec metadata) after every turn.

### Step 1: Complexity Classification

**File:** `generation_service/cad/pipeline.py` → `_classify_complexity()`

A cheap Claude Sonnet call (~10 tokens): "Can this part be built from boxes, cylinders, and simple cuts? Reply SIMPLE or COMPLEX."

- **SIMPLE** → structured JSON ops path (Step 2a)
- **COMPLEX** → direct CadQuery code generation (Step 2b)

This determines the entire downstream path. A mounting bracket goes structured. A gear goes direct.

### Step 2a: Structured JSON Ops Path

**Files:** `cad/llm.py` → `generate_operations()`, `cad/converter.py`

#### 2a-i: Example retrieval

`_select_examples()` uses BM25 to find the 3 most relevant examples from the merged pool:
- **Curated JSON examples** — 67 examples across 18 category files in `cad/examples/`
- **Verified DB examples** — user-approved generations fetched from api_service (cached 5 min)
- **Weighting** — curated get 2x boost, verified weighted by `log(upvotes)`

#### 2a-ii: JSON generation

The LLM receives:
- The user's prompt (from `spec_to_prompt()`)
- Manufacturing constraints for the selected process
- 2-3 relevant few-shot examples
- The `JSON_SYSTEM_PROMPT` (defines all 18 operations, face selectors, profile types, and 2 full worked examples)

It outputs a JSON object with `parameters` (named dimensions) and `steps` (operation array).

#### 2a-iii: Pre-validation

`cad/prevalidator.py` → `validate_operations()` checks dimensional feasibility WITHOUT executing anything:
- Fillet radius vs edge length
- Shell thickness vs body size
- Profile fits on target face
- Cut depth vs body depth
- Hole diameter vs face dimensions
- Loft section count, sweep path validity

If issues found → sends them to `fix_operations()` for the LLM to repair the JSON.

#### 2a-iv: Conversion

`cad/converter.py` → `convert_json_to_cadquery()` deterministically converts JSON ops to CadQuery Python code. This is NOT an LLM call — it's a pure Python function.

**18 supported operations:**

| Category | Operations |
|----------|-----------|
| Base solids | `create_box`, `create_cylinder`, `create_sphere`, `loft`, `sweep`, `revolve` |
| Additive | `extrude_profile`, `union`, `mirror`, `pattern`, `intersect`, `split` |
| Subtractive | `cut_blind`, `cut_through`, `holes`, `shell` |
| Cosmetic | `fillet`, `chamfer` |
| Special | `placeholder` (filled by LLM in scaffold step) |

**Profile types:** `rect`, `rounded_rect`, `circle`, `polygon` (with aliases: triangle, hexagon, etc.), `slot`, explicit `points` polyline.

**Union/intersect body types:** `box`, `cylinder`, `sphere`, `cone`.

**Key features:**
- Automatic step reordering (base → additive → shell → subtractive → cosmetic)
- Supports both explicit `[x, y]` coordinates and constraint-based positioning
- Face tracking for constraint resolution
- Parameter references (`"$length"`) resolved to named variables
- Fillet/chamfer wrapped in try/except
- `.clean()` inserted before cosmetic ops
- Key alias resolution (`diameter` → `radius/2`, common naming variations)

If conversion fails → `fix_operations()` asks LLM to repair. If it fails twice → escalates to direct code gen (Step 2b).

#### 2a-v: Scaffold (optional)

If the converter output contains `# PLACEHOLDER` comments (from `placeholder` ops), `fill_scaffold_placeholders()` sends the partial CadQuery code to the LLM to fill in just the complex parts. The base geometry stays deterministic.

### Step 2b: Direct CadQuery Code Generation

**File:** `cad/llm.py` → `generate_cadquery_code()`

Used for COMPLEX shapes (gears, airfoils, organic forms) that can't be expressed as JSON ops.

The LLM receives:
- The user's prompt
- Manufacturing constraints
- **CadQuery API snippets** (`_select_api_snippets()` — BM25 over `cad/examples/cadquery_api.json`, 13 snippets covering loft, sweep, revolve, gears, threads, airfoils, spring clips, snap slots, etc.)
- The `SYSTEM_PROMPT` (290 lines covering CadQuery coding rules, reliable vs fragile operations, edge/face selection, coordinate systems, common patterns)

It outputs raw Python code using the full CadQuery API.

### Step 3: Sandboxed Execution

**File:** `cad/executor.py` → `execute_cadquery()`

1. **AST validation** — allowlisted imports only (cadquery, math, os, json), forbidden builtins (eval, exec, open, etc.)
2. **Validation suffix injection** — appends code that checks BRep validity, volume > 1mm³, dimensions < 1000mm, extracts metadata
3. **Docker execution** — `fitd-cad-sandbox` container with no network, 512MB memory, read-only filesystem, 60s timeout
4. **Output extraction** — reads STEP file + metadata JSON

### Step 4: Retry Loop

**File:** `cad/pipeline.py`

Up to `max_iterations` attempts (default 3). On failure:

- **Structured path:** `fix_operations()` — repairs JSON ops, re-converts, re-executes
- **Direct path:** `fix_cadquery_code()` — repairs code with:
  - `_parse_error_structured()` — converts raw OCCT tracebacks to actionable diagnostics
  - `_select_api_snippets()` — retrieves relevant CadQuery API reference for the failing operation
  - Full fix history (previous attempts so the LLM doesn't repeat failures)
  - Escalation strategy on later attempts

### Step 5: Upload + Visual Verification

**File:** `cad/pipeline.py`

1. **Register/update task** in api_service
2. **Save script + metadata**
3. **Upload STEP file** to media_service → returns `job_id`
4. **Visual verification** (when media_service render endpoint is working):
   - Calls `POST /step/{job_id}/render_views` on media_service
   - Gets base64 PNG images of 4 views (front, right, top, isometric)
   - Sends to Claude VLM: "Does this match the spec? PASS or FAIL?"
   - If FAIL: feeds feedback back to fix loop for one more attempt
5. **Mark task complete** → publish SSE: `"Task Completed,{task_id},{task_name},{job_id}"`

### Step 6: Frontend Display + Feedback

The frontend SSE listener receives "Task Completed", fetches the presigned GLB URL, loads the 3D viewer.

**Feedback loop:** A thumbs-up button appears on the completed model. On click:
- `POST /tasks/{taskId}/feedback` with `{rating: "up"}`
- api_service extracts prompt, ops, script from the task
- Auto-classifies category + complexity
- Computes geometry hash for deduplication
- Upserts into `verified_examples` table
- Future generations retrieve this as a few-shot example via BM25

---

## The Example Library

The system uses a two-tier example library for few-shot retrieval:

### Tier 1: Curated JSON examples (loaded from files)
**Location:** `generation_service/cad/examples/*.json`

67 examples across 18 category files:

| Category | Count | Examples |
|----------|-------|----------|
| plates | 2 | Mounting plate, circular adapter |
| brackets | 2 | L-bracket, U-bracket |
| enclosures | 2 | Electronics case, simple box |
| cylindrical | 2 | Standoff, flanged bushing |
| simple | 3 | Cube with hole, cylinder, counterbore block |
| tapered | 2 | Hollow funnel, solid reducer |
| gears | 2 | Spur gear, gear wheel with keyway |
| clips_fasteners | 4 | Cable clip, zip tie, wire guide, retaining clip |
| handles_knobs | 4 | Round knob, T-handle, D-handle, drawer pull |
| pipe_fittings | 4 | Elbow, tee, reducer, flange |
| phone_stands | 3 | Angled stand, tablet holder, desk stand |
| shelf_brackets | 3 | L-bracket, triangular, floating shelf |
| pcb_electronics | 5 | Standoff, DIN rail, Arduino mount, switch, battery |
| desk_office | 4 | Pen holder, tray, cable clip, monitor foot |
| mechanical | 5 | Pulley, roller, cam, snap-fit, timing belt |
| containers | 4 | Round jar, hex container, stackable bin, divided tray |
| hooks | 4 | Wall hook, S-hook, carabiner, coat hook |
| threaded | 4 | Nut trap, bolt head, wing nut, standoff |

### Tier 2: CadQuery API snippets (for error repair + direct code gen)
**Location:** `generation_service/cad/examples/cadquery_api.json`

13 snippets covering: loft, sweep, revolve, shell, fillet, boolean cut, polyline extrude, hole patterns, snap slots, involute gears, threads, spring clips, airfoils.

### Tier 3: Verified DB examples (from user feedback + seeded)
**Location:** `verified_examples` PostgreSQL table

~105 seeded examples including:
- All 67 curated JSON examples
- 38 direct CadQuery code examples (18 hand-written + 8 authentic from official CadQuery repos)
- Official repo examples: involute gear, parametric enclosure with split lid, snap-fit seam lip, resin mold, multi-section sweep, swept helix, Lego brick

Grows over time as users thumbs-up successful generations.

### Retrieval flow
```
User prompt
    │
    ▼
BM25 search over:
  ├── Curated JSON examples (from files, always loaded)
  ├── Verified DB examples (from api_service, cached 5 min)
  └── Weighted: curated × 2.0, verified × (1 + log(upvotes))
    │
    ▼
Top 3 examples injected into LLM prompt
```

---

## Decision Points (in order of execution)

```
1. CONVERSATION: tool_choice=auto
   ├── Claude replies with text → freeform conversation
   ├── Claude calls ask_clarification → guided question
   └── Claude calls submit_cad_spec → spec card shown

2. APPROVAL: User clicks "Approve & Generate"
   └── spec_to_prompt() converts spec to text

3. COMPLEXITY CLASSIFIER: "SIMPLE or COMPLEX?"
   ├── SIMPLE → structured JSON ops path
   └── COMPLEX → direct CadQuery code generation

4. STRUCTURED PATH (SIMPLE):
   ├── generate_operations() → JSON ops
   │   ├── ops.unsupported=true → escalate to DIRECT
   │   └── ops.error → fail
   ├── validate_operations() → pre-validation
   │   └── issues → fix_operations()
   ├── convert_json_to_cadquery() → CadQuery code
   │   ├── ValueError → fix_operations()
   │   └── fails twice → escalate to DIRECT
   └── has placeholders? → fill_scaffold_placeholders()

5. DIRECT PATH (COMPLEX):
   └── generate_cadquery_code() → raw CadQuery with API snippets

6. EXECUTION: Docker sandbox
   ├── success → continue
   └── failure → retry loop (up to 3 attempts)
       ├── structured: fix_operations() → re-convert → re-execute
       └── direct: fix_cadquery_code() with:
           ├── _parse_error_structured() (actionable diagnostics)
           └── _select_api_snippets() (relevant CadQuery reference)

7. VISUAL VERIFICATION:
   ├── PASS → continue
   └── FAIL → one more fix attempt with visual feedback

8. COMPLETION: upload STEP, mark complete, publish SSE
   └── User thumbs-up → verified_examples DB → future retrieval
```

---

## File Map

### generation_service/cad/

| File | Purpose | Key functions |
|------|---------|---------------|
| `conversation.py` | Chat with Claude, spec gathering | `chat_stream()`, `spec_to_prompt()`, `_interpret_tool_use()` |
| `tools.py` | Tool schemas for Claude | `SUBMIT_SPEC_TOOL`, `ASK_CLARIFICATION_TOOL` |
| `pipeline.py` | Main orchestrator | `generate_cad_task()`, `_classify_complexity()`, `refine_cad_task()` |
| `llm.py` | All LLM calls + retrieval | `generate_operations()`, `generate_cadquery_code()`, `fix_operations()`, `fix_cadquery_code()`, `verify_generation()`, `fill_scaffold_placeholders()`, `_select_examples()`, `_select_api_snippets()`, `_parse_error_structured()` |
| `converter.py` | JSON → CadQuery (deterministic) | `convert_json_to_cadquery()`, 21 `_emit_*` functions |
| `prevalidator.py` | Pre-execution geometry checks | `validate_operations()` |
| `executor.py` | Docker sandbox execution | `execute_cadquery()`, `validate_code()` |
| `validator.py` | Post-refinement validation | `validate_refinement()` |
| `suppressor.py` | Feature suppression | `suppress_features()`, `resolve_dependencies()` |
| `examples/` | Few-shot example library | 18 JSON files (67 examples) + `cadquery_api.json` (13 API snippets) |

### api_service

| File | Purpose |
|------|---------|
| `routes/tasks.py` | Task CRUD + feedback endpoint + verified examples retrieval |
| `alembic/versions/0009_add_verified_examples.py` | DB migration for example library |
| `seed_examples.py` | Seeds ~105 examples into verified_examples table |

### Frontend (shopify-redux/src/)

| File | Purpose |
|------|---------|
| `services/cadChatSlice.ts` | Redux state: messages, phase, taskId, currentSpec |
| `services/cadSlice.tsx` | Redux state: cadLoading, progress, settings, completedModel |
| `services/cadChatApi.ts` | API calls: startChatSession, sendChatMessageStreaming, confirmSpec |
| `services/progressStream.ts` | SSE progress listener, GLB fetching on completion |
| `services/authApi.tsx` | RTK Query endpoints including `submitFeedback` mutation |
| `features/display/cadChat/CadChat.tsx` | Main chat container with reset button |
| `features/display/cadChat/ChatBubble.tsx` | Message rendering |
| `features/display/cadChat/ChatInput.tsx` | Text input + image upload |
| `features/display/cadChat/SpecConfirmation.tsx` | Spec card with base_shape, rich dimensions, approve/edit |
| `features/display/CadGenerationSettings.tsx` | Process/material/size chip controls |
| `features/display/gltfScene.tsx` | Three.js GLB viewer (keyed by selectedFile for remount) |
| `features/display/toolBar.tsx` | File name, cost, clear, **thumbs-up button**, add to basket |
| `features/display/dropzone.tsx` | Upload area + task name header + CadChat layout |

### Mobile (mobile/src/)

| File | Purpose |
|------|---------|
| `store/cadSlice.ts` | Same as web cadSlice + completedModel |
| `store/cadChatSlice.ts` | Same as web cadChatSlice |
| `services/cadChatApi.ts` | Same as web but Bearer auth |
| `services/progressStream.ts` | AppState-based reconnect, presigned URL fetch |
| `services/api.ts` | RTK Query endpoints including `submitFeedback` |
| `components/cadChat/CadChat.tsx` | React Native chat container |
| `components/cadChat/ChatBubble.tsx` | RN message bubbles |
| `components/cadChat/ChatInput.tsx` | RN input + expo-image-picker |
| `components/cadChat/SpecCard.tsx` | RN spec confirmation card |
| `components/DesignSettings.tsx` | RN settings with bottom sheets |
| `components/ModelViewer.tsx` | WebView + Google model-viewer |
| `app/(tabs)/index.tsx` | Generate tab with CadChat + ModelViewer + **thumbs-up** |

---

## Data Flow

```
User message
    │
    ▼
[Conversation] ──── Claude Sonnet (tool_use: auto) ───▶ spec JSON
    │
    ▼
spec_to_prompt() ──▶ "Base shape: cone, top 50mm, bottom 15mm, height 60mm"
    │
    ▼
_classify_complexity() ──── Claude Sonnet (10 tokens) ───▶ SIMPLE / COMPLEX
    │                                                          │
    ▼                                                          ▼
[Structured Path]                                    [Direct Path]
    │                                                          │
    ├─ BM25 example retrieval (105+ pool)            ├─ API snippet retrieval
    ├─ generate_operations() ── Claude Opus          ├─ generate_cadquery_code() ── Claude Opus
    ├─ validate_operations()                         │
    ├─ convert_json_to_cadquery()                    │
    ├─ fill_scaffold_placeholders() (if needed)      │
    │                                                          │
    └────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
              execute_cadquery() ── Docker sandbox
                         │
                         ├── success ──▶ upload STEP ──▶ visual verify ──▶ complete
                         └── failure ──▶ retry with structured diagnostics + API snippets
                                                          │
                                                          ▼
                                              User sees 3D model
                                                          │
                                                    👍 thumbs up
                                                          │
                                                          ▼
                                              verified_examples DB
                                                          │
                                                          ▼
                                              Future BM25 retrieval
```

---

## LLM Calls Per Generation

| Call | Model | Purpose | Cost estimate |
|------|-------|---------|---------------|
| 1-3 chat turns | Sonnet | Conversation (spec gathering) | ~$0.01-0.03 |
| 1 classifier | Sonnet | SIMPLE/COMPLEX routing | ~$0.001 |
| 1 generation | Opus | JSON ops or CadQuery code | ~$0.03-0.10 |
| 0-2 fixes | Opus | Repair failed code/ops | ~$0.03-0.06 each |
| 0-1 scaffold | Opus | Fill placeholder features | ~$0.03-0.05 |
| 0-1 visual verify | Sonnet | Check rendered output | ~$0.02-0.05 |
| **Total** | | | **~$0.05-0.30 per generation** |

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `CAD_PROVIDER` | `ollama` | `ollama` or `anthropic` |
| `ANTHROPIC_API_KEY` | — | Required for `anthropic` provider |
| `CAD_MODEL` | `claude-opus-4-20250514` | Model for code/ops generation |
| `CAD_CHAT_MODEL` | `claude-sonnet-4-5` | Model for conversation |
| `CAD_VERIFY_MODEL` | `claude-sonnet-4-5` | Model for visual verification |
| `MOCK_GENERATION` | `false` | Skip real LLM calls |
| `CAD_SANDBOX_IMAGE` | `fitd-cad-sandbox:latest` | Docker image for execution |
| `CAD_TIMEOUT` | `60` | Execution timeout (seconds) |
| `API_SERVICE_URL` | `http://api_service:8000` | Inter-service URL |
| `STEP_SERVICE_URL` | `http://localhost:1235` | Media service URL |

---

## Database: verified_examples

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | |
| `task_id` | string, nullable | Link to source task |
| `user_id` | string, nullable | Who contributed |
| `description` | text | Natural language prompt |
| `keywords` | text (JSON array) | For BM25 retrieval |
| `category` | string, indexed | bracket, enclosure, gear, organic, etc. |
| `complexity` | string | simple, medium, complex |
| `source` | string | curated, user, imported, bootstrapped |
| `parameters` | text (JSON) | Parameter dict (structured path) |
| `steps` | text (JSON) | JSON ops array (structured path) |
| `cadquery_script` | text | Working CadQuery code (direct path) |
| `generation_path` | string | structured or direct |
| `upvotes` | int | Positive feedback count |
| `downvotes` | int | Negative feedback count |
| `is_active` | bool | Soft-delete when downvotes >= upvotes |
| `is_curated` | bool | True for hand-verified examples |
| `geometry_hash` | string, indexed | Structural dedup fingerprint |
| `op_count` | int | Number of operations |
| `created_at` | timestamp | |

---

## What's Not Built Yet

- **Visual verification endpoint fix** — `POST /step/{job_id}/render_views` returns 500 (media_service bug)
- **Embeddings/pgvector** — upgrade from BM25 when example library grows past ~500
- **Assembly support** — multi-body parts with mating constraints
- **Bootstrapping script** — batch-generate 50+ examples to expand the library
- **Thumbs-down UI** — currently only thumbs-up is exposed; downvote logic exists in the API
- **Per-user example privacy** — currently all examples are shared

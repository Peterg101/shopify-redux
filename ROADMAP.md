# FITD — Technical Roadmap

## Where We Are (April 2026)

A working CAD generation platform with:
- Conversational spec gathering (Claude tool_use)
- Dual generation paths (structured JSON ops + direct CadQuery code)
- Complexity classifier routing between paths
- Stepwise builder (generate feature-by-feature with user approval)
- In-browser CadQuery code editor
- 105+ verified example library with BM25 retrieval
- Feedback flywheel (user thumbs-up → retrieval library)
- Subscription billing (free/pro/enterprise with credit-based gating)
- Feature-flagged manufacturing marketplace (hidden for initial launch)
- Mobile app with full CAD chat
- Visual verification (render → VLM check → auto-fix)

**Core limitation**: LLMs can't reliably do 3D spatial math. Simple parts (~90% success), complex multi-feature parts (~40-70%).

---

## The 5-Layer Improvement Plan

### Layer 1: Constraint-Based Positioning ← START HERE
**Impact: Highest | Effort: 2-3 days | Cost: $0**

Replace absolute coordinate positioning with constraint expressions. Instead of the LLM guessing `translate((20, 15, 0))`, it says `flush_to(face=">Y", offset=0)` and a solver computes the coordinates.

CadQuery already has an assembly constraint solver (Point, Axis, Plane, PointInPlane). Extend `converter.py` to use it.

This eliminates the entire class of "features in wrong position" bugs — the #1 failure mode.

### Layer 2: Embedding-Based Example Retrieval
**Impact: High | Effort: 1-2 weeks | Cost: $0**

Replace BM25 keyword matching with semantic embedding search. When a user asks for "a phone mount for a bike handlebar", the system finds the most semantically similar examples — not just keyword overlaps.

Use `pgvector` (Postgres extension) + `sentence-transformers` for embeddings. Already have 105+ examples in the database.

### Layer 3: Standard Parts Library + RAG
**Impact: High | Effort: 2-3 weeks | Cost: $0**

Build a library of 50-100 parametric standard parts:
- Fasteners (M2-M12 bolts, nuts, washers per ISO standards)
- Electronics enclosures (Raspberry Pi, Arduino, generic PCB)
- Bearings, bushings, standoffs
- Brackets, flanges, pipe fittings

When a user asks for something that matches a standard part, retrieve the template and modify parameters. Much more reliable than generating from scratch.

### Layer 4: Fine-Tuned Model (When Revenue Justifies It)
**Impact: Medium-High | Effort: 2-4 weeks | Cost: ~$360/month serving**

Deploy an existing fine-tuned CadQuery model (`ricemonster/qwen2.5-3B-SFT`) alongside Claude. Route simple parts to the fine-tuned model (faster, cheaper, potentially more reliable for common shapes) and complex/unusual parts to Claude.

Available datasets for custom training:
- Text-to-CadQuery: 170K pairs
- CAD-Recode: 1M sequences
- Your own verified generations (growing via feedback flywheel)

### Layer 5: Tool-Using Agent (Premium Feature)
**Impact: Highest Quality | Effort: 1-2 months | Cost: ~5-10x per generation**

Instead of generating a complete script, the AI uses individual CadQuery tools one at a time with visual feedback after each operation. Like a human using CAD software, but automated.

Study `reyem/blok` — an open-source MCP server that exposes CadQuery as 28 individual tools with persistent session state and visual feedback.

This is the premium tier feature — slower and more expensive, but dramatically more reliable for complex parts.

---

## Reading List

### Papers (in priority order)
1. **CAD-Recode** (arxiv 2412.14042) — How to generate synthetic CadQuery training data at scale
2. **Text-to-CadQuery** (arxiv 2505.06507) — The 170K dataset and how it was built
3. **AIDL: Solver-Aided Language** (arxiv 2502.09819) — Constraint solver + LLM architecture
4. **ToolCAD** (arxiv 2604.07960) — Tool-using CAD agent with RL
5. **DeepCAD** (arxiv 2105.09492) — Foundational sketch-extrude representation

### Open Source Projects
- **`reyem/blok`** — CadQuery as MCP tools (28 tools, session state, visual feedback). Blueprint for Layer 5.
- **`filaPro/cad-recode`** — Point cloud → CadQuery model. Study `demo.ipynb`.
- **`gilfoyle19/prompt2CAD`** — Data generation scripts for CadQuery training pairs.
- **`xupeiwust/LLM2CQ`** — Training-free Planner → Environment → Tools agent.

### Key Datasets (HuggingFace)
- `ricemonster/qwen2.5-3B-SFT` — Fine-tuned model ready to deploy
- `filapro/cad-recode-v1.5` — 1M CadQuery sequences
- `ThomasTheMaker/cadquery` — 147K image-code pairs

---

## Cost Analysis

| Phase | Dev Time | Monthly Cost | Revenue Needed |
|-------|----------|-------------|----------------|
| Layer 1 (Constraints) | 2-3 days | $0 | None |
| Layer 2 (Embeddings) | 1-2 weeks | $0 | None |
| Layer 3 (Parts Library) | 2-3 weeks | $0 | None |
| Layer 4 (Fine-tuned Model) | 2-4 weeks | ~$360/month | ~£50+/month from users |
| Layer 5 (Tool Agent) | 1-2 months | ~$0 additional | Premium tier users |

---

## Alternative Product Direction: Agentic Build Planner

Instead of (or alongside) improving generation quality, pivot to an AI project orchestrator:

1. User describes a project ("build a surveillance drone with 30 min flight time")
2. Agent researches components (motors, flight controllers, batteries)
3. Sources commercial parts (Amazon, DigiKey) via affiliate links
4. Identifies custom parts that need manufacturing
5. Routes custom parts to FITD marketplace fulfillers
6. CAD generation only handles simple adapters/brackets (within capability ceiling)

This turns the generation quality limitation into a feature — the AI finds existing solutions first, only generates when necessary.

See memory: `project_agentic_build_planner.md` for full details.

---

## Strategic Insight

> The gap between where you are and "gold standard" is not architecture — it's data. Every layer ultimately improves either (1) the quality of what the LLM generates, or (2) the context the LLM receives. The cheapest improvements are all about context.

The current system is already more sophisticated than 90% of published academic work. The architecture is sound. Focus on constraint-based positioning (eliminates coordinate errors), better retrieval (better examples → better output), and standard parts (avoid generating what already exists).

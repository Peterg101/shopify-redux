# FITD Platform — Claude Code Instructions

## Project Overview
FITD is a decentralised manufacturing marketplace. Buyers upload or generate 3D models (STL, OBJ, STEP), place orders via Stripe, and community fulfillers claim and manufacture them. The platform also offers AI-powered CAD generation and a community file-sharing library.

Built by a solo developer with a PhD in Materials Science, two Chemistry degrees, and professional experience across software engineering and manufacturing in the defence industry. This domain expertise directly informs the platform's quoting logic, material specifications, manufacturability constraints, and process selection — these are engineering decisions, not guesswork.

### Product Scope
- **Target processes**: All major manufacturing (3D printing, CNC, injection moulding, sheet metal, casting). Launch priority is 3D printing/additive — simplest quoting, fastest turnaround, easiest to onboard operators.
- **File formats**: STL (hobbyist/3D printing), OBJ (mesh, broad compatibility), STEP (industry-standard parametric, professional engineering).
- **Competitive landscape**: Zoo.dev is the only comparable player with AI CAD generation. Most manufacturing marketplaces are pure matchmaking with no generative layer. The combination of community file sharing + AI generation + manufacturing fulfilment is genuinely differentiated.
- **Current state**: Functional with bugs. Only deployed locally, never in production. Core flow works: upload → quote → pay → manufacturer fulfils.

### AI CAD Generation Pipeline
The most technically distinctive feature. Flow:
1. User provides natural language description of a desired part
2. LLM generates a Python CadQuery script (constrained for manufacturability — min wall thickness, fillet radii, overhang limits, unit conventions)
3. Script executes in a **fully sandboxed Docker container** (arbitrary code execution isolation)
4. `step_service` validates the STEP output, extracts metadata (bounding box, volume, surface area), tessellates to glTF/glB
5. Result returned to frontend for 3D preview

**LLM config**: env var switches between local Qwen 2.5 7B (poor CadQuery quality — niche library, insufficient training data) and Claude API (dramatically better, recommended for production, pennies per generation).

## Architecture

### Services
| Service | Port | Purpose |
|---------|------|---------|
| `db_service` | 8000 | Core API — users, orders, claims, files, disputes |
| `auth_backend` | 2468 | Google OAuth + email auth, Redis sessions |
| `meshy_backend` | 1234 | Meshy.ai 3D generation (artistic/organic), WebSocket progress |
| `cad_service` | 1236 | AI CAD generation — LLM → CadQuery → STEP, sandboxed execution |
| `step_service` | 1235 | STEP processing — validation, metadata, tessellation to glTF/glB, S3 |
| `stripe_service` | 100 | Stripe checkout, webhooks, onboarding, shipping |
| `shopify-redux` | 3000 | React 18 frontend — MUI, Redux Toolkit, Three.js |

**Two distinct 3D generation pipelines** (complementary, not redundant):
- `meshy_backend` (Meshy.ai API): artistic/organic models — figurines, characters, decorative → OBJ meshes
- `cad_service` (LLM + CadQuery): engineering-grade parametric geometry — functional parts, enclosures, brackets → STEP files

### Shared Packages
- `fitd_schemas/` — SQLAlchemy models + Pydantic response classes (installed editable)
- `jwt_auth/` — HS256 JWT generation/verification for inter-service auth

### Key Dependency Versions

| Layer | Package | Version | Notes |
|-------|---------|---------|-------|
| **Backend** | Pydantic | **1.10.8** | v1 — uses `class Config:`, `.dict()`, `@validator`, `.from_orm()`. Do NOT use v2 patterns |
| | SQLAlchemy | 2.0.46 | |
| | FastAPI | 0.112.2 | |
| | httpx | 0.28.1 | |
| | stripe | 14.3.0 | |
| | redis | 7.2.0 | |
| | Python | 3.11 | |
| **Frontend** | React | ^18.2.0 | |
| | TypeScript | ^5.7.3 | |
| | MUI | ^5.16.7 | |
| | RTK | ^2.2.8 | |
| | react-redux | ^9.1.1 | |
| | MSW | ^2.12.10 | v2 — uses `http.*` / `HttpResponse`, not `rest.*` |
| | Three.js | ^0.163.0 | |
| | @react-three/fiber | ^8.17.10 | |

### Inter-Service Auth
Services call each other using JWT Bearer tokens via `jwt_auth.generate_token()`. Frontend authenticates via HttpOnly session cookies managed by `auth_backend` + Redis.

## Workflow Preferences

### Commits
- **Auto-commit** after completing a feature or fix. Use descriptive messages.
- **Always ask** before pushing to remote.
- Never amend existing commits — always create new ones.

### Planning
- **Always enter plan mode** for non-trivial tasks before writing code.
- For single-line fixes or obvious bugs, just execute.

### Communication
- **Detailed updates** — explain reasoning, tradeoffs, and decisions as you go.
- Lead with what changed and why.

## Development Commands

```bash
# Start all services
./start-dev.sh

# Stop all services
./start-dev.sh stop

# Backend tests (db_service)
cd db_service && python -m pytest tests/ --import-mode=importlib -v

# Frontend tests
cd shopify-redux && CI=true npx react-scripts test --watchAll=false

# TypeScript check
cd shopify-redux && npx tsc --noEmit

# Install shared packages (after schema changes)
pip install -e ./fitd_schemas && pip install -e ./jwt_auth
```

## Key File Locations

### Backend
- **DB models (SQLAlchemy):** `fitd_schemas/fitd_schemas/fitd_db_schemas.py`
- **Pydantic models:** `fitd_schemas/fitd_schemas/fitd_classes.py`
- **Main API:** `db_service/main.py`
- **Auth utils:** `fitd_schemas/fitd_schemas/auth_utils.py`
- **Test fixtures:** `db_service/conftest.py`
- **Migrations:** `db_service/alembic/`

### Frontend
- **TypeScript interfaces:** `shopify-redux/src/app/utility/interfaces.ts`
- **API calls:** `shopify-redux/src/services/fetchFileUtils.tsx`
- **Redux store:** `shopify-redux/src/app/store.ts`
- **RTK Query (auth):** `shopify-redux/src/services/authApi.tsx`
- **Routes:** `shopify-redux/src/features/userInterface/AppRouter.tsx`
- **MSW handlers:** `shopify-redux/src/test-utils/mswHandlers.ts`
- **Mock data:** `shopify-redux/src/test-utils/mockData.ts`

## Best Practices References
Before writing code, consult the relevant best-practices file in memory/:
- **Frontend:** `best-practices-frontend.md` — React 18, RTK Query 2.x, MUI 5, React Three Fiber, Jest/RTL/MSW 2.x
- **Backend:** `best-practices-backend.md` — FastAPI, SQLAlchemy 2.x, Pydantic v1 (NOT v2), pytest, async Python

These contain specific DO/DON'T rules with code examples for every technology in this stack.

## Coding Standards

### Python (Backend)
- FastAPI with type hints everywhere
- Pydantic for request/response validation
- SQLAlchemy ORM — never raw SQL
- All new endpoints need test coverage in `db_service/tests/`
- Use `HTTPException` for errors with meaningful detail messages
- Auth dependencies: `cookie_verification_user_only` (user endpoints), `verify_jwt_token` (inter-service)

### TypeScript (Frontend)
- Functional components with hooks only — no class components
- MUI for all UI — follow the existing dark theme with cyan (#00E5FF) accent
- Redux Toolkit + RTK Query for state and API calls
- Interfaces in `interfaces.ts`, not inline types
- New API functions go in `fetchFileUtils.tsx`
- Tests use `renderWithProviders` + MSW handlers

### Styling
- Dark theme — background #0A0E14, paper surfaces with glassmorphism
- Accent color: cyan #00E5FF
- Use MUI `sx` prop, not CSS files
- Consistent border-radius: 3 for cards/papers
- Use `<Chip>` for status indicators with phase-matched colors

## Testing Rules

### Backend
- In-memory SQLite with StaticPool — see `conftest.py`
- Two test users: `client` (buyer, test-user-123) and `claimant_client` (fulfiller, claimant-user-456)
- **PITFALL:** Both fixtures share `app.dependency_overrides`. Use `set_auth_as_buyer()`/`set_auth_as_claimant()` for role-switching within a single test.
- Always run full test suite after changes: all tests must pass.

### Frontend
- Jest + React Testing Library + MSW
- 3 test suites have pre-existing parse failures (Three.js ESM/Jest issue) — these are known and not regressions.
- Run with `CI=true` to avoid interactive watch mode.

## Known Pre-Existing Issues
These are NOT regressions — do not spend time trying to fix them unless explicitly asked:
1. **3 Jest test suites fail** due to Three.js ESM import in Jest (OBJLoader/STLLoader). Affects: `claimedItems.test.tsx`, `fulfillPage.test.tsx`, `App.test.tsx`. All 92 actual tests pass.
2. **`useSyncTotalCost.test.ts`** has a TS error (`children` missing on Provider props) — pre-existing, does not affect runtime or other tests.
3. **`stripe_service/`** uses synchronous `stripe.*` SDK calls inside async endpoints (e.g., `stripe.checkout.Session.create`). This is a known limitation — the Stripe Python SDK is synchronous. The proper fix would be `await asyncio.to_thread(...)` but this is low-priority for a low-volume service.
4. **`auth_backend/main.py`** calls `id_token.verify_oauth2_token()` (Google auth) synchronously inside an async endpoint — same pattern, no async equivalent in the Google library.

## Domain Model — Claim Lifecycle
```
pending → in_progress → printing → qa_check → shipped → delivered → accepted/disputed → resolved_*
                                                                                         ↘ cancelled (from pending or in_progress only)
```

## Deployment & Production Readiness

Never deployed to production — currently local-only via Docker Compose. Target: VPS (Hetzner/DigitalOcean) with Traefik for reverse proxy + SSL. 4GB RAM / 2 vCPU sufficient when using Claude API (no local model inference).

### Production checklist
- [ ] Add Traefik service to Docker Compose (SSL via Let's Encrypt, route to microservices)
- [ ] Google OAuth: add production domain as authorised redirect URI
- [ ] Stripe: update webhook endpoint URLs to production domain
- [ ] CORS: update all microservices to allow production domain
- [ ] React: update API base URL from localhost
- [ ] Production `.env` with real keys (Stripe, Google OAuth, Claude API, ShipStation)
- [ ] LLM env var: set to Claude API mode
- [ ] File storage: Docker volumes + backup cron initially; migrate to S3/Backblaze later

### Immediate priorities
1. Deploy to production
2. Switch AI to Claude API (drop local Qwen)
3. Fix bugs blocking core transaction flow
4. Onboard 3-5 3D printing manufacturers
5. Get one real order through the system end-to-end

## Parallel Agent Strategy

When working on cross-cutting changes, split by **file ownership** to avoid conflicts:

| Workstream | Files |
|------------|-------|
| Backend | `db_service/main.py`, `db_service/tests/`, `fitd_schemas/` |
| Frontend infra | `interfaces.ts`, `fetchFileUtils.tsx`, `authApi.tsx`, utility files |
| Feature UI | Feature-specific components (e.g., `updateClaimStatus.tsx`) |
| Shared components | Card components, shared panels, viewer components |

Never have two agents modify the same file. Always run tests after all agents complete.

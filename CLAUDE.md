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
3. Script executes in a **fully sandboxed Docker container** (`cad_sandbox` — arbitrary code execution isolation)
4. `media_service` validates the STEP output, extracts metadata (bounding box, volume, surface area), tessellates to glTF/glB, generates server-side thumbnails
5. Result returned to frontend for 3D preview

**LLM config**: `CAD_PROVIDER` env var switches between `ollama` (local Qwen 2.5 7B — poor CadQuery quality) and `anthropic` (Claude API — dramatically better, recommended for production). Mock mode available via `MOCK_GENERATION=true`.

## Architecture

### Services (3 backend + frontend + infra)
| Service | Port | Purpose |
|---------|------|---------|
| `api_service` | 8000 | Core API — auth, users, orders, claims, files, disputes, Stripe, fulfiller profiles, catalog, SSE events |
| `generation_service` | 1234 | AI 3D generation — Meshy.ai (artistic) + LLM/CadQuery (engineering), SSE progress streaming |
| `media_service` | 1235 | STEP processing — validation, metadata, tessellation to glTF/glB, thumbnail generation (pyrender+OSMesa), S3 storage |
| `frontend` | 3000 | React 18 — MUI, Redux Toolkit, RTK Query, Three.js |

**Two distinct 3D generation pipelines** (complementary, not redundant):
- Meshy.ai API: artistic/organic models — figurines, characters, decorative → OBJ meshes
- LLM + CadQuery: engineering-grade parametric geometry — functional parts, enclosures, brackets → STEP files

### Infrastructure (Docker Compose)
| Service | Purpose |
|---------|---------|
| `postgres` | PostgreSQL 16 — primary database |
| `redis` | Redis 7 — sessions, L2 cache, pub/sub for SSE, generation progress state |
| `minio` | S3-compatible object storage (dev) — 3D files, thumbnails |
| `ollama` | Local LLM inference (optional, for CAD generation) |
| `cad_sandbox` | Pre-built Docker image for sandboxed CadQuery script execution |

### Shared Packages
- `fitd_schemas/` — SQLAlchemy models + Pydantic response classes (installed editable)
- `jwt_auth/` — HS256 JWT generation/verification for inter-service auth (with `aud`/`iss` claims, 5-minute expiry)

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

### Auth System
- **Frontend → API**: HttpOnly session cookies (`fitd_session_data`) → Redis session lookup via `get_current_user` dependency
- **Service → Service**: JWT Bearer tokens via `jwt_auth.generate_token(audience="target_service")`
- **OAuth providers**: Google, GitHub (with account linking via `UserOAuthAccount` table)
- **Email auth**: bcrypt-hashed passwords, email verification via Resend, password reset with JWT tokens
- **Rate limiting**: SlowAPI on auth endpoints (login, register, forgot-password)

### Data Flow
- **Session model**: Slim session (user + flags) via `GET /session`, focused endpoints for basket/orders/claims/tasks
- **Caching**: L1 (cachetools.TTLCache for static data) + L2 (Redis) cache-aside pattern in `api_service/cache.py`
- **Real-time updates**: SSE via `GET /events` — Redis pub/sub pushes invalidation events, frontend maps to RTK Query tag invalidations
- **Generation progress**: SSE via `GET /progress/{port_id}` on generation_service — Redis-cached state persists across page refresh

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
# Start all services (Docker)
docker compose up --build

# Start with mock generation (no real AI calls)
MOCK_GENERATION=true docker compose up --build

# Rebuild specific service
docker compose up --build --force-recreate api_service

# Stop all services
docker compose down

# Backend tests (api_service — 221+ tests)
cd api_service && python -m pytest tests/ --import-mode=importlib -v

# Frontend tests
cd shopify-redux && CI=true npx react-scripts test --watchAll=false

# TypeScript check
cd shopify-redux && npx tsc --noEmit

# Install shared packages (after schema changes)
pip install -e ./fitd_schemas && pip install -e ./jwt_auth

# Run Alembic migrations
cd api_service && alembic upgrade head

# Seed test data (includes test accounts)
cd api_service && python seed_dummy_data.py
```

### Test Accounts (from seed data)
| Email | Password | Role |
|-------|----------|------|
| `buyer@test.fitd.dev` | `TestBuyer123!` | Buyer (email pre-verified) |
| `fulfiller@test.fitd.dev` | `TestFulfiller123!` | Fulfiller (email pre-verified) |

## Key File Locations

### Backend — api_service
- **Entry point:** `api_service/main.py` — lifespan, CORS, security headers, rate limiting, router includes
- **Dependencies (DI):** `api_service/dependencies.py` — `get_current_user`, `require_verified_email`, `get_db`, `get_redis`, `get_media_client`
- **Config:** `api_service/config.py` — environment-aware settings
- **Cache layer:** `api_service/cache.py` — L1/L2 cache-aside with `cached()`, `cache_invalidate()`
- **SSE events:** `api_service/events.py` — `publish_event()` via Redis pub/sub
- **Rate limiting:** `api_service/rate_limit.py` — shared SlowAPI limiter
- **Stripe utils:** `api_service/stripe_utils.py` — webhook validation, Connect helpers
- **Helpers:** `api_service/helpers.py` — `_order_to_response()`, `check_and_auto_resolve()`
- **Routes (12 files):** `api_service/routes/` — auth, users, files, orders, claims, disbursements, disputes, fulfiller, catalog, tasks, events, stripe
- **Tests:** `api_service/tests/`
- **Test fixtures:** `api_service/conftest.py`
- **Migrations:** `api_service/alembic/`
- **Seed data:** `api_service/seed_dummy_data.py`

### Backend — Shared
- **DB models (SQLAlchemy):** `fitd_schemas/fitd_schemas/fitd_db_schemas.py`
- **Pydantic models:** `fitd_schemas/fitd_schemas/fitd_classes.py`
- **JWT auth:** `jwt_auth/jwt_auth/jwt_auth.py`

### Backend — generation_service
- **Entry point:** `generation_service/main.py` — SSE progress endpoint, mock generation endpoint
- **Shared utils:** `generation_service/shared.py` — Redis progress caching, task lifecycle

### Backend — media_service
- **STEP processing, thumbnail generation, S3 storage**

### Frontend
- **TypeScript interfaces:** `shopify-redux/src/app/utility/interfaces.ts`
- **API calls:** `shopify-redux/src/services/fetchFileUtils.tsx`
- **Redux store:** `shopify-redux/src/app/store.ts`
- **RTK Query (auth):** `shopify-redux/src/services/authApi.tsx` — slim session, basket, orders, claims, tasks
- **SSE listener:** `shopify-redux/src/services/sseListener.ts` — data invalidation events → RTK Query tags
- **SSE progress:** `shopify-redux/src/services/progressStream.ts` — generation progress streaming
- **Routes:** `shopify-redux/src/features/userInterface/AppRouter.tsx`
- **Auth pages:** `shopify-redux/src/features/auth/` — VerifyEmailBanner, ForgotPassword, ResetPassword, VerifyEmail
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
- Pydantic v1 for request/response validation — `class Config: orm_mode = True`, `.dict()`, `@validator`, `.from_orm()`
- SQLAlchemy ORM — never raw SQL
- All new endpoints need test coverage in `api_service/tests/`
- Use `HTTPException` for errors with meaningful detail messages
- **Auth dependencies** (from `dependencies.py`):
  - `get_current_user` — standard authenticated endpoints (returns `User` SQLAlchemy model)
  - `require_verified_email` — sensitive operations: checkout, claiming, file uploads
  - `verify_jwt_token` — inter-service calls from generation_service/media_service
- **Circular ORM prevention**: All child→parent relationships use `lazy="noload"`. Use `selectinload()` explicitly where needed. Serialize orders via `_order_to_response()` helper.

### TypeScript (Frontend)
- Functional components with hooks only — no class components
- MUI for all UI — follow the existing dark theme with cyan (#00E5FF) accent
- Redux Toolkit + RTK Query for state and API calls
- Interfaces in `interfaces.ts`, not inline types
- New API functions go in `fetchFileUtils.tsx`
- Tests use `renderWithProviders` + MSW handlers

### Styling
- Dark theme — background #0A0E14, paper surfaces with glassmorphism (rgba(19,25,32,0.85) + backdrop-filter blur)
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
3. **Stripe SDK sync calls in async endpoints**: Stripe Python SDK is synchronous. The proper fix would be `await asyncio.to_thread(...)` but this is low-priority for a low-volume service.
4. **Google OAuth sync call**: `id_token.verify_oauth2_token()` is synchronous inside an async endpoint — no async equivalent in the Google library.

## Domain Model — Claim Lifecycle
```
pending → in_progress → printing → qa_check → shipped → delivered → accepted/disputed → resolved_*
                                                                                         ↘ cancelled (from pending or in_progress only)
```

## Deployment & Production Readiness

Never deployed to production — currently local-only via Docker Compose. Target: VPS (Hetzner/DigitalOcean) with Traefik for reverse proxy + SSL. 4GB RAM / 2 vCPU sufficient when using Claude API (no local model inference).

### Production checklist
- [ ] Add Traefik service to Docker Compose (SSL via Let's Encrypt, route to services)
- [ ] Buy domain, configure DNS, set up email verification via Resend with verified domain
- [ ] Google OAuth: add production domain as authorised redirect URI
- [ ] GitHub OAuth: update callback URL to production domain
- [ ] Stripe: update webhook endpoint URLs to production domain
- [ ] CORS: update `FRONTEND_URL` env var to production domain
- [ ] React: update `REACT_APP_*` build args to production URLs
- [ ] Production `.env` with real keys (Stripe, Google OAuth, GitHub OAuth, Claude API, Resend, ShipStation)
- [ ] LLM env var: set `CAD_PROVIDER=anthropic`
- [ ] File storage: MinIO → S3/Backblaze for production

### Immediate priorities
1. Deploy to production
2. Switch AI to Claude API (drop local Qwen)
3. Fix remaining bugs
4. Onboard 3-5 3D printing manufacturers
5. Get one real order through the system end-to-end

## Parallel Agent Strategy

When working on cross-cutting changes, split by **file ownership** to avoid conflicts:

| Workstream | Files |
|------------|-------|
| Backend | `api_service/main.py`, `api_service/routes/`, `api_service/tests/`, `fitd_schemas/` |
| Frontend infra | `interfaces.ts`, `fetchFileUtils.tsx`, `authApi.tsx`, `sseListener.ts`, utility files |
| Feature UI | Feature-specific components (e.g., `FulfillerSettingsPanel.tsx`) |
| Shared components | Card components, shared panels, viewer components |

Never have two agents modify the same file. Always run tests after all agents complete.

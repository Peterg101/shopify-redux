# FITD Platform Architecture

## Overview

FITD is a 3D printing and manufacturing fulfillment marketplace. Buyers upload or generate 3D models, configure manufacturing options, place orders via Stripe, and fulfillers claim and manufacture them. The platform runs as a microservices architecture with a React frontend.

## Service Map

```
                                    [Browser]
                                       |
                              [shopify-redux :3000]
                             /    |     |     \    \
                            /     |     |      \    \
                  [auth_backend] [db_service] [meshy_backend] [cad_service] [step_service]
                     :2468         :8000         :1234           :1236         :1235
                       |             |              |               |            |
                    [Redis]      [PostgreSQL]   [Meshy.ai API]  [Ollama/LLM]  [MinIO/S3]
                    Sessions     Main DB        External API    Local LLM     File Storage
                                                               [Sandbox]
                                                               CadQuery Exec
```

## Services

### db_service (Port 8000)
**Core API** — Users, orders, claims, tasks, files, disputes, manufacturing, fulfiller profiles.

- **Framework:** FastAPI + SQLAlchemy 2.0 + PostgreSQL
- **Auth:** JWT verification for inter-service calls, session cookie verification for user-facing endpoints
- **Key endpoints:**
  - `GET /users/{user_id}` — user hydration (tasks, orders, claims, basket, profile)
  - `POST /orders/create_from_stripe_checkout` — order creation from Stripe
  - `POST /tasks` — register new tasks (from meshy_backend or cad_service)
  - `PATCH /tasks/{task_id}/complete` — mark task complete
  - `POST /claims` — fulfiller claims an order
  - `PATCH /claims/{claim_id}/status` — claim lifecycle transitions
  - `GET /manufacturing/processes` — available manufacturing processes
  - `GET /manufacturing/materials` — materials filtered by process family
  - `GET /file_storage/{task_id}` — serves Meshy OBJ/STL files from disk
- **File storage:** Meshy files stored on disk at `uploads/`; CAD files stored in MinIO via step_service

### auth_backend (Port 2468)
**Authentication** — Google OAuth + email/password auth with Redis session management.

- **Session management:** HttpOnly cookies (`fitd_session_data`) backed by Redis
- **Endpoints:** `/google_login`, `/login`, `/register`, `/get_session`, `/logout`
- **Session data stored in Redis:** `user_id`, `email`, `name`, `avatar_url`

### meshy_backend (Port 1234)
**Meshy.ai 3D Generation** — Text-to-3D and image-to-3D via external Meshy.ai API.

- **WebSocket:** `/ws/{port_id}` — real-time progress updates during generation
- **Pipeline:** Prompt → Meshy API → Poll for completion → Download OBJ+MTL → Upload to db_service → Register task
- **Output:** OBJ mesh files (artistic/organic geometry)
- **Progress format:** `"{percentage},{task_id},{name}"` → `"Task Completed,{task_id},{name}"`

### cad_service (Port 1236)
**CAD Generation** — Engineering-grade parametric models via LLM + CadQuery.

- **WebSocket:** `/ws/{port_id}` — real-time progress during generation
- **Pipeline:** Prompt → LLM generates CadQuery Python code → AST validation → Sandboxed execution → STEP output → Upload to step_service → Register task in db_service
- **Output:** STEP files (precision-engineered geometry)
- **Safety:** AST-based code validation (import allowlist, forbidden builtins), stripped subprocess environment
- **Retry loop:** Up to `max_iterations` attempts, uses LLM to fix code on failure
- **Progress format:** Same as meshy_backend + includes `job_id`: `"Task Completed,{task_id},{name},{job_id}"`

### step_service (Port 1235)
**STEP File Processing** — Validates, extracts metadata, tessellates to glB, generates thumbnails.

- **Pipeline:** STEP upload → Header validation → S3 upload → Metadata extraction (bounding box, volume, surface area) → Tessellation to glB → Thumbnail PNG → S3 upload
- **Storage:** MinIO (S3-compatible) at `files/{user_id}/{task_id}/`
- **Key endpoints:**
  - `POST /step/upload` — upload and process a STEP file
  - `GET /step/{job_id}/status` — processing status
  - `GET /step/{job_id}/preview_url` — presigned URL for glB preview
  - `GET /step/by_task/{task_id}/preview_url` — presigned URL lookup by task_id (survives restarts via S3 fallback)
- **Docker:** Runs with `platform: linux/amd64` for CadQuery ARM compatibility

### stripe_service (Port 100)
**Payments** — Stripe checkout, webhooks, fulfiller onboarding, shipping rates.

- **Endpoints:** `/create-checkout-session`, `/webhook`, `/create_connect_account`, `/shipping_rates`
- **Webhook flow:** `checkout.session.completed` → creates orders in db_service

### shopify-redux (Port 3000)
**Frontend** — React 18 SPA with MUI, Redux Toolkit, Three.js.

- See [Frontend Architecture](./frontend-architecture.md) for details.

## Shared Packages

### fitd_schemas
Installed editable (`pip install -e ./fitd_schemas`) across all Python services.

- **fitd_db_schemas.py** — SQLAlchemy models: User, Task, Order, BasketItem, Claim, FulfillerProfile, ManufacturingProcess, ManufacturingMaterial, etc.
- **fitd_classes.py** — Pydantic v1 request/response models: TaskInformation, OrderResponse, UserResponse, CadTaskRequest, etc.
- **auth_utils.py** — Shared cookie verification logic

### jwt_auth
HS256 JWT generation/verification for inter-service authentication.

- Services generate tokens with `generate_token("service_name")`
- Receiving services verify with `verify_jwt_token` dependency

## Infrastructure

### PostgreSQL
Single database shared by all services via db_service API.

### Redis
- Session storage for auth_backend
- Pub/sub channels for real-time progress (meshy_backend, cad_service)
- Terminal task status caching (`task_result:{port_id}`)

### MinIO (S3-compatible)
- Bucket: `fitd-files`
- Key pattern: `files/{user_id}/{task_id}/{original.step|preview.glb|thumbnail.png}`
- Internal endpoint: `http://minio:9000` (Docker network)
- Public endpoint: `http://localhost:9000` (browser-reachable presigned URLs)

## Inter-Service Communication

```
[Frontend] --cookie--> [auth_backend] (session verification)
[Frontend] --cookie--> [db_service]   (user data, via auth_backend proxy check)
[Frontend] --WS------> [meshy_backend] (generation progress)
[Frontend] --WS------> [cad_service]   (generation progress)
[Frontend] -----------> [step_service]  (presigned URLs for CAD previews)

[cad_service] --JWT--> [db_service]   (register task, mark complete)
[cad_service] --HTTP-> [step_service] (upload STEP file)
[meshy_backend] --JWT--> [db_service] (register task, upload file)
[stripe_service] --JWT--> [db_service] (create orders from checkout)
```

## Database Schema (Key Tables)

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| `users` | user_id, email, name, is_buyer, is_claimant | User accounts |
| `tasks` | task_id, user_id, task_name, file_type, incomplete_task, port_id | Generated 3D models |
| `orders` | order_id, user_id, task_id, selectedFileType, process_id, material_id, status | Purchase orders |
| `basket_items` | basket_id, user_id, task_id, technique, material, sizing, process_id | Shopping cart |
| `claims` | claim_id, order_id, claimant_id, status, tracking_number | Fulfiller claims |
| `fulfiller_profiles` | user_id, max_build_volume_*, min_tolerance_mm, lead_time_* | Fulfiller capabilities |
| `manufacturing_processes` | id, family, name, display_name | Available techniques |
| `manufacturing_materials` | id, category, name, process_family | Available materials |

## Docker Compose Services

| Service | Platform | Depends On |
|---------|----------|------------|
| db_service | default | postgres, redis |
| auth_backend | default | redis |
| meshy_backend | default | redis |
| cad_service | linux/amd64 | redis, minio |
| step_service | linux/amd64 | minio |
| stripe_service | default | — |
| shopify-redux | default | — |
| postgres | default | — |
| redis | default | — |
| minio | default | — |

## Two 3D Generation Pipelines

The platform supports two complementary generation pathways:

| Aspect | Meshy (meshy_backend) | CAD (cad_service + step_service) |
|--------|----------------------|----------------------------------|
| **Input** | Text prompt or image | Text prompt |
| **Engine** | Meshy.ai API (external) | LLM + CadQuery (local) |
| **Output** | OBJ + MTL (artistic mesh) | STEP + glB preview (parametric solid) |
| **Storage** | db_service disk (`uploads/`) | MinIO S3 (`fitd-files` bucket) |
| **Geometry** | Organic, sculptural | Precision-engineered, parametric |
| **Dimensions** | Arbitrary (unitless) | Absolute (mm, ISO 10303) |
| **Manufacturing** | 3D printing only | Any technique (CNC, molding, etc.) |
| **Frontend fetch** | `fetchFile(taskId)` → db_service | `fetchCadFile(taskId)` → step_service presigned URL |
| **File type routing** | `isCadFileType()` returns false | `isCadFileType()` returns true |

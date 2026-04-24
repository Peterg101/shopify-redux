"""Task endpoints."""
import ast
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, validator
from sqlalchemy.orm import Session
from typing import Optional

from dependencies import get_db, get_redis, get_any_user
from utils import check_user_existence, add_task_to_db, add_port_to_db, mark_task_complete, delete_port_id
from cache import cache_invalidate
from events import publish_event
from jwt_auth import verify_jwt_token

from fitd_schemas.fitd_classes import TaskInformation, VerifiedExampleResponse
from fitd_schemas.fitd_db_schemas import Task, TaskScriptVersion, User, VerifiedExample

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/tasks", status_code=201)
def add_task(
    task_information: TaskInformation,
    db: Session = Depends(get_db),
    redis_client=Depends(get_redis),
    authorization: str = Depends(verify_jwt_token),
):
    user_exists = check_user_existence(db, task_information.user_id)

    if user_exists and task_information.port_id and task_information.task_id:
        add_task_to_db(db, task_information)
        add_port_to_db(db, task_information.task_id, task_information.port_id)
        # Invalidate session + tasks cache so the new task appears immediately
        cache_invalidate(redis_client, f"fitd:session:{task_information.user_id}", f"fitd:tasks:{task_information.user_id}")
        publish_event(redis_client, "task:started", user_id=task_information.user_id)
    return ""


@router.patch("/tasks/{task_id}/complete", status_code=200)
def complete_task(
    task_id: str,
    db: Session = Depends(get_db),
    redis_client=Depends(get_redis),
    authorization: str = Depends(verify_jwt_token),
):
    # Get user_id before completing (for cache invalidation)
    from fitd_schemas.fitd_db_schemas import Task
    task = db.query(Task).filter(Task.task_id == task_id).first()
    user_id = task.user_id if task else None

    mark_task_complete(db, task_id)
    delete_port_id(db, task_id)

    if user_id:
        cache_invalidate(redis_client, f"fitd:session:{user_id}", f"fitd:tasks:{user_id}")
        publish_event(redis_client, "task:completed", user_id=user_id)

    return {"message": "Task marked as complete"}


class ScriptUpdate(BaseModel):
    cadquery_script: str
    generation_prompt: str
    geometry_metadata: Optional[str] = None  # JSON string: {"features": [...], "faces": [...], "edges": [...]}
    instruction: Optional[str] = None  # The user's refinement instruction (for version history)
    conversation_history: Optional[str] = None  # JSON string of chat messages
    task_name: Optional[str] = None  # Friendly task name derived from confirmed spec


@router.patch("/tasks/{task_id}/script", status_code=200)
def save_task_script(
    task_id: str,
    payload: ScriptUpdate,
    db: Session = Depends(get_db),
    authorization: str = Depends(verify_jwt_token),
):
    """Save the CadQuery script, prompt, and geometry metadata for a task (inter-service only).
    Auto-versions the previous script before overwriting."""
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Auto-version: save the CURRENT script before overwriting
    if task.cadquery_script:
        max_version = db.query(TaskScriptVersion.version).filter(
            TaskScriptVersion.task_id == task_id
        ).order_by(TaskScriptVersion.version.desc()).first()
        next_version = (max_version[0] + 1) if max_version else 1

        version_record = TaskScriptVersion(
            task_id=task_id,
            version=next_version,
            cadquery_script=task.cadquery_script,
            generation_prompt=task.generation_prompt,
            geometry_metadata=task.geometry_metadata,
            instruction=payload.instruction if hasattr(payload, 'instruction') else None,
            created_at=task.created_at,
        )
        db.add(version_record)

    task.cadquery_script = payload.cadquery_script
    task.generation_prompt = payload.generation_prompt
    if payload.geometry_metadata is not None:
        task.geometry_metadata = payload.geometry_metadata
    if payload.conversation_history is not None:
        task.conversation_history = payload.conversation_history
    if payload.task_name is not None:
        task.task_name = payload.task_name
    db.commit()

    logger.info(f"Script saved for task {task_id} ({len(payload.cadquery_script)} chars)")
    return {"message": "Script saved"}


def _extract_parameters(script: str) -> list[dict]:
    """Parse named dimension variables from a CadQuery script using AST."""
    params = []
    try:
        tree = ast.parse(script)
        for node in ast.iter_child_nodes(tree):
            if isinstance(node, ast.Assign) and len(node.targets) == 1:
                target = node.targets[0]
                if isinstance(target, ast.Name) and isinstance(node.value, ast.Constant):
                    value = node.value.value
                    if isinstance(value, (int, float)):
                        params.append({
                            "name": target.id,
                            "value": value,
                            "type": "float" if isinstance(value, float) else "int",
                        })
    except SyntaxError:
        pass
    return params


@router.get("/tasks/{task_id}/parameters")
def get_task_parameters(
    task_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_any_user),
):
    """Get extracted parameters from a task's stored CadQuery script."""
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not task.cadquery_script:
        return {"parameters": [], "script_available": False}

    params = _extract_parameters(task.cadquery_script)
    return {"parameters": params, "script_available": True}


@router.get("/tasks/{task_id}/script")
def get_task_script(
    task_id: str,
    db: Session = Depends(get_db),
    authorization: str = Depends(verify_jwt_token),
):
    """Get stored CadQuery script for a task (inter-service only, for regeneration)."""
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return {
        "cadquery_script": task.cadquery_script,
        "generation_prompt": task.generation_prompt,
        "geometry_metadata": task.geometry_metadata,
    }


@router.get("/tasks/{task_id}/geometry")
def get_task_geometry(
    task_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_any_user),
):
    """Get geometry metadata (features, faces, edges) for a task."""
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not task.geometry_metadata:
        return {"features": [], "faces": [], "edges": [], "suppressed": []}

    try:
        data = json.loads(task.geometry_metadata)
        return {
            "features": data.get("features", []),
            "faces": data.get("faces", []),
            "edges": data.get("edges", []),
            "suppressed": data.get("suppressed", []),
        }
    except (json.JSONDecodeError, TypeError):
        return {"features": [], "faces": [], "edges": [], "suppressed": []}


@router.get("/tasks/{task_id}/versions")
def get_task_versions(
    task_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_any_user),
):
    """Get version history for a task's script."""
    versions = (
        db.query(TaskScriptVersion)
        .filter(TaskScriptVersion.task_id == task_id)
        .order_by(TaskScriptVersion.version.desc())
        .all()
    )
    return {
        "versions": [
            {
                "version": v.version,
                "instruction": v.instruction,
                "created_at": v.created_at,
            }
            for v in versions
        ],
        "total": len(versions),
    }


@router.get("/tasks/{task_id}/versions/{version}")
def get_task_version(
    task_id: str,
    version: int,
    db: Session = Depends(get_db),
    authorization: str = Depends(verify_jwt_token),
):
    """Get a specific version of a task's script (inter-service, for revert)."""
    v = (
        db.query(TaskScriptVersion)
        .filter(TaskScriptVersion.task_id == task_id, TaskScriptVersion.version == version)
        .first()
    )
    if not v:
        raise HTTPException(status_code=404, detail=f"Version {version} not found")

    return {
        "cadquery_script": v.cadquery_script,
        "generation_prompt": v.generation_prompt,
        "geometry_metadata": v.geometry_metadata,
    }


@router.get("/tasks/{task_id}/conversation")
def get_task_conversation(
    task_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_any_user),
):
    """Get stored conversation history for a task."""
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not task.conversation_history:
        return {"messages": []}

    try:
        messages = json.loads(task.conversation_history)
        return {"messages": messages}
    except (json.JSONDecodeError, TypeError):
        return {"messages": []}


# ---------------------------------------------------------------------------
# Feedback — user thumbs-up/down on generated models
# ---------------------------------------------------------------------------

CATEGORY_KEYWORDS = {
    "bracket": ["bracket", "l-bracket", "u-bracket", "angle", "mount"],
    "enclosure": ["enclosure", "case", "box", "housing", "container", "shell"],
    "plate": ["plate", "base", "flat", "adapter"],
    "cylindrical": ["cylinder", "standoff", "spacer", "bushing", "pipe", "tube"],
    "gear": ["gear", "cog", "teeth", "involute", "spur"],
    "organic": ["funnel", "cone", "taper", "hull", "airfoil", "blade", "vase", "nozzle"],
    "clip": ["clip", "grommet", "spring", "snap", "retaining"],
    "flange": ["flange", "fitting", "adapter"],
}


def _classify_category(description: str) -> str:
    desc_lower = description.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in desc_lower for kw in keywords):
            return category
    return "general"


def _compute_geometry_hash(steps_json: str | None) -> str | None:
    if not steps_json:
        return None
    import hashlib
    try:
        steps = json.loads(steps_json)
        skeleton = [{"op": s.get("op", ""), "tag": s.get("tag", "")} for s in steps]
        return hashlib.sha256(json.dumps(skeleton, sort_keys=True).encode()).hexdigest()[:16]
    except (json.JSONDecodeError, TypeError):
        return None


def _classify_complexity(description: str) -> str:
    complex_keywords = ["gear", "involute", "airfoil", "blade", "turbine", "helix",
                        "thread", "sweep", "loft", "spline", "organic", "curve"]
    desc_lower = description.lower()
    if any(kw in desc_lower for kw in complex_keywords):
        return "complex"
    medium_keywords = ["enclosure", "housing", "boss", "cutout", "shell", "vent"]
    if any(kw in desc_lower for kw in medium_keywords):
        return "medium"
    return "simple"


class FeedbackRequest(BaseModel):
    rating: str

    @validator('rating')
    def validate_rating(cls, v):
        if v not in ("up", "down"):
            raise ValueError('Rating must be "up" or "down"')
        return v


@router.post("/tasks/{task_id}/feedback", status_code=200)
def submit_feedback(
    task_id: str,
    payload: FeedbackRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_any_user),
):
    """Record user feedback on a generated model. Thumbs-up adds to verified examples."""
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not task.complete:
        raise HTTPException(status_code=400, detail="Can only rate completed tasks")

    if payload.rating == "down":
        existing = db.query(VerifiedExample).filter(
            VerifiedExample.task_id == task_id
        ).first()
        if existing:
            existing.downvotes += 1
            if existing.downvotes >= existing.upvotes:
                existing.is_active = False
            db.commit()
            return {"message": "Feedback recorded — example downvoted"}
        return {"message": "Feedback recorded — no example existed for this task"}

    # Thumbs up — extract example data from the task
    description = task.generation_prompt or task.task_name or ""
    steps_json = None
    params_json = None
    if task.geometry_metadata:
        try:
            meta = json.loads(task.geometry_metadata)
            steps_json = json.dumps(meta.get("steps")) if meta.get("steps") else None
            params_json = json.dumps(meta.get("parameters")) if meta.get("parameters") else None
        except (json.JSONDecodeError, TypeError):
            pass

    geometry_hash = _compute_geometry_hash(steps_json)
    category = _classify_category(description)
    complexity = _classify_complexity(description)
    has_script = bool(task.cadquery_script and len(task.cadquery_script) > 10)
    gen_path = "direct" if has_script and not steps_json else "structured"
    op_count = len(json.loads(steps_json)) if steps_json else 0

    # Extract keywords from description
    stop_words = {"a", "an", "the", "with", "and", "or", "for", "of", "in", "on", "to", "mm", "from"}
    keywords = [w.lower().strip(".,;:!?") for w in description.split()
                if len(w) > 2 and w.lower() not in stop_words]

    # Check for duplicate by geometry hash
    if geometry_hash:
        existing = db.query(VerifiedExample).filter(
            VerifiedExample.geometry_hash == geometry_hash,
            VerifiedExample.is_active == True,
        ).first()
        if existing:
            existing.upvotes += 1
            db.commit()
            return {"message": "Example upvoted", "example_id": existing.id}

    # Compute semantic embedding for retrieval
    embedding = None
    try:
        from embedding_utils import compute_embedding
        embedding = compute_embedding(description)
    except Exception as emb_err:
        logger.warning(f"Embedding computation skipped: {emb_err}")

    example = VerifiedExample(
        task_id=task_id,
        user_id=user.user_id,
        description=description,
        keywords=json.dumps(keywords),
        category=category,
        complexity=complexity,
        source="user",
        parameters=params_json,
        steps=steps_json,
        cadquery_script=task.cadquery_script,
        generation_path=gen_path,
        geometry_hash=geometry_hash,
        op_count=op_count,
        embedding_json=embedding,
    )
    db.add(example)
    db.commit()

    return {"message": "Example added to library", "example_id": example.id}


@router.get("/verified_examples")
def get_verified_examples(
    db: Session = Depends(get_db),
    authorization: str = Depends(verify_jwt_token),
):
    """Get all active verified examples (inter-service, for generation_service retrieval)."""
    examples = (
        db.query(VerifiedExample)
        .filter(VerifiedExample.is_active == True)
        .order_by(VerifiedExample.upvotes.desc())
        .limit(500)
        .all()
    )
    return {
        "examples": [
            {
                "id": e.id,
                "description": e.description,
                "keywords": e.keywords,
                "category": e.category,
                "complexity": e.complexity,
                "source": e.source,
                "parameters": e.parameters,
                "steps": e.steps,
                "cadquery_script": e.cadquery_script,
                "generation_path": e.generation_path,
                "upvotes": e.upvotes,
                "op_count": e.op_count,
                "embedding_json": e.embedding_json,
            }
            for e in examples
        ]
    }

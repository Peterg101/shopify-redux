"""Task endpoints."""
import ast
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from dependencies import get_db, get_redis, get_any_user
from utils import check_user_existence, add_task_to_db, add_port_to_db, mark_meshy_task_complete, delete_port_id
from cache import cache_invalidate
from events import publish_event
from jwt_auth import verify_jwt_token

from fitd_schemas.fitd_classes import TaskInformation
from fitd_schemas.fitd_db_schemas import Task, TaskScriptVersion, User

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
        # Invalidate session cache so incomplete_task appears on refresh
        cache_invalidate(redis_client, f"fitd:session:{task_information.user_id}")
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

    mark_meshy_task_complete(db, task_id)
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

"""Task endpoints."""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from dependencies import get_db, get_redis
from utils import check_user_existence, add_task_to_db, add_port_to_db, mark_meshy_task_complete, delete_port_id
from cache import cache_invalidate
from events import publish_event
from jwt_auth import verify_jwt_token

from fitd_schemas.fitd_classes import TaskInformation

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

"""Task endpoints."""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from dependencies import get_db
from utils import check_user_existence, add_task_to_db, add_port_to_db, mark_meshy_task_complete, delete_port_id
from jwt_auth import verify_jwt_token

from fitd_schemas.fitd_classes import TaskInformation

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/tasks", status_code=201)
def add_task(
    task_information: TaskInformation,
    db: Session = Depends(get_db),
    authorization: str = Depends(verify_jwt_token),
):
    user_exists = check_user_existence(db, task_information.user_id)

    if user_exists and task_information.port_id and task_information.task_id:
        add_task_to_db(db, task_information)
        add_port_to_db(db, task_information.task_id, task_information.port_id)
    return ""


@router.patch("/tasks/{task_id}/complete", status_code=200)
def complete_task(
    task_id: str,
    db: Session = Depends(get_db),
    authorization: str = Depends(verify_jwt_token),
):
    mark_meshy_task_complete(db, task_id)
    delete_port_id(db, task_id)
    return {"message": "Task marked as complete"}

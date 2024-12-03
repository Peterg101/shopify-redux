from typing import Union
from api_calls import session_exists
from sqlalchemy.orm import Session
from models import User, Task
from classes import UserInformation, TaskInformation
from fastapi import HTTPException


async def check_session_token_active(session_token: Union[str, None]) -> bool:
    print('checking session token')
    if not session_token:
        return False
    print('active session')
    active_session = await session_exists(session_token)
    return active_session


def check_user_existence(db: Session, user_id: str | None) -> None:
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid Email")
    if db.query(User).filter(User.id == user_id).first():
        raise HTTPException(status_code=400, detail="Email already exists")


def add_user_to_db(db: Session, user_information: UserInformation) -> User:
    user = User(
        id=user_information.user_id,
        username=user_information.username,
        email=user_information.email
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def add_task_to_db(db: Session, task_information: TaskInformation) -> Task:
    task = Task(
        task_id=task_information.task_id,
        user_id=task_information.user_id,
        task_name=task_information.task_name,
        status=task_information.status,
        created_at=task_information.created_at
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class UserInformation(BaseModel):
    user_id: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None


class TaskInformation(BaseModel):
    task_id: Optional[str] = None
    user_id: Optional[str] = None
    task_name: Optional[str] = None
    created_at: Optional[datetime] = datetime.now()
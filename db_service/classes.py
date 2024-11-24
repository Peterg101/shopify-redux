from pydantic import BaseModel
from typing import Optional


class UserInformation(BaseModel):
    user_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None

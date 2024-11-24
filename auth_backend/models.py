from pydantic import BaseModel
from typing import Optional


class Token(BaseModel):
    access_token: str
    id_token: str
    expires_in: int
    scope: str
    token_type: str


class SessionData(BaseModel):
    user_id: Optional[str] = None

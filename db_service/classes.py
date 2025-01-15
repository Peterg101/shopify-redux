from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Union
from datetime import datetime


class UserInformation(BaseModel):
    user_id: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None


class TaskInformation(BaseModel):
    task_id: Optional[str] = None
    user_id: Optional[str] = None
    task_name: Optional[str] = None
    port_id: Optional[str] = None
    created_at: Optional[str] = datetime.now().isoformat()


class UserAndTasks(BaseModel):
    user: UserInformation
    tasks: List[TaskInformation]


class ModelUrls(BaseModel):
    obj: Optional[str] = Field(default=None)
    mtl: Optional[str] = Field(default=None)
    glb: Optional[str] = Field(default=None)
    fbx: Optional[str] = Field(default=None)
    usdz: Optional[str] = Field(default=None)


class MeshyTaskStatusResponse(BaseModel):
    id: str
    mode: str
    name: str
    seed: int
    art_style: str
    texture_richness: str
    prompt: str
    negative_prompt: str
    status: str
    created_at: int
    progress: int
    started_at: int
    finished_at: int
    task_error: Optional[str]
    thumbnail_url: str
    video_url: str
    beet: Optional[int] = 0
    texture_urls: Union[List[str], None] = []
    preceding_tasks: Optional[int] = None
    obj_file_blob: Optional[str] = None  # Base64-encoded string
    model_urls: Optional[ModelUrls] = None

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        protected_namespaces=(),  # Disables the warning about `model_`
    )


class BasketItemInformation(BaseModel):
    task_id: str          # task_id corresponds to "task_id" in the database
    user_id: str          # user_id corresponds to "user_id"
    name: str
    material: str
    technique: str
    sizing: int
    colour: str
    selected_file: str    # Changed to snake_case in TypeScript, use snake_case in Python
    quantity: int
    selected_file_type: str  # Changed to snake_case in TypeScript, use snake_case in Python
    file_blob: str        # This matches the `file_blob` in TypeScript
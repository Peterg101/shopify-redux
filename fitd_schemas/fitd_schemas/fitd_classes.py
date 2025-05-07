from pydantic import BaseModel, ConfigDict, Field, HttpUrl, validator
from typing import Optional, List, Union
from datetime import datetime
from dataclasses import dataclass


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
    task_id: str  # task_id corresponds to "task_id" in the database
    user_id: str  # user_id corresponds to "user_id"
    name: str
    material: str
    technique: str
    sizing: float
    colour: str
    selected_file: str  # Changed to snake_case in TypeScript, use snake_case in Python
    quantity: int
    selectedFileType: (
        str  # Changed to snake_case in TypeScript, use snake_case in Python
    )
    price: float
    file_blob: str  # This matches the `file_blob` in TypeScript


class BasketQuantityUpdate(BaseModel):
    task_id: str
    quantity: int


class Token(BaseModel):
    access_token: str
    id_token: str
    expires_in: int
    scope: str
    token_type: str


class SessionData(BaseModel):
    user_id: Optional[str] = None


@dataclass
class MeshyPayload:
    mode: str
    prompt: str
    art_style: str
    negative_prompt: str


@dataclass
class MeshyImageTo3DPayload:
    image_url: str
    enable_pbr: bool
    should_remesh: bool
    should_texture: bool


@dataclass
class MeshyTaskGeneratedResponse:
    result: str


@dataclass
class MeshyTaskStatus:
    task_id: str


@dataclass
class MeshyRefinedPayload:
    mode: Optional[str]
    preview_task_id: str


class TaskRequest(BaseModel):
    port_id: str
    user_id: str
    meshy_payload: MeshyPayload


class ImageTo3DTaskRequest(BaseModel):
    port_id: str
    user_id: str
    meshy_image_to_3d_payload: MeshyImageTo3DPayload
    filename: str

# class TextureUrls(BaseModel):
#     base_color: Optional[HttpUrl]
#     metallic: Optional[HttpUrl]
#     normal: Optional[HttpUrl]
#     roughness: Optional[HttpUrl]


class TaskError(BaseModel):
    message: str
    code: Optional[str] = None


class TextureUrls(BaseModel):
    url: Optional[str] = None  # Use str if sometimes not a valid URL


class Image3DModelUrls(BaseModel):
    glb: Optional[str] = None  # Accepts empty string or None
    fbx: Optional[str] = None
    obj: Optional[str] = None
    usdz: Optional[str] = None

    @validator("glb", pre=True)
    def empty_str_to_none(cls, v):
        return v or None


class ImageTo3DMeshyTaskStatusResponse(BaseModel):
    id: str
    model_urls: Optional[Image3DModelUrls] = None
    thumbnail_url: Optional[str] = None  # Use str to allow empty string
    progress: int
    started_at: int
    created_at: int
    expires_at: int
    finished_at: int
    status: str
    texture_urls: Optional[List[TextureUrls]] = None
    preceding_tasks: Optional[int] = None
    task_error: Optional[TaskError] = None
    obj_file_blob: Optional[str] = None

    @validator("thumbnail_url", pre=True)
    def empty_str_to_none(cls, v):
        return v or None
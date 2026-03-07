from pydantic import BaseModel, ConfigDict, Field, HttpUrl, validator
from typing import Optional, List, Union, Any
from datetime import datetime
from dataclasses import dataclass
import re


def validate_email_format(v):
    if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v):
        raise ValueError('Invalid email format')
    return v.lower().strip()


class UserInformation(BaseModel):
    user_id: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    password_hash: Optional[str] = None
    auth_provider: Optional[str] = "google"

    @validator('username')
    def validate_username_length(cls, v):
        if v is not None and len(v) > 100:
            raise ValueError('Username must be at most 100 characters')
        return v

    @validator('email')
    def validate_email_length(cls, v):
        if v is not None and len(v) > 255:
            raise ValueError('Email must be at most 255 characters')
        return v


class PasswordVerifyRequest(BaseModel):
    email: str
    password: str


class EmailRegisterRequest(BaseModel):
    username: str
    email: str
    password: str

    @validator('email')
    def validate_email(cls, v):
        return validate_email_format(v)

    @validator('username')
    def validate_username(cls, v):
        if len(v) < 2 or len(v) > 50:
            raise ValueError('Username must be between 2 and 50 characters')
        return v

    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        return v


class EmailLoginRequest(BaseModel):
    email: str
    password: str

    @validator('email')
    def validate_email(cls, v):
        return validate_email_format(v)


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
    task_error: Optional[str] = None
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

    @validator('quantity')
    def validate_quantity(cls, v):
        if v < 1:
            raise ValueError('Quantity must be at least 1')
        return v


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
    ai_model: str
    topology: Optional[str] = None          # 'quad' | 'triangle'
    target_polycount: Optional[int] = None   # 100-300000
    symmetry_mode: Optional[str] = None      # 'off' | 'auto' | 'on'


@dataclass
class MeshyImageTo3DPayload:
    image_url: str
    enable_pbr: bool
    should_remesh: bool
    should_texture: bool
    ai_model: str
    topology: Optional[str] = None
    target_polycount: Optional[int] = None
    symmetry_mode: Optional[str] = None
    texture_prompt: Optional[str] = None


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
    enable_pbr: Optional[bool] = None
    texture_prompt: Optional[str] = None
    remove_lighting: Optional[bool] = None


class TaskRequest(BaseModel):
    port_id: str
    user_id: str
    meshy_payload: MeshyPayload


class ImageTo3DTaskRequest(BaseModel):
    port_id: str
    user_id: str
    meshy_image_to_3d_payload: MeshyImageTo3DPayload
    filename: str


class RefineTaskRequest(BaseModel):
    port_id: str
    user_id: str
    meshy_refine_payload: MeshyRefinedPayload


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


class StripeCheckoutLineItem(BaseModel):
    task_id: str
    user_id: str
    name: str
    material: str
    technique: str
    sizing: float
    colour: str
    selectedFile: str
    selectedFileType: str
    price: float
    quantity: int


class ShippingAddress(BaseModel):
    name: str
    line1: str
    line2: Optional[str] = None
    city: str
    postal_code: str
    country: str = "GB"


class StripeCheckoutOrder(BaseModel):
    stripe_checkout_session_id: str
    user_id: str
    order_status: str = "created"
    line_items: List[StripeCheckoutLineItem]
    shipping_address: Optional[ShippingAddress] = None


class FulfillerAddressUpdate(BaseModel):
    name: str
    line1: str
    line2: Optional[str] = None
    city: str
    postal_code: str
    country: str = "GB"


class ClaimShippingUpdate(BaseModel):
    tracking_number: str
    label_url: str
    carrier_code: str
    shipment_id: str


class ClaimOrder(BaseModel):
    order_id: str
    quantity: int
    status: str

    @validator('quantity')
    def validate_quantity(cls, v):
        if v < 1:
            raise ValueError('Quantity must be at least 1')
        return v


class ClaimQuantityUpdate(BaseModel):
    quantity: int

    @validator('quantity')
    def validate_quantity(cls, v):
        if v < 1:
            raise ValueError('Quantity must be at least 1')
        return v


class MarkDisbursementPaidRequest(BaseModel):
    stripe_transfer_id: str


class DisputeFulfillerResponse(BaseModel):
    response_text: str


class DisputeResolveRequest(BaseModel):
    resolution: str  # accepted | partial | rejected
    partial_amount_cents: Optional[int] = None


class DisputeResponse(BaseModel):
    id: str
    claim_id: str
    opened_by: str
    reason: str
    status: str
    resolution: Optional[str] = None
    resolution_amount_cents: Optional[int] = None
    resolved_by: Optional[str] = None
    fulfiller_response: Optional[str] = None
    responded_at: Optional[datetime] = None
    fulfiller_deadline: datetime
    buyer_deadline: Optional[datetime] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class ClaimStatusUpdate(BaseModel):
    status: str
    evidence_description: Optional[str] = None
    reason: Optional[str] = None


class ClaimEvidenceResponse(BaseModel):
    id: str
    claim_id: str
    file_path: str
    uploaded_at: datetime
    status_at_upload: str
    description: Optional[str] = None

    class Config:
        orm_mode = True


class ClaimStatusHistoryResponse(BaseModel):
    id: str
    claim_id: str
    previous_status: str
    new_status: str
    changed_by: str
    changed_at: datetime

    class Config:
        orm_mode = True


class BuyerReviewRequest(BaseModel):
    decision: str
    reason: Optional[str] = None


class ClaimResponse(BaseModel):
    id: str
    order_id: str
    claimant_user_id: str
    quantity: int
    status: str
    created_at: datetime
    updated_at: datetime
    evidence: list = []
    status_history: list = []
    tracking_number: Optional[str] = None
    label_url: Optional[str] = None
    carrier_code: Optional[str] = None

    class Config:
        orm_mode = True


class ClaimDetailResponse(BaseModel):
    id: str
    order_id: str
    claimant_user_id: str
    claimant_username: str
    quantity: int
    status: str
    created_at: datetime
    updated_at: datetime
    evidence: List[ClaimEvidenceResponse]
    status_history: List[ClaimStatusHistoryResponse]
    dispute: Optional[DisputeResponse] = None
    tracking_number: Optional[str] = None
    label_url: Optional[str] = None
    carrier_code: Optional[str] = None

    class Config:
        orm_mode = True


class OrderResponse(BaseModel):
    order_id: str
    task_id: str
    user_id: str
    name: str
    material: str
    technique: str
    sizing: float
    colour: str
    selectedFile: str
    selectedFileType: str
    price: float
    quantity: int
    created_at: str
    is_collaborative: bool
    status: str
    qa_level: str = "standard"

    quantity_claimed: int
    claims: list[ClaimResponse]

    shipping_name: Optional[str] = None
    shipping_line1: Optional[str] = None
    shipping_line2: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_postal_code: Optional[str] = None
    shipping_country: Optional[str] = None

    class Config:
        orm_mode = True


class OrderDetailResponse(BaseModel):
    order_id: str
    task_id: str
    user_id: str
    owner_username: str
    name: str
    material: str
    technique: str
    sizing: float
    colour: str
    selectedFile: str
    selectedFileType: str
    price: float
    quantity: int
    quantity_claimed: int
    created_at: str
    is_collaborative: bool
    status: str
    qa_level: str
    claims: List[ClaimDetailResponse]

    shipping_name: Optional[str] = None
    shipping_line1: Optional[str] = None
    shipping_line2: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_postal_code: Optional[str] = None
    shipping_country: Optional[str] = None

    class Config:
        orm_mode = True

class ClaimWithOrderResponse(BaseModel):
    id: str
    claimant_user_id: str
    quantity: int
    status: str
    created_at: datetime
    updated_at: datetime
    order: OrderResponse

    class Config:
        orm_mode = True


class BasketItemResponse(BaseModel):
    task_id: str
    user_id: str
    name: str
    material: str
    technique: str
    sizing: float
    colour: str
    selectedFile: str
    selectedFileType: str
    price: float
    quantity: int

    class Config:
        orm_mode = True


class UserResponse(BaseModel):
    user_id: str
    username: str
    email: str | None = None

    class Config:
        orm_mode = True


class TaskResponse(BaseModel):
    task_id: str
    user_id: str
    task_name: str
    complete: bool
    created_at: str

    # Comes from @hybrid_property
    port_id: Optional[str] = None

    class Config:
        orm_mode = True


class IncompleteTaskResponse(BaseModel):
    port_id: str
    task_id: str

    class Config:
        orm_mode = True


class ManufacturingProcessResponse(BaseModel):
    id: str
    family: str
    name: str
    display_name: str

    class Config:
        orm_mode = True


class ManufacturingMaterialResponse(BaseModel):
    id: str
    category: str
    name: str
    process_family: str

    class Config:
        orm_mode = True


class FulfillerCapabilityCreate(BaseModel):
    process_id: str
    materials: Optional[List[str]] = None  # list of material IDs
    notes: Optional[str] = None


class FulfillerCapabilityResponse(BaseModel):
    id: str
    process_id: str
    process: ManufacturingProcessResponse
    materials: Optional[List[str]] = None
    notes: Optional[str] = None

    class Config:
        orm_mode = True

    @validator('materials', pre=True)
    def parse_materials_json(cls, v):
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return []
        return v


class FulfillerProfileCreate(BaseModel):
    business_name: str
    description: Optional[str] = None
    max_build_volume_x: Optional[float] = None
    max_build_volume_y: Optional[float] = None
    max_build_volume_z: Optional[float] = None
    min_tolerance_mm: Optional[float] = None
    lead_time_days_min: Optional[int] = None
    lead_time_days_max: Optional[int] = None
    certifications: Optional[List[str]] = None
    post_processing: Optional[List[str]] = None
    capabilities: List[FulfillerCapabilityCreate] = []


class FulfillerProfileResponse(BaseModel):
    id: str
    user_id: str
    business_name: str
    description: Optional[str] = None
    max_build_volume_x: Optional[float] = None
    max_build_volume_y: Optional[float] = None
    max_build_volume_z: Optional[float] = None
    min_tolerance_mm: Optional[float] = None
    lead_time_days_min: Optional[int] = None
    lead_time_days_max: Optional[int] = None
    certifications: Optional[List[str]] = None
    post_processing: Optional[List[str]] = None
    is_active: bool = True
    capabilities: List[FulfillerCapabilityResponse] = []

    class Config:
        orm_mode = True

    @validator('certifications', pre=True)
    def parse_certifications_json(cls, v):
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return []
        return v

    @validator('post_processing', pre=True)
    def parse_post_processing_json(cls, v):
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return []
        return v


class UserHydrationResponse(BaseModel):
    user: UserResponse
    tasks: List[TaskResponse]
    basket_items: List[BasketItemResponse]
    incomplete_task: IncompleteTaskResponse | None
    claimable_orders: List[OrderResponse]
    orders: List[OrderResponse]
    claims: List[ClaimWithOrderResponse]
    stripe_onboarded: bool = False
    fulfiller_profile: Optional[FulfillerProfileResponse] = None

    class Config:
        orm_mode = True

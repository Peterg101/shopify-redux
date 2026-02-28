from pydantic import BaseModel, ConfigDict, Field, HttpUrl, validator
from typing import Optional, List, Union, Any
from datetime import datetime
from dataclasses import dataclass


class UserInformation(BaseModel):
    user_id: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    password_hash: Optional[str] = None
    auth_provider: Optional[str] = "google"


class EmailRegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class EmailLoginRequest(BaseModel):
    email: str
    password: str


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
    ai_model: str


@dataclass
class MeshyImageTo3DPayload:
    image_url: str
    enable_pbr: bool
    should_remesh: bool
    should_texture: bool
    ai_model: str


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


class Money(BaseModel):
    amount: str
    currency_code: str


class PriceSet(BaseModel):
    shop_money: Money
    presentment_money: Money


class Property(BaseModel):
    name: str
    value: str


class LineItem(BaseModel):
    id: int
    admin_graphql_api_id: str
    attributed_staffs: List = []
    current_quantity: int
    fulfillable_quantity: int
    fulfillment_service: str
    fulfillment_status: Optional[str]
    gift_card: bool
    grams: int
    name: str
    price: str
    price_set: PriceSet
    product_exists: bool
    product_id: Optional[int]
    properties: List[Property]
    quantity: int
    requires_shipping: bool
    sales_line_item_group_id: Optional[str]
    sku: Optional[str]
    taxable: bool
    title: str
    total_discount: str
    total_discount_set: PriceSet
    variant_id: Optional[int]
    variant_inventory_management: Optional[str]
    variant_title: Optional[str]
    vendor: str
    tax_lines: List = []
    duties: List = []
    discount_allocations: List = []


class ShippingAddress(BaseModel):
    first_name: str
    last_name: str
    address1: str
    address2: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    city: str
    zip: str
    province: str
    country: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    name: str
    country_code: str
    province_code: str


class ShopifyOrder(BaseModel):
    id: int
    order_status: str
    line_items: List[LineItem]
    shipping_address: ShippingAddress


class ClaimOrder(BaseModel):
    order_id: str
    quantity: int
    status: str


class ClaimStatusUpdate(BaseModel):
    status: str
    evidence_description: Optional[str] = None


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
    port_id: Optional[str]

    class Config:
        orm_mode = True


class IncompleteTaskResponse(BaseModel):
    port_id: str
    task_id: str 

    class Config:
        orm_mode = True


class UserHydrationResponse(BaseModel):
    user: UserResponse
    tasks: List[TaskResponse]
    basket_items: List[BasketItemResponse]
    incomplete_task: IncompleteTaskResponse | None
    claimable_orders: List[OrderResponse]
    orders: List[OrderResponse]
    claims: List[ClaimWithOrderResponse]
    stripe_onboarded: bool = False

    class Config:
        orm_mode = True

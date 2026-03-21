from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Text, UniqueConstraint
from sqlalchemy.orm import backref, declarative_base
from datetime import datetime
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship, Mapped, mapped_column
from typing import Optional
from uuid import uuid4


Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    user_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    auth_provider: Mapped[str] = mapped_column(String, default="google")
    tasks = relationship("Task", back_populates="owner", lazy="selectin")


class Task(Base):
    __tablename__ = "tasks"
    task_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.user_id"))
    task_name: Mapped[str] = mapped_column(String)
    file_type: Mapped[str] = mapped_column(String, default="obj")
    complete: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.now().isoformat())
    owner = relationship("User", back_populates="tasks", lazy="noload")

    # Optional one-to-one relationship to PortID
    port = relationship("PortID", back_populates="task", uselist=False, lazy="joined")

    @hybrid_property
    def port_id(self):
        return self.port.port_id if self.port else None


class BasketItem(Base):
    __tablename__ = "basket_items"
    task_id: Mapped[str] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column()
    name: Mapped[str] = mapped_column()
    material: Mapped[str] = mapped_column()
    technique: Mapped[str] = mapped_column()
    sizing: Mapped[float] = mapped_column()
    colour: Mapped[str] = mapped_column()
    selectedFile: Mapped[str] = mapped_column()
    selectedFileType: Mapped[str] = mapped_column()
    price: Mapped[float] = mapped_column()
    quantity: Mapped[int] = mapped_column(default=1)
    process_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("manufacturing_processes.id"), nullable=True
    )
    material_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("manufacturing_materials.id"), nullable=True
    )
    tolerance_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    surface_finish: Mapped[str | None] = mapped_column(String, nullable=True)
    special_requirements: Mapped[str | None] = mapped_column(Text, nullable=True)


class PortID(Base):
    __tablename__ = "port_id"
    task_id: Mapped[str] = mapped_column(
        ForeignKey("tasks.task_id"), primary_key=True
    )  # Foreign key to Task
    port_id: Mapped[str] = mapped_column()

    # Back reference to Task
    task = relationship("Task", back_populates="port", lazy="joined")


class Order(Base):
    __tablename__ = "orders"

    order_id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid4())
    )
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.task_id"), nullable=False)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.user_id"))
    stripe_checkout_session_id: Mapped[str | None] = mapped_column(index=True)
    name: Mapped[str] = mapped_column()
    material: Mapped[str] = mapped_column()
    technique: Mapped[str] = mapped_column()
    sizing: Mapped[float] = mapped_column()
    colour: Mapped[str] = mapped_column()
    selectedFile: Mapped[str] = mapped_column()
    selectedFileType: Mapped[str] = mapped_column()
    price: Mapped[float] = mapped_column()
    quantity: Mapped[int] = mapped_column()
    created_at: Mapped[str] = mapped_column(default=lambda: datetime.utcnow().isoformat())
    is_collaborative: Mapped[bool] = mapped_column(default=False)
    status: Mapped[str] = mapped_column(default="open")
    qa_level: Mapped[str] = mapped_column(String, default="standard")

    # Manufacturing specification (optional — links to taxonomy for capability matching)
    process_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("manufacturing_processes.id"), nullable=True
    )
    material_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("manufacturing_materials.id"), nullable=True
    )
    tolerance_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    surface_finish: Mapped[str | None] = mapped_column(String, nullable=True)
    special_requirements: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Shipping address (collected from Stripe Checkout)
    shipping_name: Mapped[str | None] = mapped_column(String, nullable=True)
    shipping_line1: Mapped[str | None] = mapped_column(String, nullable=True)
    shipping_line2: Mapped[str | None] = mapped_column(String, nullable=True)
    shipping_city: Mapped[str | None] = mapped_column(String, nullable=True)
    shipping_postal_code: Mapped[str | None] = mapped_column(String, nullable=True)
    shipping_country: Mapped[str | None] = mapped_column(String, nullable=True)

    # Relationships
    user = relationship("User", backref=backref("orders", lazy="noload"), lazy="noload")
    task = relationship("Task", backref=backref("order", uselist=False, lazy="noload"), uselist=False, lazy="noload")
    manufacturing_process = relationship("ManufacturingProcess", lazy="selectin")
    manufacturing_material = relationship("ManufacturingMaterial", lazy="selectin")
    claims: Mapped[list["Claim"]] = relationship(
        "Claim",
        back_populates="order",
        lazy="selectin",
        cascade="all, delete-orphan"
    )

    @property
    def quantity_claimed(self) -> int:
        """Compute total claimed quantity dynamically."""
        return sum(claim.quantity for claim in self.claims)


class Claim(Base):
    __tablename__ = "claims"
    __table_args__ = (
        UniqueConstraint("order_id", "claimant_user_id", name="uq_order_user_claim"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    order_id: Mapped[str] = mapped_column(String, ForeignKey("orders.order_id"))
    claimant_user_id: Mapped[str] = mapped_column(String, ForeignKey("users.user_id"))
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Shipping (populated when fulfiller marks as "shipped")
    tracking_number: Mapped[str | None] = mapped_column(String, nullable=True)
    label_url: Mapped[str | None] = mapped_column(String, nullable=True)
    carrier_code: Mapped[str | None] = mapped_column(String, nullable=True)
    shipment_id: Mapped[str | None] = mapped_column(String, nullable=True)

    # Relationships
    order: Mapped["Order"] = relationship("Order", back_populates="claims", lazy="noload")
    disbursements: Mapped[list["Disbursement"]] = relationship("Disbursement", back_populates="claim", lazy="selectin", cascade="all, delete-orphan")

class Disbursement(Base):
    __tablename__ = "disbursements"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    claim_id: Mapped[str] = mapped_column(String, ForeignKey("claims.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.user_id"), nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    stripe_transfer_id: Mapped[str | None] = mapped_column(String, nullable=True)

    claim: Mapped["Claim"] = relationship("Claim", back_populates="disbursements", lazy="noload")


class UserStripeAccount(Base):
    __tablename__ = "user_stripe_accounts"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.user_id"), nullable=False, unique=True)
    stripe_account_id: Mapped[str] = mapped_column(String, nullable=False)
    account_type: Mapped[str] = mapped_column(String, default="express")
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Fulfiller shipping address (ship-from)
    address_name: Mapped[str | None] = mapped_column(String, nullable=True)
    address_line1: Mapped[str | None] = mapped_column(String, nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String, nullable=True)
    address_city: Mapped[str | None] = mapped_column(String, nullable=True)
    address_postal_code: Mapped[str | None] = mapped_column(String, nullable=True)
    address_country: Mapped[str | None] = mapped_column(String, nullable=True)


class ClaimEvidence(Base):
    __tablename__ = "claim_evidence"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    claim_id: Mapped[str] = mapped_column(String, ForeignKey("claims.id"), nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    status_at_upload: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    claim = relationship("Claim", backref=backref("evidence", lazy="selectin"), lazy="noload")


class ClaimStatusHistory(Base):
    __tablename__ = "claim_status_history"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    claim_id: Mapped[str] = mapped_column(String, ForeignKey("claims.id"), nullable=False)
    previous_status: Mapped[str] = mapped_column(String, nullable=False)
    new_status: Mapped[str] = mapped_column(String, nullable=False)
    changed_by: Mapped[str] = mapped_column(String, ForeignKey("users.user_id"), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    claim = relationship("Claim", backref=backref("status_history", lazy="selectin"), lazy="noload")


class Dispute(Base):
    __tablename__ = "disputes"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    claim_id: Mapped[str] = mapped_column(String, ForeignKey("claims.id"), nullable=False, unique=True)
    opened_by: Mapped[str] = mapped_column(String, ForeignKey("users.user_id"), nullable=False)
    reason: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="open")  # open | responded | resolved
    resolution: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # accepted | partial | rejected
    resolution_amount_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    resolved_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # "buyer" | "auto"
    fulfiller_response: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    responded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    fulfiller_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    buyer_deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    claim = relationship("Claim", backref=backref("dispute", uselist=False, lazy="selectin"), lazy="noload")


class ManufacturingProcess(Base):
    __tablename__ = "manufacturing_processes"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    family: Mapped[str] = mapped_column(String, nullable=False)  # 3d_printing, cnc, sheet_metal, casting, injection_molding
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)  # e.g. "FDM", "3-axis CNC"
    display_name: Mapped[str] = mapped_column(String, nullable=False)


class ManufacturingMaterial(Base):
    __tablename__ = "manufacturing_materials"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    category: Mapped[str] = mapped_column(String, nullable=False)  # e.g. "thermoplastic", "metal"
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)  # e.g. "PLA", "Aluminum 6061"
    process_family: Mapped[str] = mapped_column(String, nullable=False)  # links to ManufacturingProcess.family


class FulfillerProfile(Base):
    __tablename__ = "fulfiller_profiles"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.user_id"), nullable=False, unique=True)
    business_name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    max_build_volume_x: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_build_volume_y: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_build_volume_z: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    min_tolerance_mm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lead_time_days_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    lead_time_days_max: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    certifications: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string array
    post_processing: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string array
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    capabilities: Mapped[list["FulfillerCapability"]] = relationship(
        "FulfillerCapability", back_populates="profile", cascade="all, delete-orphan", lazy="selectin"
    )
    user = relationship("User", backref=backref("fulfiller_profile", uselist=False, lazy="noload"), lazy="noload")


class FulfillerCapability(Base):
    __tablename__ = "fulfiller_capabilities"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    profile_id: Mapped[str] = mapped_column(String, ForeignKey("fulfiller_profiles.id"), nullable=False)
    process_id: Mapped[str] = mapped_column(String, ForeignKey("manufacturing_processes.id"), nullable=False)
    materials: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array of material IDs
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    profile: Mapped["FulfillerProfile"] = relationship("FulfillerProfile", back_populates="capabilities")
    process: Mapped["ManufacturingProcess"] = relationship("ManufacturingProcess", lazy="selectin")


class Part(Base):
    __tablename__ = "parts"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    publisher_user_id: Mapped[str] = mapped_column(String, ForeignKey("users.user_id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    tags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array
    task_id: Mapped[str] = mapped_column(String, ForeignKey("tasks.task_id"), nullable=False)
    file_type: Mapped[str] = mapped_column(String, nullable=False)  # stl/obj/step
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    bounding_box_x: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bounding_box_y: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bounding_box_z: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    volume_cm3: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    surface_area_cm2: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    recommended_process: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    recommended_material: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="draft")  # draft/published/archived
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    download_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    publisher = relationship("User", backref=backref("published_parts", lazy="noload"), lazy="noload")
    task = relationship("Task", backref=backref("part", uselist=False, lazy="joined"), lazy="joined")


class FileAsset(Base):
    __tablename__ = "file_assets"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    task_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("tasks.task_id"), nullable=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.user_id"), nullable=False)
    file_type: Mapped[str] = mapped_column(String, nullable=False)  # step/stl/obj/gltf/thumbnail
    storage_backend: Mapped[str] = mapped_column(String, nullable=False, default="local")  # local/s3
    storage_key: Mapped[str] = mapped_column(String, nullable=False)  # local path or S3 key
    original_filename: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    content_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    processing_status: Mapped[str] = mapped_column(String, default="pending")  # pending/processing/complete/failed
    bounding_box_x: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bounding_box_y: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bounding_box_z: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    volume_mm3: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    surface_area_mm2: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    preview_asset_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("file_assets.id"), nullable=True)
    thumbnail_asset_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("file_assets.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", backref=backref("file_assets", lazy="noload"), lazy="noload")
    preview_asset = relationship("FileAsset", foreign_keys=[preview_asset_id], remote_side="FileAsset.id", lazy="joined")
    thumbnail_asset = relationship("FileAsset", foreign_keys=[thumbnail_asset_id], remote_side="FileAsset.id", lazy="joined")

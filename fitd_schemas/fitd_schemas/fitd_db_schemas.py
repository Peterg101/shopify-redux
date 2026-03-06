from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, UniqueConstraint
from sqlalchemy.orm import backref, declarative_base
from datetime import datetime
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship, Mapped, mapped_column
from typing import Optional
from uuid import uuid4


Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    user_id = Column(String, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String, nullable=True)
    auth_provider = Column(String, default="google")
    tasks = relationship("Task", back_populates="owner")


class Task(Base):
    __tablename__ = "tasks"
    task_id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.user_id"))
    task_name = Column(String)
    complete = Column(Boolean, default=False)
    created_at = Column(String, default=datetime.now().isoformat())
    owner = relationship("User", back_populates="tasks")

    # Optional one-to-one relationship to PortID
    port = relationship("PortID", back_populates="task", uselist=False)

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


class PortID(Base):
    __tablename__ = "port_id"
    task_id: Mapped[str] = mapped_column(
        ForeignKey("tasks.task_id"), primary_key=True
    )  # Foreign key to Task
    port_id: Mapped[str] = mapped_column()

    # Back reference to Task
    task = relationship("Task", back_populates="port")


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

    # Shipping address (collected from Stripe Checkout)
    shipping_name: Mapped[str | None] = mapped_column(String, nullable=True)
    shipping_line1: Mapped[str | None] = mapped_column(String, nullable=True)
    shipping_line2: Mapped[str | None] = mapped_column(String, nullable=True)
    shipping_city: Mapped[str | None] = mapped_column(String, nullable=True)
    shipping_postal_code: Mapped[str | None] = mapped_column(String, nullable=True)
    shipping_country: Mapped[str | None] = mapped_column(String, nullable=True)

    # Relationships
    user = relationship("User", backref="orders")
    task = relationship("Task", backref="order", uselist=False)
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
    order: Mapped["Order"] = relationship("Order", back_populates="claims", lazy="selectin")
    disbursements: Mapped[list["Disbursement"]] = relationship("Disbursement", back_populates="claim")

class Disbursement(Base):
    __tablename__ = "disbursements"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    claim_id: Mapped[str] = mapped_column(String, ForeignKey("claims.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.user_id"), nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    claim: Mapped["Claim"] = relationship("Claim", back_populates="disbursements")


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


class PayoutRecord(Base):
    __tablename__ = "payouts"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    claim_id: Mapped[str] = mapped_column(String, nullable=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    stripe_transfer_id: Mapped[str] = mapped_column(String, nullable=True)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String, default="gbp")
    status: Mapped[str] = mapped_column(String, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class ClaimEvidence(Base):
    __tablename__ = "claim_evidence"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    claim_id: Mapped[str] = mapped_column(String, ForeignKey("claims.id"), nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    status_at_upload: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    claim = relationship("Claim", backref="evidence")


class ClaimStatusHistory(Base):
    __tablename__ = "claim_status_history"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    claim_id: Mapped[str] = mapped_column(String, ForeignKey("claims.id"), nullable=False)
    previous_status: Mapped[str] = mapped_column(String, nullable=False)
    new_status: Mapped[str] = mapped_column(String, nullable=False)
    changed_by: Mapped[str] = mapped_column(String, ForeignKey("users.user_id"), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    claim = relationship("Claim", backref="status_history")


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
    claim = relationship("Claim", backref=backref("dispute", uselist=False))

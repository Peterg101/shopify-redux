from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
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

    item_id: Mapped[str] = mapped_column(
        String, 
        primary_key=True, 
        default=lambda: str(uuid4())
    )
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.task_id"), nullable=False)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.user_id"))
    order_id: Mapped[str] = mapped_column(nullable=False)
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

    user = relationship("User", backref="orders")
    task = relationship("Task", backref="order", uselist=False)


class Claim(Base):
    __tablename__ = "claims"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    order_id: Mapped[str] = mapped_column(String, nullable=False)
    claimant_user_id: Mapped[str] = mapped_column(String, ForeignKey("users.user_id"))
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

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


class PayoutRecord(Base):
    __tablename__ = "payouts"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    claim_id: Mapped[str] = mapped_column(String, nullable=True)  # optional reference to main app claim id
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    stripe_transfer_id: Mapped[str] = mapped_column(String, nullable=True)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String, default="gbp")
    status: Mapped[str] = mapped_column(String, default="pending")  # pending/paid/failed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

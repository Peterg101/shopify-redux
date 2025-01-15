from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship, Mapped, mapped_column



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
    sizing: Mapped[int] = mapped_column()
    colour: Mapped[str] = mapped_column()
    selectedFile: Mapped[str] = mapped_column()
    selectedFileType: Mapped[str] = mapped_column()


class PortID(Base):
    __tablename__ = "port_id"
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.task_id"), primary_key=True)  # Foreign key to Task
    port_id: Mapped[str] = mapped_column()

    # Back reference to Task
    task = relationship("Task", back_populates="port")
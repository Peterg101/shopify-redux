# Backend Best Practices — SQLAlchemy 2.x, FastAPI, Pydantic v1, pytest

## SQLAlchemy 2.x ORM Patterns

### Model Definitions: Mapped[] + mapped_column()

**DO: Use modern declarative style with type annotations**
```python
from sqlalchemy import String, ForeignKey, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from typing import Optional, List
import datetime

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    fullname: Mapped[Optional[str]]                    # Optional → nullable=True
    email: Mapped[str] = mapped_column(unique=True)    # Not Optional → nullable=False
    created_at: Mapped[datetime.datetime] = mapped_column(
        server_default=func.now()
    )
    addresses: Mapped[List["Address"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
```

**DON'T: Use legacy Column() style in new code**
```python
# WRONG — legacy pattern, no type safety, no IDE support
class User(Base):
    __tablename__ = "user"
    id = Column(Integer, primary_key=True)
    name = Column(String(50))
```

### Reusable Column Types with Annotated

**DO: Define reusable column configurations**
```python
from typing_extensions import Annotated

intpk = Annotated[int, mapped_column(primary_key=True)]
timestamp = Annotated[
    datetime.datetime,
    mapped_column(nullable=False, server_default=func.CURRENT_TIMESTAMP()),
]
required_name = Annotated[str, mapped_column(String(30), nullable=False)]

class Order(Base):
    __tablename__ = "order"
    id: Mapped[intpk]
    customer_name: Mapped[required_name]
    created_at: Mapped[timestamp]
```

### Nullability Rules

```python
# NOT NULL — use plain type
name: Mapped[str]

# NULLABLE — use Optional
nickname: Mapped[Optional[str]]

# Override: Optional type but force NOT NULL
value: Mapped[Optional[str]] = mapped_column(nullable=False)
```

### Enum Support

```python
import enum

class OrderStatus(enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

class Order(Base):
    __tablename__ = "order"
    id: Mapped[int] = mapped_column(primary_key=True)
    status: Mapped[OrderStatus]  # Automatically creates Enum column
```

### Table Arguments (Constraints, Schema)

```python
from sqlalchemy import ForeignKeyConstraint, UniqueConstraint

class MyTable(Base):
    __tablename__ = "my_table"
    __table_args__ = (
        UniqueConstraint("email", "tenant_id"),
        ForeignKeyConstraint(["parent_id"], ["parent.id"]),
        {"schema": "my_schema"},
    )
```

### Custom Type Annotation Map

```python
from sqlalchemy import BIGINT, TIMESTAMP, String

class Base(DeclarativeBase):
    type_annotation_map = {
        int: BIGINT,
        datetime.datetime: TIMESTAMP(timezone=True),
        str: String().with_variant(String(255), "mysql"),
    }
```

---

## Relationship Patterns

### One-to-Many

```python
class Parent(Base):
    __tablename__ = "parent"
    id: Mapped[int] = mapped_column(primary_key=True)
    children: Mapped[List["Child"]] = relationship(
        back_populates="parent",
        cascade="all, delete-orphan"
    )

class Child(Base):
    __tablename__ = "child"
    id: Mapped[int] = mapped_column(primary_key=True)
    parent_id: Mapped[int] = mapped_column(ForeignKey("parent.id"))
    parent: Mapped["Parent"] = relationship(back_populates="children")
```

### Many-to-Many

```python
from sqlalchemy import Table, Column, ForeignKey

association_table = Table(
    "association",
    Base.metadata,
    Column("left_id", ForeignKey("left.id"), primary_key=True),
    Column("right_id", ForeignKey("right.id"), primary_key=True),
)

class Left(Base):
    __tablename__ = "left"
    id: Mapped[int] = mapped_column(primary_key=True)
    rights: Mapped[List["Right"]] = relationship(
        secondary=association_table, back_populates="lefts"
    )

class Right(Base):
    __tablename__ = "right"
    id: Mapped[int] = mapped_column(primary_key=True)
    lefts: Mapped[List["Left"]] = relationship(
        secondary=association_table, back_populates="rights"
    )
```

---

## Eager Loading Strategies (N+1 Prevention)

### Summary Table

| Strategy | Best For | Trade-offs |
|----------|----------|------------|
| `selectinload` | Collections (one-to-many, many-to-many) — **default choice** | Extra SELECT with IN clause; clean primary result |
| `joinedload` | Many-to-one / scalar references | Single query via JOIN; multiplies rows for collections |
| `subqueryload` | Legacy — only for SQL Server composite keys | Replaced by selectinload in almost all cases |
| `raiseload` | Development safety — catch unintended lazy loads | Raises exception on attribute access |
| `lazyload` | Default — causes N+1, avoid for known access patterns | One query per accessed relationship |

### DO: Use selectinload for collections

```python
from sqlalchemy import select
from sqlalchemy.orm import selectinload

# Good — 2 queries total regardless of number of users
stmt = select(User).options(selectinload(User.addresses))
result = session.scalars(stmt).all()
```

Generated SQL:
```sql
-- Query 1: Load users
SELECT users.id, users.name FROM users

-- Query 2: Load all addresses for matched users in one shot
SELECT addresses.id, addresses.user_id, addresses.email
FROM addresses WHERE addresses.user_id IN (1, 2, 3, ...)
```

### DO: Use joinedload for many-to-one / scalar references

```python
from sqlalchemy.orm import joinedload

# Good — single query for scalar reference
stmt = select(Address).options(joinedload(Address.user))
result = session.scalars(stmt).unique().all()
```

**IMPORTANT: Always call `.unique()` when using joinedload with collections** — the JOIN multiplies rows.

### DO: Use raiseload during development to catch N+1

```python
from sqlalchemy.orm import raiseload, joinedload

# Eager load items, raise on everything else
stmt = select(Order).options(
    joinedload(Order.items),
    raiseload("*")
)
```

### DO: Chain loading strategies for nested relationships

```python
stmt = select(User).options(
    selectinload(User.orders).selectinload(Order.items)
)
```

### DO: Set default loading strategy at relationship level

```python
class User(Base):
    __tablename__ = "user"
    id: Mapped[int] = mapped_column(primary_key=True)
    addresses: Mapped[List["Address"]] = relationship(lazy="selectin")
```

### DON'T: Rely on default lazy loading for known access patterns

```python
# WRONG — N+1 problem: 1 query for users + N queries for addresses
users = session.scalars(select(User)).all()
for user in users:
    print(user.addresses)  # Each access triggers a separate SELECT
```

### DON'T: Use subqueryload — it's legacy

```python
# WRONG — use selectinload instead
stmt = select(User).options(subqueryload(User.addresses))
```

---

## Query Patterns (SQLAlchemy 2.0 Style)

### DO: Use select() with session.execute() / session.scalars()

```python
from sqlalchemy import select

# Single object
user = session.scalars(select(User).where(User.id == 5)).one_or_none()

# Multiple objects
users = session.scalars(select(User).where(User.name.like("%bob%"))).all()

# Get by primary key (shorthand)
user = session.get(User, 5)

# Select specific columns
rows = session.execute(select(User.name, User.email)).all()
```

### DON'T: Use legacy Query API

```python
# WRONG — deprecated in 2.0
user = session.query(User).filter_by(name="bob").first()
```

### Bulk INSERT

```python
from sqlalchemy import insert

# Fast bulk insert — bypasses ORM identity map
session.execute(
    insert(User),
    [
        {"name": "alice", "email": "alice@example.com"},
        {"name": "bob", "email": "bob@example.com"},
    ],
)
session.commit()
```

### Bulk INSERT with RETURNING

```python
users = session.scalars(
    insert(User).returning(User),
    [
        {"name": "alice", "email": "alice@example.com"},
        {"name": "bob", "email": "bob@example.com"},
    ],
).all()
```

### Bulk UPDATE by Primary Key

```python
from sqlalchemy import update

session.execute(
    update(User),
    [
        {"id": 1, "fullname": "Alice Updated"},
        {"id": 3, "fullname": "Bob Updated"},
    ],
)
```

### Filtered UPDATE/DELETE

```python
# Update with WHERE clause
session.execute(
    update(User)
    .where(User.status == "inactive")
    .values(archived=True)
)

# Delete with WHERE clause
from sqlalchemy import delete
session.execute(
    delete(User).where(User.last_login < cutoff_date)
)
```

### Upsert (Database-Specific)

```python
# PostgreSQL
from sqlalchemy.dialects.postgresql import insert as pg_upsert

stmt = pg_upsert(User).values(name="alice", email="alice@example.com")
stmt = stmt.on_conflict_do_update(
    index_elements=[User.email],
    set_={"name": stmt.excluded.name}
)
session.execute(stmt)

# SQLite
from sqlalchemy.dialects.sqlite import insert as sqlite_upsert
stmt = sqlite_upsert(User).values([...])
stmt = stmt.on_conflict_do_update(
    index_elements=[User.name],
    set_=dict(fullname=stmt.excluded.fullname)
)
session.execute(stmt)
```

---

## Session & Transaction Management

### DO: Use context managers for session lifecycle

```python
from sqlalchemy.orm import Session, sessionmaker

Session = sessionmaker(engine)

# Pattern 1: Manual commit
with Session() as session:
    session.add(some_object)
    session.commit()

# Pattern 2: Auto-commit on success, auto-rollback on exception
with Session.begin() as session:
    session.add(some_object)
    session.add(another_object)
# Automatically commits; rolls back on exception

# Pattern 3: Combined context managers
with Session() as session, session.begin():
    session.add(some_object)
# Commits and closes automatically
```

### DO: Keep session lifecycle external to data functions

```python
# CORRECT — session managed externally
class OrderService:
    def create_order(self, session: Session, data: dict) -> Order:
        order = Order(**data)
        session.add(order)
        return order

    def update_status(self, session: Session, order_id: int, status: str):
        order = session.get(Order, order_id)
        order.status = status

# Caller manages the transaction
with Session.begin() as session:
    service = OrderService()
    order = service.create_order(session, order_data)
    service.update_status(session, order.id, "confirmed")
# Single transaction for both operations
```

### DON'T: Create sessions inside data-access functions

```python
# WRONG — each function manages its own session/transaction
class OrderService:
    def create_order(self, data):
        session = Session()
        try:
            order = Order(**data)
            session.add(order)
            session.commit()  # Commits too early
        except:
            session.rollback()
            raise
```

### Nested Transactions (Savepoints)

```python
with Session.begin() as session:
    session.add(user1)
    session.add(user2)

    nested = session.begin_nested()  # SAVEPOINT
    session.add(user3)
    nested.rollback()  # Rolls back only user3

# Commits user1 and user2
```

**Error handling with savepoints:**
```python
for record in records:
    try:
        with session.begin_nested():
            session.merge(record)
    except IntegrityError:
        print(f"Skipped duplicate: {record}")
session.commit()
```

### Key Rules

- `session.commit()` always commits the **outermost** transaction (SQLAlchemy 2.0 behavior)
- `session.begin_nested()` always flushes pending state before creating the savepoint
- After rollback to savepoint, in-memory objects modified since the savepoint are expired
- Sessions are **NOT thread-safe** — one session per thread/task

---

## FastAPI Integration

### Sync Session Dependency (Current FITD Pattern)

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi import Depends

engine = create_engine(
    DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600,
)
SessionLocal = sessionmaker(bind=engine)

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/users/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.scalars(select(User).where(User.id == user_id)).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

### Async Session Dependency (Production Target)

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

engine = create_async_engine(
    "postgresql+asyncpg://user:pass@localhost/db",
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=1800,
)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)

async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

# Type alias for cleaner injection
from typing import Annotated
AsyncSessionDep = Annotated[AsyncSession, Depends(get_async_session)]

@app.get("/users/{user_id}")
async def get_user(user_id: int, session: AsyncSessionDep):
    result = await session.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

### Async Model Base with AsyncAttrs

```python
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import DeclarativeBase

class Base(AsyncAttrs, DeclarativeBase):
    pass

# Allows awaiting lazy-loaded attributes in async context
for b in await some_a.awaitable_attrs.bs:
    print(b.data)
```

### DO: Set expire_on_commit=False for async sessions
This prevents lazy-load attempts after commit, which fail in async context.

### DON'T: Share async sessions across concurrent tasks
A single AsyncSession instance is NOT safe for concurrent use.

---

## Connection Pooling

### Pool Types

| Pool | When to Use |
|------|-------------|
| `QueuePool` (default) | Standard web apps — manages pool of reusable connections |
| `NullPool` | Serverless (Lambda), multiprocessing — no persistent connections |
| `StaticPool` | Testing with in-memory SQLite — single shared connection |
| `AsyncAdaptedQueuePool` | Automatically used with `create_async_engine` |

### Production Configuration

```python
engine = create_engine(
    DATABASE_URL,
    pool_size=20,          # Persistent connections (default: 5)
    max_overflow=10,        # Temporary overflow (default: 10)
    pool_timeout=30,        # Wait time before error (seconds)
    pool_recycle=3600,      # Refresh connections every hour (for MySQL)
    pool_pre_ping=True,     # Test connection liveness before checkout
    pool_use_lifo=True,     # Better for server-side timeout handling
)
```

### Key Rules

- **pool_pre_ping=True** — Always enable in production. Detects stale connections before use.
- **pool_recycle** — Required for MySQL/MariaDB which close idle connections (default 8 hours).
- **pool_use_lifo=True** — Reuses most recently returned connections, lets idle ones expire naturally.
- Target 70-85% pool utilization for optimal performance.
- **Never share connections across process boundaries** after `fork()`. Call `engine.dispose(close=False)` in child processes.

### Multiprocessing Safety

```python
from multiprocessing import Pool

def child_initializer():
    engine.dispose(close=False)  # Clear parent's connections

def worker(data):
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))

with Pool(10, initializer=child_initializer) as p:
    p.map(worker, data_list)
```

---

## Alembic Migration Patterns

### Project Setup

```bash
alembic init alembic
```

### env.py Configuration

```python
# alembic/env.py
from fitd_schemas.fitd_db_schemas import Base

target_metadata = Base.metadata

def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # Required for SQLite ALTER TABLE support
        )
        with context.begin_transaction():
            context.run_migrations()
```

### Generate Migration

```bash
# Auto-detect schema changes
alembic revision --autogenerate -m "add user email column"

# Manual migration
alembic revision -m "add custom index"
```

### Apply/Revert Migrations

```bash
alembic upgrade head          # Apply all pending
alembic upgrade +1            # Apply next one
alembic downgrade -1          # Revert last one
alembic current               # Show current revision
alembic history               # Show migration history
```

### Best Practices

1. **Always review autogenerated migrations** — autogenerate is not perfect; it cannot detect renamed columns, table renames, or changes to constraints reliably.
2. **Use `render_as_batch=True`** for SQLite compatibility (the project uses SQLite for testing).
3. **Keep migrations small and focused** — one logical change per migration.
4. **Test downgrade paths** — ensure every `upgrade()` has a working `downgrade()`.
5. **Never modify a migration that has been applied** — create a new one instead.
6. **Back up the database before migrations in production**.
7. **Include migrations in version control** (Git).

### Batch Operations (SQLite)

```python
def upgrade():
    with op.batch_alter_table("user") as batch_op:
        batch_op.add_column(sa.Column("email", sa.String(255)))
        batch_op.create_unique_constraint("uq_user_email", ["email"])

def downgrade():
    with op.batch_alter_table("user") as batch_op:
        batch_op.drop_constraint("uq_user_email", type_="unique")
        batch_op.drop_column("email")
```

**WARNING:** Batch operations recreate the table (copy data, drop old, rename new). Foreign keys referencing the table will break during this process.

---

## Performance Optimization

### Query Optimization

1. **Add indexes** to frequently queried columns:
   ```python
   class User(Base):
       __tablename__ = "user"
       email: Mapped[str] = mapped_column(String(255), index=True)
   ```

2. **Use `echo=True` for profiling** during development:
   ```python
   engine = create_engine(DATABASE_URL, echo=True)
   ```

3. **Select only needed columns** for read-heavy endpoints:
   ```python
   # Instead of loading full ORM objects
   stmt = select(User.id, User.name, User.email).where(User.active == True)
   rows = session.execute(stmt).all()
   ```

4. **Use `.one_or_none()` / `.first()` instead of `.all()` when expecting single results**.

5. **Deferred column loading** for expensive columns:
   ```python
   from sqlalchemy import Text

   class Article(Base):
       __tablename__ = "article"
       id: Mapped[int] = mapped_column(primary_key=True)
       title: Mapped[str]
       body: Mapped[str] = mapped_column(Text, deferred=True)  # Loaded only on access
   ```

### Bulk Operations (High Volume)

```python
# Fast: Bulk insert bypasses ORM identity map
session.execute(insert(User), list_of_dicts)

# Slow: Individual adds — use only when you need ORM events/relationships
for data in list_of_dicts:
    session.add(User(**data))

# Fast: Use add_all for moderate volumes
session.add_all([User(**d) for d in list_of_dicts])
```

### Avoid Legacy Bulk Methods

```python
# WRONG — deprecated
session.bulk_insert_mappings(User, list_of_dicts)
session.bulk_update_mappings(User, list_of_dicts)

# CORRECT — use Session.execute() with insert/update
session.execute(insert(User), list_of_dicts)
session.execute(update(User), list_of_dicts_with_pks)
```

---

## Testing with SQLAlchemy

### In-Memory SQLite with StaticPool (Current FITD Pattern)

```python
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)
```

### External Transaction Pattern (Rollback Between Tests)

```python
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

@pytest.fixture
def session(engine):
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")

    yield session

    session.close()
    transaction.rollback()
    connection.close()
```

This pattern wraps each test in a transaction that gets rolled back, ensuring test isolation without recreating the database.

### Async Testing

```python
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

@pytest_asyncio.fixture
async def async_session():
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with session_maker() as session:
        yield session

    await engine.dispose()
```

### Override Dependency in Tests

```python
@pytest.fixture
def client(session):
    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
```

---

## Pydantic v1 Patterns (FITD Uses v1.10.8)

**IMPORTANT: This project uses Pydantic v1. Do NOT use v2 patterns.**

### DO: Use v1 syntax

```python
from pydantic import BaseModel, validator

class UserResponse(BaseModel):
    id: int
    name: str
    email: str

    class Config:
        orm_mode = True  # Enables .from_orm()

# Usage
user_response = UserResponse.from_orm(db_user)
user_dict = user_response.dict()
```

### DON'T: Use v2 syntax

```python
# WRONG for this project
from pydantic import BaseModel

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # v2 pattern

user_response = UserResponse.model_validate(db_user)  # v2 method
user_dict = user_response.model_dump()                 # v2 method
```

### v1 Validators

```python
from pydantic import BaseModel, validator

class OrderCreate(BaseModel):
    quantity: int
    material: str

    @validator("quantity")
    def quantity_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("quantity must be positive")
        return v
```

---

## FastAPI Error Handling

### DO: Use HTTPException with meaningful messages

```python
from fastapi import HTTPException

@app.get("/orders/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    return order
```

### DO: Use auth dependencies consistently

```python
# User-facing endpoints
@app.get("/my-orders")
def get_my_orders(
    user_id: str = Depends(cookie_verification_user_only),
    db: Session = Depends(get_db)
):
    ...

# Inter-service endpoints
@app.post("/internal/process-order")
def process_order(
    payload: dict = Depends(verify_jwt_token),
    db: Session = Depends(get_db)
):
    ...
```

---

## Common Anti-Patterns to Avoid

1. **Lazy loading in async context** — Always use eager loading or `expire_on_commit=False`
2. **Session per function** — Session lifecycle belongs at the request/transaction boundary
3. **Raw SQL** — Use SQLAlchemy ORM; never `session.execute(text("SELECT * FROM ..."))`
4. **Shared sessions across threads/tasks** — One session per thread/async task
5. **Missing `.unique()` with joinedload** — JOIN duplicates rows; unique() deduplicates
6. **Committing inside nested functions** — Let the outermost caller control the transaction
7. **Ignoring pool_pre_ping** — Stale connections cause random failures in production
8. **Large result sets without pagination** — Use `.limit()` and `.offset()`
9. **Using subqueryload** — It's legacy; use selectinload instead
10. **Modifying applied migrations** — Always create new migrations

---

## Sources

- [SQLAlchemy 2.0 ORM Declarative Tables](https://docs.sqlalchemy.org/en/20/orm/declarative_tables.html)
- [SQLAlchemy 2.0 Relationship Loading Techniques](https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html)
- [SQLAlchemy 2.0 Session Basics](https://docs.sqlalchemy.org/en/20/orm/session_basics.html)
- [SQLAlchemy 2.0 Transaction Management](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html)
- [SQLAlchemy 2.0 Connection Pooling](https://docs.sqlalchemy.org/en/20/core/pooling.html)
- [SQLAlchemy 2.0 Async Extension](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [SQLAlchemy 2.0 Bulk DML Operations](https://docs.sqlalchemy.org/en/20/orm/queryguide/dml.html)
- [SQLAlchemy 2.0 Basic Relationships](https://docs.sqlalchemy.org/en/21/orm/basic_relationships.html)
- [Alembic Autogenerate](https://alembic.sqlalchemy.org/en/latest/autogenerate.html)
- [Alembic Batch Migrations](https://alembic.sqlalchemy.org/en/latest/batch.html)
- [Alembic Best Practices — PingCAP](https://www.pingcap.com/article/best-practices-alembic-schema-migration/)
- [FastAPI + SQLAlchemy Patterns](https://oneuptime.com/blog/post/2026-01-27-sqlalchemy-fastapi/view)
- [SQLAlchemy Loading Strategies — Dr Ceran](https://medium.com/@dresraceran/understanding-sqlalchemys-eager-loading-joinedload-selectinload-and-contains-eager-e12d98c8c8b0)
- [Async FastAPI with SQLAlchemy](https://gichon.com/blog/async-fastapi-with-sqlalchemy-session)
- [SQLAlchemy Eager Loading Guide](https://copdips.com/2024/03/sqlalchemy-eager-loading.html)

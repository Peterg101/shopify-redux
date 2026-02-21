import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fitd_schemas.fitd_db_schemas import Base, User, Task, Order, Claim, BasketItem, Disbursement, UserStripeAccount
from fitd_schemas.fitd_classes import (
    ClaimOrder,
    ClaimStatusUpdate,
    UserInformation,
    BasketQuantityUpdate,
    ClaimResponse,
    OrderResponse,
    ClaimWithOrderResponse,
    UserHydrationResponse,
)
from datetime import datetime


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


def test_user_model(db):
    user = User(user_id="u1", username="alice", email="alice@test.com")
    db.add(user)
    db.commit()
    fetched = db.query(User).filter_by(user_id="u1").first()
    assert fetched.username == "alice"
    assert fetched.email == "alice@test.com"


def test_order_model(db):
    user = User(user_id="u1", username="alice", email="alice@test.com")
    task = Task(task_id="t1", user_id="u1", task_name="Test")
    db.add(user)
    db.add(task)
    db.commit()

    order = Order(
        order_id="o1",
        task_id="t1",
        user_id="u1",
        name="Print",
        material="PLA",
        technique="FDM",
        sizing=1.0,
        colour="white",
        selectedFile="test.obj",
        selectedFileType="obj",
        price=10.0,
        quantity=5,
    )
    db.add(order)
    db.commit()
    fetched = db.query(Order).filter_by(order_id="o1").first()
    assert fetched.name == "Print"
    assert fetched.quantity == 5


def test_order_quantity_claimed_property(db):
    user = User(user_id="u1", username="alice", email="alice@test.com")
    user2 = User(user_id="u2", username="bob", email="bob@test.com")
    task = Task(task_id="t1", user_id="u1", task_name="Test")
    db.add_all([user, user2, task])
    db.commit()

    order = Order(
        order_id="o1",
        task_id="t1",
        user_id="u1",
        name="Print",
        material="PLA",
        technique="FDM",
        sizing=1.0,
        colour="white",
        selectedFile="test.obj",
        selectedFileType="obj",
        price=10.0,
        quantity=5,
    )
    db.add(order)
    db.commit()

    assert order.quantity_claimed == 0

    claim = Claim(
        order_id="o1",
        claimant_user_id="u2",
        quantity=3,
        status="pending",
    )
    db.add(claim)
    db.commit()
    db.refresh(order)

    assert order.quantity_claimed == 3


def test_claim_order_pydantic_no_id():
    """ClaimOrder should not have an id field after our Phase 1 fix."""
    claim = ClaimOrder(order_id="o1", quantity=2, status="pending")
    assert claim.order_id == "o1"
    assert not hasattr(claim, "id") or "id" not in claim.dict()


def test_claim_status_update_pydantic():
    update = ClaimStatusUpdate(status="in_progress")
    assert update.status == "in_progress"


def test_user_information_pydantic():
    user = UserInformation(user_id="u1", username="alice", email="alice@test.com")
    assert user.user_id == "u1"


def test_basket_quantity_update_pydantic():
    update = BasketQuantityUpdate(task_id="t1", quantity=5)
    assert update.task_id == "t1"
    assert update.quantity == 5


def test_disbursement_model(db):
    user = User(user_id="u1", username="alice", email="alice@test.com")
    user2 = User(user_id="u2", username="bob", email="bob@test.com")
    task = Task(task_id="t1", user_id="u1", task_name="Test")
    db.add_all([user, user2, task])
    db.commit()

    order = Order(
        order_id="o1", task_id="t1", user_id="u1",
        name="Print", material="PLA", technique="FDM",
        sizing=1.0, colour="white", selectedFile="test.obj",
        selectedFileType="obj", price=10.0, quantity=5,
    )
    db.add(order)
    db.commit()

    claim = Claim(order_id="o1", claimant_user_id="u2", quantity=2, status="completed")
    db.add(claim)
    db.commit()

    disbursement = Disbursement(
        claim_id=claim.id,
        user_id="u2",
        amount_cents=400,
        status="pending",
    )
    db.add(disbursement)
    db.commit()

    fetched = db.query(Disbursement).first()
    assert fetched.amount_cents == 400
    assert fetched.status == "pending"
    assert fetched.claim_id == claim.id


def test_user_stripe_account_model(db):
    user = User(user_id="u1", username="alice", email="alice@test.com")
    db.add(user)
    db.commit()

    account = UserStripeAccount(
        user_id="u1",
        stripe_account_id="acct_123",
        onboarding_complete=False,
    )
    db.add(account)
    db.commit()

    fetched = db.query(UserStripeAccount).first()
    assert fetched.stripe_account_id == "acct_123"
    assert fetched.onboarding_complete is False

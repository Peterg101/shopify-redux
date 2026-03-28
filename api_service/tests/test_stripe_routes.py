"""
Tests for db_service/routes/stripe.py — checkout, webhooks, payouts, onboarding, shipping.

Ported from stripe_service/tests/ and rewritten for direct DB access.
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime

from main import app
from stripe_utils import validate_stripe_header
from dependencies import get_current_user
from conftest import (
    TestingSessionLocal,
    override_get_current_user,
    override_get_current_user_claimant,
)
from fitd_schemas.fitd_db_schemas import (
    BasketItem, Order, Task, User, UserStripeAccount, Claim, Disbursement,
)


# ── Helpers ───────────────────────────────────────────────────────────────


def _seed_user(db, user_id="test-user-123", username="testuser", email="test@example.com"):
    user = User(user_id=user_id, username=username, email=email)
    db.add(user)
    db.commit()
    return user


def _seed_task(db, task_id="task-001", user_id="test-user-123"):
    task = Task(task_id=task_id, user_id=user_id, task_name="Test Task")
    db.add(task)
    db.commit()
    return task


def _seed_basket_item(db, **overrides):
    defaults = dict(
        task_id="task-001",
        user_id="test-user-123",
        name="Test Print",
        material="PLA",
        technique="FDM",
        sizing=1.0,
        colour="white",
        selectedFile="test.obj",
        selectedFileType="obj",
        price=19.99,
        quantity=2,
    )
    defaults.update(overrides)
    item = BasketItem(**defaults)
    db.add(item)
    db.commit()
    return item


def _seed_order(db, order_id="order-001", task_id="task-001", user_id="test-user-123", **overrides):
    defaults = dict(
        order_id=order_id,
        task_id=task_id,
        user_id=user_id,
        stripe_checkout_session_id="cs_test_123",
        name="Test Print",
        material="PLA",
        technique="FDM",
        sizing=1.0,
        colour="white",
        selectedFile="test.obj",
        selectedFileType="obj",
        price=10.0,
        quantity=2,
        created_at=datetime.utcnow().isoformat(),
        is_collaborative=False,
        status="created",
        shipping_name="John Doe",
        shipping_line1="42 Test Street",
        shipping_line2="Flat 3",
        shipping_city="London",
        shipping_postal_code="E1 6AN",
        shipping_country="GB",
        payment_intent="pi_test_123",
        transfer_group="tg_abc123",
    )
    defaults.update(overrides)
    order = Order(**defaults)
    db.add(order)
    db.commit()
    return order


def _seed_stripe_account(db, user_id="test-user-123", onboarding_complete=True, with_address=True):
    kwargs = dict(
        user_id=user_id,
        stripe_account_id="acct_fulfiller_123",
        onboarding_complete=onboarding_complete,
    )
    if with_address:
        kwargs.update(
            address_name="Fulfiller Name",
            address_line1="123 Print Street",
            address_city="Manchester",
            address_postal_code="M1 1AA",
            address_country="GB",
        )
    acct = UserStripeAccount(**kwargs)
    db.add(acct)
    db.commit()
    return acct


def _seed_claim(db, claim_id="claim-001", order_id="order-001", claimant_user_id="test-user-123", status="qa_check"):
    claim = Claim(
        id=claim_id,
        order_id=order_id,
        claimant_user_id=claimant_user_id,
        quantity=1,
        status=status,
    )
    db.add(claim)
    db.commit()
    return claim


def _seed_disbursement(db, claim_id="claim-001", user_id="test-user-123", amount_cents=1500, status="pending"):
    disb = Disbursement(
        claim_id=claim_id,
        user_id=user_id,
        amount_cents=amount_cents,
        status=status,
    )
    db.add(disb)
    db.commit()
    return disb


# ══════════════════════════════════════════════════════════════════════════
# CHECKOUT TESTS
# ══════════════════════════════════════════════════════════════════════════


@patch("routes.stripe.stripe")
def test_checkout_creates_session(mock_stripe, client, db_session):
    """POST /stripe/checkout with basket items returns checkout_url."""
    _seed_user(db_session)
    _seed_task(db_session)
    _seed_basket_item(db_session)

    mock_session = MagicMock()
    mock_session.url = "https://checkout.stripe.com/pay/cs_test_123"
    mock_stripe.checkout.Session.create.return_value = mock_session

    response = client.post("/stripe/checkout", json={})
    assert response.status_code == 201
    data = response.json()
    assert data["checkout_url"] == "https://checkout.stripe.com/pay/cs_test_123"

    # Verify Stripe was called with correct unit_amount (pence)
    call_kwargs = mock_stripe.checkout.Session.create.call_args[1]
    assert call_kwargs["line_items"][0]["price_data"]["unit_amount"] == 1999
    assert call_kwargs["line_items"][0]["quantity"] == 2
    assert call_kwargs["mode"] == "payment"

    # Verify payment_intent_data includes transfer_group
    assert "payment_intent_data" in call_kwargs
    assert call_kwargs["payment_intent_data"]["transfer_group"].startswith("tg_")

    # Verify is_collaborative defaults to False in metadata
    assert call_kwargs["metadata"]["is_collaborative"] == "False"


def test_checkout_empty_basket(client, db_session):
    """Empty basket returns 400."""
    _seed_user(db_session)

    response = client.post("/stripe/checkout", json={})
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


@patch("routes.stripe.stripe")
def test_checkout_community_sets_metadata(mock_stripe, client, db_session):
    """Community checkout sets is_collaborative=True in Stripe session metadata."""
    _seed_user(db_session)
    _seed_task(db_session)
    _seed_basket_item(db_session)

    mock_session = MagicMock()
    mock_session.url = "https://checkout.stripe.com/pay/cs_test_community"
    mock_stripe.checkout.Session.create.return_value = mock_session

    response = client.post("/stripe/checkout", json={"is_collaborative": True})
    assert response.status_code == 201

    call_kwargs = mock_stripe.checkout.Session.create.call_args[1]
    assert call_kwargs["metadata"]["is_collaborative"] == "True"
    assert call_kwargs["metadata"]["user_id"] == "test-user-123"


@patch("routes.stripe.stripe")
def test_checkout_multiple_items(mock_stripe, client, db_session):
    """Multiple basket items produce multiple line_items."""
    _seed_user(db_session)
    _seed_task(db_session, task_id="task-001")
    _seed_task(db_session, task_id="task-002")
    _seed_task(db_session, task_id="task-003")
    _seed_basket_item(db_session, task_id="task-001", name="Part A", price=10.00, quantity=1)
    _seed_basket_item(db_session, task_id="task-002", name="Part B", price=25.50, quantity=3)
    _seed_basket_item(db_session, task_id="task-003", name="Part C", price=99.99, quantity=1)

    mock_session = MagicMock()
    mock_session.url = "https://checkout.stripe.com/pay/cs_test_multi"
    mock_stripe.checkout.Session.create.return_value = mock_session

    response = client.post("/stripe/checkout", json={})
    assert response.status_code == 201

    call_kwargs = mock_stripe.checkout.Session.create.call_args[1]
    line_items = call_kwargs["line_items"]
    assert len(line_items) == 3


# ══════════════════════════════════════════════════════════════════════════
# WEBHOOK TESTS
# ══════════════════════════════════════════════════════════════════════════


def _override_webhook(event_dict):
    """Return an async override function for validate_stripe_header that returns the given event."""
    async def _override():
        return event_dict
    return _override


def _make_account_updated_event(charges_enabled, payouts_enabled, account_id="acct_test_123"):
    return {
        "type": "account.updated",
        "data": {
            "object": {
                "id": account_id,
                "charges_enabled": charges_enabled,
                "payouts_enabled": payouts_enabled,
            }
        }
    }


def _make_checkout_completed_event(payment_status="paid", user_id="test-user-123", is_collaborative=False):
    return {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_webhook_123",
                "payment_status": payment_status,
                "payment_intent": "pi_test_123",
                "metadata": {"user_id": user_id, "is_collaborative": str(is_collaborative)},
            }
        }
    }


@patch("routes.stripe.stripe")
def test_webhook_checkout_completed(mock_stripe, client, db_session):
    """checkout.session.completed creates orders from line items."""
    _seed_user(db_session)
    _seed_task(db_session)

    # Mock the Stripe Session.retrieve and PaymentIntent.retrieve
    mock_product = MagicMock()
    mock_product.name = "Test Print"
    mock_product.metadata = {
        "task_id": "task-001",
        "user_id": "test-user-123",
        "material": "PLA",
        "technique": "FDM",
        "sizing": "1.0",
        "colour": "white",
        "selectedFile": "test.obj",
        "selectedFileType": "obj",
    }

    mock_price = MagicMock()
    mock_price.product = mock_product

    mock_line_item = MagicMock()
    mock_line_item.price = mock_price
    mock_line_item.amount_total = 1999
    mock_line_item.quantity = 2

    mock_address = MagicMock()
    mock_address.line1 = "42 Test Street"
    mock_address.line2 = "Flat 3"
    mock_address.city = "London"
    mock_address.postal_code = "E1 6AN"
    mock_address.country = "GB"

    mock_shipping = MagicMock()
    mock_shipping.name = "John Doe"
    mock_shipping.address = mock_address

    mock_full_session = MagicMock()
    mock_full_session.line_items.data = [mock_line_item]
    mock_full_session.shipping_details = mock_shipping
    mock_stripe.checkout.Session.retrieve.return_value = mock_full_session

    mock_pi = MagicMock()
    mock_pi.transfer_group = "tg_abc123"
    mock_stripe.PaymentIntent.retrieve.return_value = mock_pi

    event = _make_checkout_completed_event("paid")
    app.dependency_overrides[validate_stripe_header] = _override_webhook(event)

    response = client.post("/webhook")
    assert response.status_code == 200
    assert response.json()["status"] == "orders_created"
    assert response.json()["order_count"] == 1

    # Verify order was actually created in DB
    orders = db_session.query(Order).filter(
        Order.stripe_checkout_session_id == "cs_test_webhook_123"
    ).all()
    db_session.expire_all()
    orders = db_session.query(Order).filter(
        Order.stripe_checkout_session_id == "cs_test_webhook_123"
    ).all()
    assert len(orders) == 1
    assert orders[0].shipping_name == "John Doe"
    assert orders[0].transfer_group == "tg_abc123"


def test_webhook_account_updated(client, db_session):
    """account.updated with charges+payouts enabled marks onboarding complete."""
    _seed_user(db_session)
    _seed_stripe_account(db_session, onboarding_complete=False, with_address=False)

    event = _make_account_updated_event(True, True, account_id="acct_fulfiller_123")
    app.dependency_overrides[validate_stripe_header] = _override_webhook(event)

    response = client.post("/webhook")
    assert response.status_code == 200
    assert response.json()["status"] == "onboarding_confirmed"

    # Verify DB was updated
    db_session.expire_all()
    acct = db_session.query(UserStripeAccount).filter(
        UserStripeAccount.stripe_account_id == "acct_fulfiller_123"
    ).first()
    assert acct.onboarding_complete is True


def test_webhook_account_updated_not_ready(client, db_session):
    """account.updated with charges/payouts disabled returns event_received."""
    event = _make_account_updated_event(False, False)
    app.dependency_overrides[validate_stripe_header] = _override_webhook(event)

    response = client.post("/webhook")
    assert response.status_code == 200
    assert response.json()["status"] == "event_received"


def test_webhook_payment_failed(client, db_session):
    """payment_intent.payment_failed flags orders in DB."""
    _seed_user(db_session)
    _seed_task(db_session)
    _seed_order(db_session, payment_intent="pi_failed_123", status="created")

    event = {
        "type": "payment_intent.payment_failed",
        "data": {"object": {"id": "pi_failed_123"}}
    }
    app.dependency_overrides[validate_stripe_header] = _override_webhook(event)

    response = client.post("/webhook")
    assert response.status_code == 200
    assert response.json()["status"] == "payment_failure_recorded"

    # Verify order status updated in DB
    db_session.expire_all()
    order = db_session.query(Order).filter(Order.order_id == "order-001").first()
    assert order.status == "payment_failed"


def test_webhook_ignores_unknown(client):
    """Unknown event type returns event_ignored."""
    event = {
        "type": "payment_intent.succeeded",
        "data": {"object": {"id": "pi_test_unrelated"}}
    }
    app.dependency_overrides[validate_stripe_header] = _override_webhook(event)

    response = client.post("/webhook")
    assert response.status_code == 200
    assert response.json()["status"] == "event_ignored"


def test_webhook_checkout_ignores_unpaid(client):
    """checkout.session.completed with unpaid status returns not_paid."""
    event = _make_checkout_completed_event("unpaid")
    app.dependency_overrides[validate_stripe_header] = _override_webhook(event)

    response = client.post("/webhook")
    assert response.status_code == 200
    assert response.json()["status"] == "not_paid"


def test_webhook_checkout_missing_user_id(client):
    """checkout.session.completed without user_id in metadata returns error."""
    event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_no_user",
                "payment_status": "paid",
                "metadata": {},
            }
        }
    }
    app.dependency_overrides[validate_stripe_header] = _override_webhook(event)

    response = client.post("/webhook")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "error"
    assert "user_id" in data["detail"].lower()


def test_webhook_charge_dispute_created(client, db_session):
    """charge.dispute.created freezes pending disbursements."""
    _seed_user(db_session)
    _seed_task(db_session)
    _seed_order(db_session, payment_intent="pi_disputed_456")
    _seed_claim(db_session)
    _seed_disbursement(db_session, status="pending")

    event = {
        "type": "charge.dispute.created",
        "data": {"object": {"id": "dp_123", "payment_intent": "pi_disputed_456"}}
    }
    app.dependency_overrides[validate_stripe_header] = _override_webhook(event)

    response = client.post("/webhook")
    assert response.status_code == 200
    assert response.json()["status"] == "disbursements_frozen"

    # Verify disbursement status in DB
    db_session.expire_all()
    disbs = db_session.query(Disbursement).filter(Disbursement.claim_id == "claim-001").all()
    assert all(d.status == "frozen" for d in disbs)


def test_webhook_charge_refunded(client, db_session):
    """charge.refunded marks orders as refunded."""
    _seed_user(db_session)
    _seed_task(db_session)
    _seed_order(db_session, payment_intent="pi_refunded_789")

    event = {
        "type": "charge.refunded",
        "data": {"object": {"id": "ch_123", "payment_intent": "pi_refunded_789"}}
    }
    app.dependency_overrides[validate_stripe_header] = _override_webhook(event)

    response = client.post("/webhook")
    assert response.status_code == 200
    assert response.json()["status"] == "refund_recorded"

    # Verify order status in DB
    db_session.expire_all()
    order = db_session.query(Order).filter(Order.order_id == "order-001").first()
    assert order.status == "refunded"


# ══════════════════════════════════════════════════════════════════════════
# PAYOUT TESTS
# ══════════════════════════════════════════════════════════════════════════


@patch("routes.stripe.stripe")
def test_payout_happy_path(mock_stripe, client, db_session):
    """Disbursement found, user onboarded, transfer succeeds."""
    _seed_user(db_session)
    _seed_task(db_session)
    _seed_order(db_session)
    _seed_stripe_account(db_session)
    _seed_claim(db_session)
    disb = _seed_disbursement(db_session, amount_cents=1500)

    mock_transfer = MagicMock()
    mock_transfer.id = "tr_test_happy_123"
    mock_stripe.Transfer.create.return_value = mock_transfer

    mock_pi = MagicMock()
    mock_pi.latest_charge = "ch_test_123"
    mock_stripe.PaymentIntent.retrieve.return_value = mock_pi

    response = client.post("/stripe/process_payout/claim-001")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Payout processed"
    assert data["transfer_id"] == "tr_test_happy_123"
    assert data["amount_cents"] == 1500

    # Verify Transfer.create was called with correct args
    call_kwargs = mock_stripe.Transfer.create.call_args[1]
    assert call_kwargs["amount"] == 1500
    assert call_kwargs["currency"] == "gbp"
    assert call_kwargs["destination"] == "acct_fulfiller_123"
    assert "claim-001" in call_kwargs["description"]

    # Verify disbursement marked as paid in DB
    db_session.expire_all()
    paid_disb = db_session.query(Disbursement).filter(Disbursement.id == disb.id).first()
    assert paid_disb.status == "paid"
    assert paid_disb.stripe_transfer_id == "tr_test_happy_123"


def test_payout_not_onboarded(client, db_session):
    """User not onboarded with Stripe returns 400."""
    _seed_user(db_session)
    _seed_task(db_session)
    _seed_order(db_session)
    _seed_claim(db_session)
    _seed_disbursement(db_session)
    # No UserStripeAccount seeded

    response = client.post("/stripe/process_payout/claim-001")
    assert response.status_code == 400
    assert "not onboarded" in response.json()["detail"].lower()


def test_payout_no_disbursement(client, db_session):
    """No pending disbursement returns 404."""
    _seed_user(db_session)
    _seed_task(db_session)
    _seed_order(db_session)
    _seed_claim(db_session)
    # No disbursement seeded

    response = client.post("/stripe/process_payout/claim-001")
    assert response.status_code == 404
    assert "disbursement" in response.json()["detail"].lower()


@patch("routes.stripe.stripe")
def test_payout_onboarding_not_complete(mock_stripe, client, db_session):
    """Stripe onboarding incomplete returns 400."""
    _seed_user(db_session)
    _seed_task(db_session)
    _seed_order(db_session)
    _seed_stripe_account(db_session, onboarding_complete=False, with_address=False)
    _seed_claim(db_session)
    _seed_disbursement(db_session)

    response = client.post("/stripe/process_payout/claim-001")
    assert response.status_code == 400
    assert "not complete" in response.json()["detail"].lower()


@patch("routes.stripe.stripe")
def test_payout_stripe_transfer_fails(mock_stripe, client, db_session):
    """Stripe Transfer.create failure returns 500."""
    import stripe as stripe_module

    _seed_user(db_session)
    _seed_task(db_session)
    _seed_order(db_session)
    _seed_stripe_account(db_session)
    _seed_claim(db_session)
    _seed_disbursement(db_session)

    mock_pi = MagicMock()
    mock_pi.latest_charge = "ch_test_123"
    mock_stripe.PaymentIntent.retrieve.return_value = mock_pi

    mock_stripe.Transfer.create.side_effect = stripe_module.error.StripeError("Transfer failed")
    mock_stripe.error = stripe_module.error

    response = client.post("/stripe/process_payout/claim-001")
    assert response.status_code == 500
    assert "transfer failed" in response.json()["detail"].lower()


# ══════════════════════════════════════════════════════════════════════════
# ONBOARDING TESTS
# ══════════════════════════════════════════════════════════════════════════


@patch("routes.stripe.generate_account_link", new_callable=AsyncMock)
@patch("routes.stripe.generate_stripe_account", new_callable=AsyncMock)
def test_onboard_new_user(mock_create, mock_link, client, db_session):
    """New user: creates Stripe Express account + returns onboarding URL."""
    _seed_user(db_session)

    mock_create.return_value = {"id": "acct_new_123"}
    mock_link.return_value = {"onboarding_url": "https://connect.stripe.com/setup/e/test"}

    response = client.post("/stripe/onboard")
    assert response.status_code == 200
    data = response.json()
    assert "onboarding_url" in data

    # Verify account was saved to DB
    db_session.expire_all()
    acct = db_session.query(UserStripeAccount).filter(
        UserStripeAccount.user_id == "test-user-123"
    ).first()
    assert acct is not None
    assert acct.stripe_account_id == "acct_new_123"
    assert acct.onboarding_complete is False


def test_onboard_already_complete(client, db_session):
    """Already-onboarded user returns account info."""
    _seed_user(db_session)
    _seed_stripe_account(db_session, onboarding_complete=True)

    response = client.post("/stripe/onboard")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "User already onboarded"


@patch("routes.stripe.generate_account_link", new_callable=AsyncMock)
def test_onboard_existing_incomplete(mock_link, client, db_session):
    """Incomplete onboarding returns a new AccountLink URL."""
    _seed_user(db_session)
    _seed_stripe_account(db_session, onboarding_complete=False, with_address=False)

    mock_link.return_value = {"onboarding_url": "https://connect.stripe.com/setup/e/resume"}

    response = client.post("/stripe/onboard")
    assert response.status_code == 200
    data = response.json()
    assert "onboarding_url" in data


# ══════════════════════════════════════════════════════════════════════════
# SHIPPING TESTS
# ══════════════════════════════════════════════════════════════════════════


@patch("routes.stripe.create_shipping_label", new_callable=AsyncMock)
def test_create_label_success(mock_create_label, client, db_session):
    """Creates ShipEngine label and updates claim."""
    _seed_user(db_session)
    _seed_task(db_session)
    _seed_order(db_session)
    _seed_stripe_account(db_session, with_address=True)
    _seed_claim(db_session)

    mock_create_label.return_value = {
        "label_url": "https://api.shipengine.com/v1/labels/mock-label.pdf",
        "tracking_number": "TRACK123",
        "carrier_code": "evri",
        "shipment_id": "se-12345",
    }

    response = client.post("/shipping/create_label/claim-001")
    assert response.status_code == 200
    data = response.json()
    assert data["tracking_number"] == "TRACK123"
    assert data["label_url"] == "https://api.shipengine.com/v1/labels/mock-label.pdf"
    assert data["carrier_code"] == "evri"

    # Verify claim updated in DB
    db_session.expire_all()
    claim = db_session.query(Claim).filter(Claim.id == "claim-001").first()
    assert claim.tracking_number == "TRACK123"
    assert claim.label_url == "https://api.shipengine.com/v1/labels/mock-label.pdf"


def test_create_label_claim_not_found(client):
    """Missing claim returns 404."""
    response = client.post("/shipping/create_label/claim-nonexistent")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_create_label_wrong_fulfiller(client, db_session):
    """Non-fulfiller requesting label returns 403."""
    _seed_user(db_session)
    _seed_user(db_session, user_id="other-user-999", username="other", email="other@example.com")
    _seed_task(db_session)
    _seed_order(db_session)
    _seed_claim(db_session, claimant_user_id="other-user-999")

    response = client.post("/shipping/create_label/claim-001")
    assert response.status_code == 403
    assert "fulfiller" in response.json()["detail"].lower()


def test_create_label_missing_buyer_address(client, db_session):
    """Missing buyer shipping address returns 400."""
    _seed_user(db_session)
    _seed_task(db_session)
    _seed_order(
        db_session,
        shipping_name=None,
        shipping_line1=None,
        shipping_city=None,
        shipping_postal_code=None,
        shipping_country=None,
    )
    _seed_stripe_account(db_session, with_address=True)
    _seed_claim(db_session)

    response = client.post("/shipping/create_label/claim-001")
    assert response.status_code == 400
    assert "address" in response.json()["detail"].lower()


def test_create_label_missing_fulfiller_address(client, db_session):
    """Missing fulfiller address returns 400."""
    _seed_user(db_session)
    _seed_task(db_session)
    _seed_order(db_session)
    _seed_stripe_account(db_session, with_address=False)
    _seed_claim(db_session)

    response = client.post("/shipping/create_label/claim-001")
    assert response.status_code == 400
    assert "address" in response.json()["detail"].lower()


@patch("routes.stripe.create_shipping_label", new_callable=AsyncMock)
def test_create_label_shipengine_failure(mock_create_label, client, db_session):
    """ShipEngine failure returns 502."""
    _seed_user(db_session)
    _seed_task(db_session)
    _seed_order(db_session)
    _seed_stripe_account(db_session, with_address=True)
    _seed_claim(db_session)

    mock_create_label.side_effect = Exception("ShipEngine API timeout")

    response = client.post("/shipping/create_label/claim-001")
    assert response.status_code == 502
    assert "shipping label" in response.json()["detail"].lower()

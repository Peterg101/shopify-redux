from unittest.mock import patch, AsyncMock, MagicMock, ANY
import stripe as stripe_module


MOCK_DISBURSEMENT = {
    "id": "disb-001",
    "claim_id": "claim-001",
    "amount_cents": 1500,
    "status": "pending",
}

MOCK_STRIPE_INFO = {
    "stripe_account_id": "acct_fulfiller_123",
    "onboarding_complete": True,
}


# ── Happy path ──


@patch("routes.payouts.mark_disbursement_paid", new_callable=AsyncMock)
@patch("routes.payouts.stripe")
@patch("routes.payouts.check_user_stripe_onboarded", new_callable=AsyncMock)
@patch("routes.payouts.get_pending_disbursement", new_callable=AsyncMock)
def test_payout_happy_path(mock_get_disb, mock_check_stripe, mock_stripe, mock_mark_paid, client):
    mock_get_disb.return_value = MOCK_DISBURSEMENT
    mock_check_stripe.return_value = MOCK_STRIPE_INFO
    mock_mark_paid.return_value = {"message": "marked as paid"}

    mock_transfer = MagicMock()
    mock_transfer.id = "tr_test_happy_123"
    mock_stripe.Transfer.create.return_value = mock_transfer

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

    # Verify mark_disbursement_paid was called
    mock_mark_paid.assert_called_once_with(
        ANY,
        disbursement_id="disb-001",
        stripe_transfer_id="tr_test_happy_123",
        source_transaction=None,
        transfer_group=None,
    )


# ── No pending disbursement ──


@patch("routes.payouts.get_pending_disbursement", new_callable=AsyncMock)
def test_payout_no_pending_disbursement(mock_get_disb, client):
    mock_get_disb.return_value = None

    response = client.post("/stripe/process_payout/claim-missing")
    assert response.status_code == 404
    assert "disbursement" in response.json()["detail"].lower()


# ── User not onboarded with Stripe ──


@patch("routes.payouts.check_user_stripe_onboarded", new_callable=AsyncMock)
@patch("routes.payouts.get_pending_disbursement", new_callable=AsyncMock)
def test_payout_user_not_onboarded(mock_get_disb, mock_check_stripe, client):
    mock_get_disb.return_value = MOCK_DISBURSEMENT
    mock_check_stripe.return_value = None

    response = client.post("/stripe/process_payout/claim-001")
    assert response.status_code == 400
    assert "not onboarded" in response.json()["detail"].lower()


# ── Stripe onboarding incomplete ──


@patch("routes.payouts.check_user_stripe_onboarded", new_callable=AsyncMock)
@patch("routes.payouts.get_pending_disbursement", new_callable=AsyncMock)
def test_payout_onboarding_not_complete(mock_get_disb, mock_check_stripe, client):
    mock_get_disb.return_value = MOCK_DISBURSEMENT
    mock_check_stripe.return_value = {
        "stripe_account_id": "acct_incomplete_456",
        "onboarding_complete": False,
    }

    response = client.post("/stripe/process_payout/claim-001")
    assert response.status_code == 400
    assert "not complete" in response.json()["detail"].lower()


# ── Stripe Transfer.create failure ──


@patch("routes.payouts.stripe")
@patch("routes.payouts.check_user_stripe_onboarded", new_callable=AsyncMock)
@patch("routes.payouts.get_pending_disbursement", new_callable=AsyncMock)
def test_payout_stripe_transfer_fails(mock_get_disb, mock_check_stripe, mock_stripe, client):
    mock_get_disb.return_value = MOCK_DISBURSEMENT
    mock_check_stripe.return_value = MOCK_STRIPE_INFO

    mock_stripe.Transfer.create.side_effect = stripe_module.error.StripeError("Transfer failed")
    mock_stripe.error = stripe_module.error

    response = client.post("/stripe/process_payout/claim-001")
    assert response.status_code == 500
    assert "transfer failed" in response.json()["detail"].lower()


# ── Mark-paid fails ──


@patch("routes.payouts.mark_disbursement_paid", new_callable=AsyncMock)
@patch("routes.payouts.stripe")
@patch("routes.payouts.check_user_stripe_onboarded", new_callable=AsyncMock)
@patch("routes.payouts.get_pending_disbursement", new_callable=AsyncMock)
def test_payout_mark_paid_fails(mock_get_disb, mock_check_stripe, mock_stripe, mock_mark_paid, client):
    mock_get_disb.return_value = MOCK_DISBURSEMENT
    mock_check_stripe.return_value = MOCK_STRIPE_INFO
    mock_mark_paid.return_value = None  # Signals failure

    mock_transfer = MagicMock()
    mock_transfer.id = "tr_test_mark_fail"
    mock_stripe.Transfer.create.return_value = mock_transfer

    response = client.post("/stripe/process_payout/claim-001")
    assert response.status_code == 500
    assert "mark disbursement as paid" in response.json()["detail"].lower()

from unittest.mock import patch, AsyncMock, MagicMock
import httpx
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


def _mock_httpx_client(get_side_effects=None, patch_side_effects=None):
    """
    Helper to build a mocked httpx.AsyncClient context manager.
    get_side_effects: list of httpx.Response for sequential .get() calls
    patch_side_effects: list of httpx.Response for sequential .patch() calls
    """
    mock_async_client = AsyncMock()
    if get_side_effects:
        mock_async_client.get.side_effect = get_side_effects
    if patch_side_effects:
        mock_async_client.patch.side_effect = patch_side_effects
    mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
    mock_async_client.__aexit__ = AsyncMock(return_value=None)
    return mock_async_client


# ── Happy path ──


@patch("routes.payouts.stripe")
@patch("routes.payouts.httpx.AsyncClient")
def test_payout_happy_path(mock_client_class, mock_stripe, client):
    """Full flow: disbursement found, user onboarded, transfer succeeds, mark-paid succeeds."""
    mock_async_client = _mock_httpx_client(
        get_side_effects=[
            httpx.Response(200, json=MOCK_DISBURSEMENT),       # GET disbursements/pending
            httpx.Response(200, json=MOCK_STRIPE_INFO),        # GET user_onboarded_with_stripe
        ],
        patch_side_effects=[
            httpx.Response(200, json={"message": "marked as paid"}),  # PATCH disbursements/.../paid
        ],
    )
    mock_client_class.return_value = mock_async_client

    mock_transfer = MagicMock()
    mock_transfer.id = "tr_test_happy_123"
    mock_stripe.Transfer.create.return_value = mock_transfer

    response = client.post("/stripe/process_payout/claim-001")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Payout processed"
    assert data["transfer_id"] == "tr_test_happy_123"
    assert data["amount_cents"] == 1500

    # Verify Stripe Transfer.create was called with correct args
    mock_stripe.Transfer.create.assert_called_once_with(
        amount=1500,
        currency="gbp",
        destination="acct_fulfiller_123",
        description="Payout for claim claim-001",
    )


# ── No pending disbursement ──


@patch("routes.payouts.httpx.AsyncClient")
def test_payout_no_pending_disbursement(mock_client_class, client):
    """When db_service returns non-200 for pending disbursement, should 404."""
    mock_async_client = _mock_httpx_client(
        get_side_effects=[
            httpx.Response(404, json={"detail": "Not found"}),  # GET disbursements/pending
        ],
    )
    mock_client_class.return_value = mock_async_client

    response = client.post("/stripe/process_payout/claim-missing")
    assert response.status_code == 404
    assert "disbursement" in response.json()["detail"].lower()


# ── User not onboarded with Stripe ──


@patch("routes.payouts.httpx.AsyncClient")
def test_payout_user_not_onboarded(mock_client_class, client):
    """When db_service returns non-200 for Stripe onboarding check, should 400."""
    mock_async_client = _mock_httpx_client(
        get_side_effects=[
            httpx.Response(200, json=MOCK_DISBURSEMENT),        # GET disbursements/pending
            httpx.Response(404, json={"detail": "No Stripe account"}),  # GET user_onboarded
        ],
    )
    mock_client_class.return_value = mock_async_client

    response = client.post("/stripe/process_payout/claim-001")
    assert response.status_code == 400
    assert "not onboarded" in response.json()["detail"].lower()


# ── Stripe onboarding incomplete ──


@patch("routes.payouts.httpx.AsyncClient")
def test_payout_onboarding_not_complete(mock_client_class, client):
    """When user has Stripe account but onboarding_complete is False, should 400."""
    incomplete_stripe_info = {
        "stripe_account_id": "acct_incomplete_456",
        "onboarding_complete": False,
    }

    mock_async_client = _mock_httpx_client(
        get_side_effects=[
            httpx.Response(200, json=MOCK_DISBURSEMENT),
            httpx.Response(200, json=incomplete_stripe_info),
        ],
    )
    mock_client_class.return_value = mock_async_client

    response = client.post("/stripe/process_payout/claim-001")
    assert response.status_code == 400
    assert "not complete" in response.json()["detail"].lower()


# ── Stripe Transfer.create failure ──


@patch("routes.payouts.stripe")
@patch("routes.payouts.httpx.AsyncClient")
def test_payout_stripe_transfer_fails(mock_client_class, mock_stripe, client):
    """When stripe.Transfer.create raises StripeError, should 500."""
    mock_async_client = _mock_httpx_client(
        get_side_effects=[
            httpx.Response(200, json=MOCK_DISBURSEMENT),
            httpx.Response(200, json=MOCK_STRIPE_INFO),
        ],
    )
    mock_client_class.return_value = mock_async_client

    mock_stripe.Transfer.create.side_effect = stripe_module.error.StripeError("Transfer failed")
    mock_stripe.error = stripe_module.error  # Ensure the patched stripe still has error module

    response = client.post("/stripe/process_payout/claim-001")
    assert response.status_code == 500
    assert "transfer failed" in response.json()["detail"].lower()


# ── Mark-paid fails ──


@patch("routes.payouts.stripe")
@patch("routes.payouts.httpx.AsyncClient")
def test_payout_mark_paid_fails(mock_client_class, mock_stripe, client):
    """When PATCH to mark disbursement as paid returns non-200, should 500."""
    mock_async_client = _mock_httpx_client(
        get_side_effects=[
            httpx.Response(200, json=MOCK_DISBURSEMENT),
            httpx.Response(200, json=MOCK_STRIPE_INFO),
        ],
        patch_side_effects=[
            httpx.Response(500, json={"detail": "Internal error"}),
        ],
    )
    mock_client_class.return_value = mock_async_client

    mock_transfer = MagicMock()
    mock_transfer.id = "tr_test_mark_fail"
    mock_stripe.Transfer.create.return_value = mock_transfer

    response = client.post("/stripe/process_payout/claim-001")
    assert response.status_code == 500
    assert "mark disbursement as paid" in response.json()["detail"].lower()

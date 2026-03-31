"""Tests for messaging endpoints (routes/messages.py)."""
import uuid
import pytest
from conftest import set_auth_as_buyer, set_auth_as_claimant
from fitd_schemas.fitd_db_schemas import Claim, User


@pytest.fixture
def seed_claim(seed_order, seed_claimant_user, db_session):
    """Create a claim by the claimant user on the seeded order."""
    claim = Claim(
        id=str(uuid.uuid4()),
        order_id="order-001",
        claimant_user_id="claimant-user-456",
        quantity=2,
        status="in_progress",
    )
    db_session.add(claim)
    db_session.commit()
    db_session.refresh(claim)
    return claim


# ── Send message ──────────────────────────────────────────────


def test_send_message_as_fulfiller(claimant_client, seed_claim):
    set_auth_as_claimant()
    response = claimant_client.post(
        f"/claims/{seed_claim.id}/messages",
        json={"body": "Hello, I have a question about the print."},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["body"] == "Hello, I have a question about the print."
    assert data["sender_user_id"] == "claimant-user-456"
    assert data["conversation_id"]


def test_send_message_as_buyer(client, seed_claim):
    response = client.post(
        f"/claims/{seed_claim.id}/messages",
        json={"body": "Thanks for claiming my order!"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["sender_user_id"] == "test-user-123"


def test_send_message_non_participant_returns_403(client, seed_claim, db_session):
    """A user who is neither the buyer nor the fulfiller cannot message."""
    # Create a third user
    third_user = User(user_id="outsider-789", username="outsider", email="outsider@test.com")
    db_session.add(third_user)
    db_session.commit()

    # Override auth to the third user
    from main import app
    from dependencies import get_current_user, get_any_user
    from fitd_schemas.fitd_classes import UserInformation

    async def override():
        return UserInformation(user_id="outsider-789", username="outsider", email="outsider@test.com", email_verified=True)

    app.dependency_overrides[get_current_user] = override
    app.dependency_overrides[get_any_user] = override
    try:
        response = client.post(
            f"/claims/{seed_claim.id}/messages",
            json={"body": "I shouldn't be able to send this."},
        )
        assert response.status_code == 403
    finally:
        set_auth_as_buyer()


def test_send_message_nonexistent_claim_returns_404(client):
    response = client.post(
        "/claims/nonexistent-claim-id/messages",
        json={"body": "Hello"},
    )
    assert response.status_code == 404


def test_send_empty_body_returns_422(client, seed_claim):
    response = client.post(
        f"/claims/{seed_claim.id}/messages",
        json={"body": "   "},
    )
    assert response.status_code == 422


def test_send_body_too_long_returns_422(client, seed_claim):
    response = client.post(
        f"/claims/{seed_claim.id}/messages",
        json={"body": "x" * 2001},
    )
    assert response.status_code == 422


# ── Get messages ──────────────────────────────────────────────


def test_get_messages_empty_conversation(client, seed_claim):
    response = client.get(f"/claims/{seed_claim.id}/messages")
    assert response.status_code == 200
    assert response.json() == []


def test_get_messages_returns_chronological(client, seed_claim):
    # Send two messages
    client.post(f"/claims/{seed_claim.id}/messages", json={"body": "First"})
    client.post(f"/claims/{seed_claim.id}/messages", json={"body": "Second"})

    response = client.get(f"/claims/{seed_claim.id}/messages")
    assert response.status_code == 200
    messages = response.json()
    assert len(messages) == 2
    assert messages[0]["body"] == "First"
    assert messages[1]["body"] == "Second"


def test_get_messages_non_participant_returns_403(client, seed_claim, db_session):
    third_user = User(user_id="outsider-789", username="outsider", email="outsider@test.com")
    db_session.add(third_user)
    db_session.commit()

    from main import app
    from dependencies import get_current_user, get_any_user
    from fitd_schemas.fitd_classes import UserInformation

    async def override():
        return UserInformation(user_id="outsider-789", username="outsider", email="outsider@test.com", email_verified=True)

    app.dependency_overrides[get_current_user] = override
    app.dependency_overrides[get_any_user] = override
    try:
        response = client.get(f"/claims/{seed_claim.id}/messages")
        assert response.status_code == 403
    finally:
        set_auth_as_buyer()


# ── Cursor pagination ─────────────────────────────────────────


def test_pagination_with_cursor(client, seed_claim):
    # Send 5 messages
    msg_ids = []
    for i in range(5):
        resp = client.post(f"/claims/{seed_claim.id}/messages", json={"body": f"Message {i}"})
        msg_ids.append(resp.json()["id"])

    # Fetch last 2 using the 4th message as cursor (should return messages before it)
    response = client.get(f"/claims/{seed_claim.id}/messages?before={msg_ids[3]}&limit=2")
    assert response.status_code == 200
    messages = response.json()
    assert len(messages) == 2
    assert messages[0]["body"] == "Message 1"
    assert messages[1]["body"] == "Message 2"


def test_pagination_limit(client, seed_claim):
    for i in range(10):
        client.post(f"/claims/{seed_claim.id}/messages", json={"body": f"Msg {i}"})

    response = client.get(f"/claims/{seed_claim.id}/messages?limit=3")
    messages = response.json()
    # limit=3 returns the 3 most recent (in chronological order)
    assert len(messages) == 3
    assert messages[0]["body"] == "Msg 7"
    assert messages[2]["body"] == "Msg 9"


# ── Mark read ─────────────────────────────────────────────────


def test_mark_messages_read(client, claimant_client, seed_claim):
    # Fulfiller sends a message
    set_auth_as_claimant()
    claimant_client.post(f"/claims/{seed_claim.id}/messages", json={"body": "Shipped!"})

    # Buyer marks as read
    set_auth_as_buyer()
    response = client.patch(f"/claims/{seed_claim.id}/messages/read")
    assert response.status_code == 200

    # Unread count for buyer should be 0
    response = client.get("/messages/unread_count")
    assert response.json()["total_unread"] == 0


def test_mark_read_no_conversation(client, seed_claim):
    response = client.patch(f"/claims/{seed_claim.id}/messages/read")
    assert response.status_code == 200
    assert "No conversation" in response.json()["message"]


# ── Unread counts ─────────────────────────────────────────────


def test_unread_count_after_messages(client, claimant_client, seed_claim):
    # Fulfiller sends 3 messages
    set_auth_as_claimant()
    for i in range(3):
        claimant_client.post(f"/claims/{seed_claim.id}/messages", json={"body": f"Update {i}"})

    # Buyer checks unread count
    set_auth_as_buyer()
    response = client.get("/messages/unread_count")
    assert response.status_code == 200
    assert response.json()["total_unread"] == 3


def test_unread_count_excludes_own_messages(client, seed_claim):
    # Buyer sends messages to themselves — should not count as unread
    client.post(f"/claims/{seed_claim.id}/messages", json={"body": "My own message"})

    response = client.get("/messages/unread_count")
    assert response.json()["total_unread"] == 0


# ── Conversations list ────────────────────────────────────────


def test_list_conversations(client, seed_claim):
    # Send a message to create the conversation
    client.post(f"/claims/{seed_claim.id}/messages", json={"body": "Hello"})

    response = client.get("/conversations")
    assert response.status_code == 200
    conversations = response.json()
    assert len(conversations) == 1
    assert conversations[0]["claim_id"] == seed_claim.id
    assert conversations[0]["last_message"]["body"] == "Hello"


def test_list_conversations_empty(client):
    response = client.get("/conversations")
    assert response.status_code == 200
    assert response.json() == []


def test_conversations_sorted_by_recent(client, seed_claim, db_session):
    """Most recently active conversation should be first."""
    # Create a second order + claim for a second conversation
    from fitd_schemas.fitd_db_schemas import Order, Task

    task2 = Task(task_id="task-002", user_id="test-user-123", task_name="Task 2")
    db_session.add(task2)
    db_session.commit()

    order2 = Order(
        order_id="order-002", task_id="task-002", user_id="test-user-123",
        name="Print 2", material="PLA", technique="FDM", sizing=1.0,
        colour="black", selectedFile="test2.obj", selectedFileType="obj",
        price=20.0, quantity=3, status="open",
    )
    db_session.add(order2)
    db_session.commit()

    claim2 = Claim(
        id=str(uuid.uuid4()), order_id="order-002",
        claimant_user_id="claimant-user-456", quantity=1, status="in_progress",
    )
    db_session.add(claim2)
    db_session.commit()

    # Message in first claim
    client.post(f"/claims/{seed_claim.id}/messages", json={"body": "First conversation"})
    # Message in second claim (more recent)
    client.post(f"/claims/{claim2.id}/messages", json={"body": "Second conversation"})

    response = client.get("/conversations")
    conversations = response.json()
    assert len(conversations) == 2
    # Most recent first
    assert conversations[0]["claim_id"] == claim2.id
    assert conversations[1]["claim_id"] == seed_claim.id


def test_conversation_shows_unread_count(client, claimant_client, seed_claim):
    set_auth_as_claimant()
    claimant_client.post(f"/claims/{seed_claim.id}/messages", json={"body": "Hey"})
    claimant_client.post(f"/claims/{seed_claim.id}/messages", json={"body": "Are you there?"})

    set_auth_as_buyer()
    response = client.get("/conversations")
    conversations = response.json()
    assert conversations[0]["unread_count"] == 2


# ── Conversation auto-creation ────────────────────────────────


def test_conversation_auto_created_on_first_message(client, seed_claim, db_session):
    from fitd_schemas.fitd_db_schemas import Conversation

    assert db_session.query(Conversation).count() == 0

    client.post(f"/claims/{seed_claim.id}/messages", json={"body": "First message"})

    conv = db_session.query(Conversation).first()
    assert conv is not None
    assert conv.claim_id == seed_claim.id
    assert conv.buyer_user_id == "test-user-123"
    assert conv.fulfiller_user_id == "claimant-user-456"


def test_second_message_reuses_conversation(client, seed_claim, db_session):
    from fitd_schemas.fitd_db_schemas import Conversation

    client.post(f"/claims/{seed_claim.id}/messages", json={"body": "First"})
    client.post(f"/claims/{seed_claim.id}/messages", json={"body": "Second"})

    assert db_session.query(Conversation).count() == 1

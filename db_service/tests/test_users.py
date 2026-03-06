def test_create_user(client):
    response = client.post(
        "/users",
        json={"user_id": "user-1", "username": "alice", "email": "alice@example.com"},
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["user_id"] == "user-1"
    assert data["username"] == "alice"
    assert data["email"] == "alice@example.com"


def test_get_user(client, seed_user):
    response = client.get(
        "/users/test-user-123",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["user_id"] == "test-user-123"
    assert data["user"]["username"] == "testuser"


def test_get_nonexistent_user(client):
    response = client.get(
        "/users/nonexistent",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 404


def test_get_only_user(client, seed_user):
    response = client.get(
        "/only_user/test-user-123",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == "test-user-123"


def test_get_only_user_not_found(client):
    response = client.get(
        "/only_user/nonexistent",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 404

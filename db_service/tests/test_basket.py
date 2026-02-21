from fitd_schemas.fitd_db_schemas import BasketItem


def test_update_basket_quantity(client, seed_user, db_session):
    # Create a basket item directly in DB
    item = BasketItem(
        task_id="task-basket-001",
        user_id="test-user-123",
        name="Test Item",
        material="PLA",
        technique="FDM",
        sizing=1.0,
        colour="red",
        selectedFile="test.obj",
        selectedFileType="obj",
        price=5.0,
        quantity=1,
    )
    db_session.add(item)
    db_session.commit()

    response = client.post(
        "/basket_item_quantity",
        json={"task_id": "task-basket-001", "quantity": 3},
    )
    assert response.status_code == 200
    assert response.json()["quantity"] == 3


def test_update_basket_quantity_not_found(client, seed_user):
    response = client.post(
        "/basket_item_quantity",
        json={"task_id": "nonexistent", "quantity": 3},
    )
    assert response.status_code == 404


def test_get_all_basket_items(client, seed_user, db_session):
    item = BasketItem(
        task_id="task-basket-002",
        user_id="test-user-123",
        name="Item 2",
        material="Resin",
        technique="Resin",
        sizing=2.0,
        colour="blue",
        selectedFile="item2.obj",
        selectedFileType="obj",
        price=15.0,
        quantity=2,
    )
    db_session.add(item)
    db_session.commit()

    response = client.get(
        "/all_basket_items?user_id=test-user-123",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_get_all_basket_items_empty(client, seed_user):
    response = client.get(
        "/all_basket_items?user_id=test-user-123",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 400

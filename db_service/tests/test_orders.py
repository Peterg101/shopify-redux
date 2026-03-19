def test_create_order_from_stripe_checkout(client, seed_user, seed_task, db_session):
    """POST /orders/create_from_stripe_checkout creates orders and clears basket."""
    from fitd_schemas.fitd_db_schemas import BasketItem, Order

    # Seed a basket item so we can verify it gets cleared
    basket_item = BasketItem(
        task_id="task-001",
        user_id="test-user-123",
        name="Test Print",
        material="PLA Basic",
        technique="FDM",
        sizing=1.0,
        colour="white",
        selectedFile="test.obj",
        selectedFileType="obj",
        price=10.0,
        quantity=2,
    )
    db_session.add(basket_item)
    db_session.commit()

    response = client.post(
        "/orders/create_from_stripe_checkout",
        json={
            "stripe_checkout_session_id": "cs_test_abc123",
            "user_id": "test-user-123",
            "order_status": "created",
            "line_items": [
                {
                    "task_id": "task-001",
                    "user_id": "test-user-123",
                    "name": "Test Print",
                    "material": "PLA Basic",
                    "technique": "FDM",
                    "sizing": 1.0,
                    "colour": "white",
                    "selectedFile": "test.obj",
                    "selectedFileType": "obj",
                    "price": 10.0,
                    "quantity": 2,
                }
            ],
        },
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "success"
    assert data["order_count"] == 1

    # Verify order was created
    orders = db_session.query(Order).filter(Order.stripe_checkout_session_id == "cs_test_abc123").all()
    assert len(orders) == 1
    assert orders[0].name == "Test Print"

    # Verify basket was cleared
    basket = db_session.query(BasketItem).filter(BasketItem.user_id == "test-user-123").all()
    assert len(basket) == 0


def test_stripe_checkout_idempotency(client, seed_user, seed_task):
    """Posting the same stripe_checkout_session_id twice should not create duplicates."""
    checkout_payload = {
        "stripe_checkout_session_id": "cs_test_idempotent",
        "user_id": "test-user-123",
        "order_status": "created",
        "line_items": [
            {
                "task_id": "task-001",
                "user_id": "test-user-123",
                "name": "Idempotent Print",
                "material": "PLA",
                "technique": "FDM",
                "sizing": 1.0,
                "colour": "blue",
                "selectedFile": "test.obj",
                "selectedFileType": "obj",
                "price": 15.0,
                "quantity": 1,
            }
        ],
    }

    # First call — should create
    r1 = client.post(
        "/orders/create_from_stripe_checkout",
        json=checkout_payload,
        headers={"Authorization": "Bearer fake"},
    )
    assert r1.status_code == 201
    assert r1.json()["status"] == "success"

    # Second call — should be idempotent
    r2 = client.post(
        "/orders/create_from_stripe_checkout",
        json=checkout_payload,
        headers={"Authorization": "Bearer fake"},
    )
    assert r2.status_code == 201
    assert r2.json()["status"] == "already_processed"


def test_stripe_checkout_empty_line_items(client, seed_user):
    """Empty line_items should return 400."""
    response = client.post(
        "/orders/create_from_stripe_checkout",
        json={
            "stripe_checkout_session_id": "cs_test_empty",
            "user_id": "test-user-123",
            "line_items": [],
        },
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 400


def test_update_order_status(client, seed_order):
    response = client.post(
        "/orders/update_order",
        json={"order_id": "order-001", "order_status": "fulfilled"},
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["updated_count"] == 1


def test_get_user_includes_orders(client, seed_user, seed_order):
    response = client.get(
        "/users/test-user-123",
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["orders"]) == 1
    assert data["orders"][0]["name"] == "Test Print"
    assert data["orders"][0]["quantity"] == 5
    assert data["orders"][0]["quantity_claimed"] == 0


def test_get_user_claimable_orders_excludes_own(client, seed_user, seed_order):
    """Orders owned by the user should NOT appear in claimable_orders."""
    response = client.get(
        "/users/test-user-123",
        headers={"Authorization": "Bearer fake"},
    )
    data = response.json()
    # The order belongs to test-user-123, so it should not be in claimable_orders
    assert len(data["claimable_orders"]) == 0


def test_claimable_orders_only_collaborative(client, seed_user, seed_claimant_user, seed_order, db_session):
    """Only collaborative orders should show up in claimable_orders for other users."""
    from fitd_schemas.fitd_db_schemas import Order

    # seed_order is is_collaborative=False, so claimant should see 0
    response = client.get(
        "/users/claimant-user-456",
        headers={"Authorization": "Bearer fake"},
    )
    data = response.json()
    assert len(data["claimable_orders"]) == 0

    # Make the order collaborative
    order = db_session.query(Order).filter(Order.order_id == "order-001").first()
    order.is_collaborative = True
    db_session.commit()

    response = client.get(
        "/users/claimant-user-456",
        headers={"Authorization": "Bearer fake"},
    )
    data = response.json()
    assert len(data["claimable_orders"]) == 1
    assert data["claimable_orders"][0]["is_collaborative"] is True


def test_toggle_order_visibility(client, seed_user, seed_order):
    """Owner can toggle order between private and community."""
    # Start as private (is_collaborative=False)
    response = client.patch("/orders/order-001/visibility")
    assert response.status_code == 200
    assert response.json()["is_collaborative"] is True

    # Toggle back
    response = client.patch("/orders/order-001/visibility")
    assert response.status_code == 200
    assert response.json()["is_collaborative"] is False


def test_toggle_order_visibility_unauthorized(client, seed_user, seed_claimant_user, seed_order, db_session):
    """Non-owner cannot toggle order visibility."""
    from fitd_schemas.fitd_db_schemas import Order
    import uuid

    # Create an order owned by claimant, then try to toggle as test-user-123
    other_order = Order(
        order_id="order-other",
        task_id="task-001",
        user_id="claimant-user-456",
        stripe_checkout_session_id="cs_test_999",
        name="Other Print",
        material="PLA Basic",
        technique="FDM",
        sizing=1.0,
        colour="black",
        selectedFile="other.obj",
        selectedFileType="obj",
        price=15.0,
        quantity=3,
        is_collaborative=False,
        status="open",
    )
    db_session.add(other_order)
    db_session.commit()

    response = client.patch("/orders/order-other/visibility")
    assert response.status_code == 403


def test_toggle_order_visibility_not_found(client, seed_user):
    """Toggle on non-existent order returns 404."""
    response = client.patch("/orders/nonexistent/visibility")
    assert response.status_code == 404


def test_cannot_make_private_with_active_claims(client, seed_user, seed_order, seed_claimant_user, db_session):
    """Cannot toggle back to private if order has active claims."""
    from fitd_schemas.fitd_db_schemas import Order, Claim
    import uuid

    order = db_session.query(Order).filter(Order.order_id == "order-001").first()
    order.is_collaborative = True
    db_session.commit()

    # Add an active claim
    claim = Claim(
        id=str(uuid.uuid4()),
        order_id="order-001",
        claimant_user_id="claimant-user-456",
        quantity=2,
        status="in_progress",
    )
    db_session.add(claim)
    db_session.commit()

    # Try to toggle back to private — should fail
    response = client.patch("/orders/order-001/visibility")
    assert response.status_code == 400
    assert "active claims" in response.json()["detail"]


def test_order_detail_basic(client, seed_user, seed_order):
    """GET /orders/{id}/detail returns order with owner username and empty claims."""
    response = client.get("/orders/order-001/detail")
    assert response.status_code == 200
    data = response.json()
    assert data["order_id"] == "order-001"
    assert data["owner_username"] == "testuser"
    assert data["name"] == "Test Print"
    assert data["material"] == "PLA Basic"
    assert data["claims"] == []


def test_order_detail_with_claim(client, seed_user, seed_claimant_user, seed_order, db_session):
    """Order detail includes claims with fulfiller username, empty evidence/history."""
    from fitd_schemas.fitd_db_schemas import Claim
    import uuid

    claim = Claim(
        id="claim-detail-001",
        order_id="order-001",
        claimant_user_id="claimant-user-456",
        quantity=2,
        status="in_progress",
    )
    db_session.add(claim)
    db_session.commit()

    response = client.get("/orders/order-001/detail")
    assert response.status_code == 200
    data = response.json()
    assert len(data["claims"]) == 1
    c = data["claims"][0]
    assert c["claimant_username"] == "claimant"
    assert c["quantity"] == 2
    assert c["status"] == "in_progress"
    assert c["evidence"] == []
    assert c["status_history"] == []
    assert c["dispute"] is None


def test_order_detail_with_evidence_and_history(client, seed_user, seed_claimant_user, seed_order, db_session):
    """Order detail includes evidence photos and status history for a claim."""
    from fitd_schemas.fitd_db_schemas import Claim, ClaimEvidence, ClaimStatusHistory
    from datetime import datetime

    claim = Claim(
        id="claim-detail-002",
        order_id="order-001",
        claimant_user_id="claimant-user-456",
        quantity=3,
        status="printing",
    )
    db_session.add(claim)
    db_session.flush()

    evidence = ClaimEvidence(
        id="ev-001",
        claim_id="claim-detail-002",
        file_path="/uploads/test.jpg",
        uploaded_at=datetime.utcnow(),
        status_at_upload="in_progress",
        description="Progress photo",
    )
    history = ClaimStatusHistory(
        id="hist-001",
        claim_id="claim-detail-002",
        previous_status="pending",
        new_status="in_progress",
        changed_by="claimant-user-456",
        changed_at=datetime.utcnow(),
    )
    db_session.add_all([evidence, history])
    db_session.commit()

    response = client.get("/orders/order-001/detail")
    assert response.status_code == 200
    data = response.json()
    c = data["claims"][0]
    assert len(c["evidence"]) == 1
    assert c["evidence"][0]["description"] == "Progress photo"
    assert len(c["status_history"]) == 1
    assert c["status_history"][0]["new_status"] == "in_progress"


def test_order_detail_not_found(client, seed_user):
    """GET /orders/{id}/detail returns 404 for missing order."""
    response = client.get("/orders/nonexistent/detail")
    assert response.status_code == 404


def test_order_includes_shipping_address(client, seed_user, seed_task, db_session):
    """Order created with shipping address stores and returns shipping fields."""
    response = client.post(
        "/orders/create_from_stripe_checkout",
        json={
            "stripe_checkout_session_id": "cs_test_shipping",
            "user_id": "test-user-123",
            "order_status": "created",
            "line_items": [
                {
                    "task_id": "task-001",
                    "user_id": "test-user-123",
                    "name": "Ship Test",
                    "material": "PLA",
                    "technique": "FDM",
                    "sizing": 1.0,
                    "colour": "blue",
                    "selectedFile": "test.obj",
                    "selectedFileType": "obj",
                    "price": 20.0,
                    "quantity": 1,
                }
            ],
            "shipping_address": {
                "name": "John Doe",
                "line1": "42 Test Street",
                "line2": "Flat 3",
                "city": "London",
                "postal_code": "E1 6AN",
                "country": "GB",
            },
        },
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code == 201

    from fitd_schemas.fitd_db_schemas import Order
    order = db_session.query(Order).filter(
        Order.stripe_checkout_session_id == "cs_test_shipping"
    ).first()
    assert order.shipping_name == "John Doe"
    assert order.shipping_line1 == "42 Test Street"
    assert order.shipping_line2 == "Flat 3"
    assert order.shipping_city == "London"
    assert order.shipping_postal_code == "E1 6AN"
    assert order.shipping_country == "GB"

    # Verify hydration returns shipping fields
    hydration = client.get("/users/test-user-123", headers={"Authorization": "Bearer fake"})
    order_data = hydration.json()["orders"][0]
    assert order_data["shipping_name"] == "John Doe"
    assert order_data["shipping_city"] == "London"


def test_order_detail_includes_shipping_address(client, seed_user, seed_task, db_session):
    """GET /orders/{id}/detail returns shipping fields."""
    from fitd_schemas.fitd_db_schemas import Order
    from datetime import datetime

    order = Order(
        order_id="order-ship-detail",
        task_id="task-001",
        user_id="test-user-123",
        stripe_checkout_session_id="cs_test_ship_detail",
        name="Ship Detail Test",
        material="PLA",
        technique="FDM",
        sizing=1.0,
        colour="red",
        selectedFile="test.obj",
        selectedFileType="obj",
        price=15.0,
        quantity=2,
        created_at=datetime.utcnow().isoformat(),
        is_collaborative=False,
        status="open",
        shipping_name="Jane Doe",
        shipping_line1="10 High Street",
        shipping_city="Manchester",
        shipping_postal_code="M1 1AA",
        shipping_country="GB",
    )
    db_session.add(order)
    db_session.commit()

    response = client.get("/orders/order-ship-detail/detail")
    assert response.status_code == 200
    data = response.json()
    assert data["shipping_name"] == "Jane Doe"
    assert data["shipping_line1"] == "10 High Street"
    assert data["shipping_city"] == "Manchester"

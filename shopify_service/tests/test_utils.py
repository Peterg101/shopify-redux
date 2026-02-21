"""
Tests for shopify_service/utils.py utility functions.

Covers:
  - convert_basket_items_to_shopify_graphql_line_items
  - extract_order_info_from_webhook
"""

import pytest
from types import SimpleNamespace
from fastapi import HTTPException

from utils import (
    convert_basket_items_to_shopify_graphql_line_items,
    extract_order_info_from_webhook,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_basket_item(**overrides):
    """Return a SimpleNamespace that quacks like a BasketItem row."""
    defaults = dict(
        task_id="task-001",
        material="PLA",
        technique="FDM",
        sizing=10.5,
        colour="Red",
        selectedFileType="STL",
        selectedFile="model.stl",
        name="Test Widget",
        quantity=2,
        price=19.99,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _make_line_item_dict(**overrides):
    """Return a dict that satisfies the LineItem Pydantic model."""
    price_set = {
        "shop_money": {"amount": "9.99", "currency_code": "GBP"},
        "presentment_money": {"amount": "9.99", "currency_code": "GBP"},
    }
    defaults = dict(
        id=101,
        admin_graphql_api_id="gid://shopify/LineItem/101",
        attributed_staffs=[],
        current_quantity=1,
        fulfillable_quantity=1,
        fulfillment_service="manual",
        fulfillment_status=None,
        gift_card=False,
        grams=200,
        name="Test Widget",
        price="9.99",
        price_set=price_set,
        product_exists=True,
        product_id=None,
        properties=[{"name": "Material", "value": "PLA"}],
        quantity=1,
        requires_shipping=True,
        sales_line_item_group_id=None,
        sku=None,
        taxable=True,
        title="Test Widget",
        total_discount="0.00",
        total_discount_set=price_set,
        variant_id=None,
        variant_inventory_management=None,
        variant_title=None,
        vendor="FITD",
        tax_lines=[],
        duties=[],
        discount_allocations=[],
    )
    defaults.update(overrides)
    return defaults


def _make_billing_address(**overrides):
    """Return a dict that satisfies the ShippingAddress Pydantic model."""
    defaults = dict(
        first_name="John",
        last_name="Doe",
        address1="123 Test Street",
        address2=None,
        company=None,
        phone=None,
        city="London",
        zip="SW1A 1AA",
        province="England",
        country="United Kingdom",
        latitude=None,
        longitude=None,
        name="John Doe",
        country_code="GB",
        province_code="ENG",
    )
    defaults.update(overrides)
    return defaults


def _make_webhook_payload(**overrides):
    """Return a full, valid webhook payload dict."""
    defaults = dict(
        id=123456789,
        line_items=[_make_line_item_dict()],
        billing_address=_make_billing_address(),
    )
    defaults.update(overrides)
    return defaults


# ===========================================================================
# Tests for convert_basket_items_to_shopify_graphql_line_items
# ===========================================================================


class TestConvertBasketItemsToGraphQLLineItems:
    """Unit tests for convert_basket_items_to_shopify_graphql_line_items."""

    def test_single_item_returns_one_element(self):
        items = [_make_basket_item()]
        result = convert_basket_items_to_shopify_graphql_line_items(items, "user-42")
        assert len(result) == 1

    def test_multiple_items_returns_matching_count(self):
        items = [_make_basket_item(task_id=f"task-{i}") for i in range(3)]
        result = convert_basket_items_to_shopify_graphql_line_items(items, "user-42")
        assert len(result) == 3

    def test_empty_list_returns_empty(self):
        result = convert_basket_items_to_shopify_graphql_line_items([], "user-42")
        assert result == []

    # --- Property key presence -------------------------------------------------

    def test_contains_all_eight_custom_attribute_keys(self):
        """The customAttributes block must contain exactly these 8 keys."""
        items = [_make_basket_item()]
        result = convert_basket_items_to_shopify_graphql_line_items(items, "user-42")
        block = result[0]

        expected_keys = [
            "Task Id",
            "Material",
            "Technique",
            "Sizing",
            "Colour",
            "Selected File Type",
            "Selected File",
            "User Id",
        ]
        for key in expected_keys:
            assert f'key: "{key}"' in block, f"Missing property key: {key}"

    def test_properties_are_comma_separated(self):
        """Each property pair must be separated by ', ' inside customAttributes."""
        items = [_make_basket_item()]
        result = convert_basket_items_to_shopify_graphql_line_items(items, "user-42")
        block = result[0]

        # Extract the customAttributes portion
        start = block.index("customAttributes: [") + len("customAttributes: [")
        end = block.index("]", start)
        attrs_str = block[start:end].strip()

        # There should be exactly 7 commas separating 8 properties
        # Each property is { key: "...", value: "..." }
        # Split by '}, {' to count property boundaries
        property_segments = attrs_str.split("}, {")
        assert len(property_segments) == 8, (
            f"Expected 8 property segments but got {len(property_segments)}"
        )

    # --- Value correctness -----------------------------------------------------

    def test_task_id_value(self):
        items = [_make_basket_item(task_id="abc-123")]
        result = convert_basket_items_to_shopify_graphql_line_items(items, "user-42")
        assert 'key: "Task Id", value: "abc-123"' in result[0]

    def test_material_value(self):
        items = [_make_basket_item(material="Resin")]
        result = convert_basket_items_to_shopify_graphql_line_items(items, "user-42")
        assert 'key: "Material", value: "Resin"' in result[0]

    def test_technique_value(self):
        items = [_make_basket_item(technique="SLA")]
        result = convert_basket_items_to_shopify_graphql_line_items(items, "user-42")
        assert 'key: "Technique", value: "SLA"' in result[0]

    def test_sizing_value(self):
        items = [_make_basket_item(sizing=25.0)]
        result = convert_basket_items_to_shopify_graphql_line_items(items, "user-42")
        assert 'key: "Sizing", value: "25.0"' in result[0]

    def test_colour_value(self):
        items = [_make_basket_item(colour="Blue")]
        result = convert_basket_items_to_shopify_graphql_line_items(items, "user-42")
        assert 'key: "Colour", value: "Blue"' in result[0]

    def test_selected_file_type_value(self):
        items = [_make_basket_item(selectedFileType="OBJ")]
        result = convert_basket_items_to_shopify_graphql_line_items(items, "user-42")
        assert 'key: "Selected File Type", value: "OBJ"' in result[0]

    def test_selected_file_value(self):
        items = [_make_basket_item(selectedFile="dragon.obj")]
        result = convert_basket_items_to_shopify_graphql_line_items(items, "user-42")
        assert 'key: "Selected File", value: "dragon.obj"' in result[0]

    def test_user_id_value(self):
        items = [_make_basket_item()]
        result = convert_basket_items_to_shopify_graphql_line_items(items, "user-99")
        assert 'key: "User Id", value: "user-99"' in result[0]

    # --- Top-level line item fields --------------------------------------------

    def test_title_field(self):
        items = [_make_basket_item(name="My Model")]
        result = convert_basket_items_to_shopify_graphql_line_items(items, "user-42")
        assert 'title: "My Model"' in result[0]

    def test_quantity_field(self):
        items = [_make_basket_item(quantity=5)]
        result = convert_basket_items_to_shopify_graphql_line_items(items, "user-42")
        assert "quantity: 5" in result[0]

    def test_price_formatted_to_two_decimals(self):
        items = [_make_basket_item(price=7.5)]
        result = convert_basket_items_to_shopify_graphql_line_items(items, "user-42")
        assert 'originalUnitPrice: "7.50"' in result[0]

    def test_price_already_two_decimals(self):
        items = [_make_basket_item(price=12.99)]
        result = convert_basket_items_to_shopify_graphql_line_items(items, "user-42")
        assert 'originalUnitPrice: "12.99"' in result[0]

    def test_result_is_stripped_string(self):
        """Each line item block should have no leading/trailing whitespace."""
        items = [_make_basket_item()]
        result = convert_basket_items_to_shopify_graphql_line_items(items, "user-42")
        assert result[0] == result[0].strip()


# ===========================================================================
# Tests for extract_order_info_from_webhook
# ===========================================================================


class TestExtractOrderInfoFromWebhook:
    """Unit tests for extract_order_info_from_webhook."""

    # --- Happy path ------------------------------------------------------------

    def test_valid_payload_returns_shopify_order(self):
        payload = _make_webhook_payload()
        order = extract_order_info_from_webhook(payload)

        assert order.id == 123456789
        assert order.order_status == "created"
        assert len(order.line_items) == 1
        assert order.shipping_address.first_name == "John"

    def test_custom_order_status(self):
        payload = _make_webhook_payload()
        order = extract_order_info_from_webhook(payload, order_status="paid")
        assert order.order_status == "paid"

    def test_multiple_line_items(self):
        items = [
            _make_line_item_dict(id=1, name="Widget A"),
            _make_line_item_dict(id=2, name="Widget B"),
        ]
        payload = _make_webhook_payload(line_items=items)
        order = extract_order_info_from_webhook(payload)
        assert len(order.line_items) == 2

    def test_shipping_address_fields(self):
        payload = _make_webhook_payload()
        order = extract_order_info_from_webhook(payload)
        addr = order.shipping_address

        assert addr.last_name == "Doe"
        assert addr.city == "London"
        assert addr.zip == "SW1A 1AA"
        assert addr.country_code == "GB"

    def test_line_item_properties_preserved(self):
        payload = _make_webhook_payload()
        order = extract_order_info_from_webhook(payload)
        props = order.line_items[0].properties
        assert len(props) == 1
        assert props[0].name == "Material"
        assert props[0].value == "PLA"

    # --- Missing / malformed fields --------------------------------------------

    def test_missing_id_raises_http_exception(self):
        payload = _make_webhook_payload()
        del payload["id"]

        with pytest.raises(HTTPException) as exc_info:
            extract_order_info_from_webhook(payload)
        assert exc_info.value.status_code == 400
        assert "Missing 'id'" in exc_info.value.detail

    def test_missing_line_items_key_gives_empty_then_raises(self):
        """When line_items is absent, get returns [] which is empty -> ValueError."""
        payload = _make_webhook_payload()
        del payload["line_items"]

        with pytest.raises(HTTPException) as exc_info:
            extract_order_info_from_webhook(payload)
        assert exc_info.value.status_code == 400
        assert "No valid line items" in exc_info.value.detail

    def test_line_items_not_a_list_raises(self):
        payload = _make_webhook_payload(line_items="not-a-list")

        with pytest.raises(HTTPException) as exc_info:
            extract_order_info_from_webhook(payload)
        assert exc_info.value.status_code == 400
        assert "'line_items' must be a list" in exc_info.value.detail

    def test_empty_line_items_raises(self):
        payload = _make_webhook_payload(line_items=[])

        with pytest.raises(HTTPException) as exc_info:
            extract_order_info_from_webhook(payload)
        assert exc_info.value.status_code == 400
        assert "No valid line items" in exc_info.value.detail

    def test_all_invalid_line_items_raises(self):
        """If every line item fails Pydantic validation, we get the ValueError."""
        payload = _make_webhook_payload(
            line_items=[{"bad_key": "bad_value"}]
        )

        with pytest.raises(HTTPException) as exc_info:
            extract_order_info_from_webhook(payload)
        assert exc_info.value.status_code == 400

    def test_partial_invalid_line_items_keeps_valid_ones(self):
        """Valid items are kept; invalid ones are silently skipped."""
        items = [
            _make_line_item_dict(id=1, name="Good Item"),
            {"bad_key": "bad_value"},  # invalid
        ]
        payload = _make_webhook_payload(line_items=items)
        order = extract_order_info_from_webhook(payload)
        assert len(order.line_items) == 1
        assert order.line_items[0].name == "Good Item"

    def test_missing_billing_address_uses_empty_dict(self):
        """
        billing_address defaults to {} via .get(..., {}).
        ShippingAddress requires first_name, last_name, etc., so this
        should raise an HTTPException due to Pydantic validation failure.
        """
        payload = _make_webhook_payload()
        del payload["billing_address"]

        with pytest.raises(HTTPException) as exc_info:
            extract_order_info_from_webhook(payload)
        assert exc_info.value.status_code == 400

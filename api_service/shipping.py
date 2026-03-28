"""ShipEngine label creation utility."""
import os
import logging
import httpx

logger = logging.getLogger(__name__)

SHIPENGINE_API_KEY = os.getenv("SHIPENGINE_API_KEY")
SHIPENGINE_BASE = "https://api.shipengine.com/v1"

DEFAULT_PARCEL = {
    "weight": {"value": 0.5, "unit": "kilogram"},
    "dimensions": {"length": 20, "width": 15, "height": 15, "unit": "centimetre"},
}


async def create_shipping_label(
    ship_from: dict,
    ship_to: dict,
    parcel: dict | None = None,
) -> dict:
    """
    Creates a ShipEngine label.
    Returns: { label_url, tracking_number, carrier_code, shipment_id }
    """
    if parcel is None:
        parcel = DEFAULT_PARCEL

    payload = {
        "shipment": {
            "ship_from": {
                "name": ship_from["name"],
                "address_line1": ship_from["line1"],
                "address_line2": ship_from.get("line2") or "",
                "city_locality": ship_from["city"],
                "postal_code": ship_from["postal_code"],
                "country_code": ship_from["country"],
            },
            "ship_to": {
                "name": ship_to["name"],
                "address_line1": ship_to["line1"],
                "address_line2": ship_to.get("line2") or "",
                "city_locality": ship_to["city"],
                "postal_code": ship_to["postal_code"],
                "country_code": ship_to["country"],
            },
            "packages": [parcel],
        },
        "label_format": "pdf",
    }

    headers = {
        "API-Key": SHIPENGINE_API_KEY,
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SHIPENGINE_BASE}/labels",
            json=payload,
            headers=headers,
            timeout=30,
        )

        if response.status_code != 200:
            logger.error(f"ShipEngine error: {response.status_code} - {response.text}")
            raise Exception(f"ShipEngine label creation failed: {response.text}")

        data = response.json()
        return {
            "label_url": data.get("label_download", {}).get("pdf", ""),
            "tracking_number": data.get("tracking_number", ""),
            "carrier_code": data.get("carrier_code", ""),
            "shipment_id": data.get("shipment_id", ""),
        }

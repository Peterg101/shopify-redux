import httpx
import os
import hmac, hashlib, base64


SHOPIFY_STORE_URL = os.getenv("SHOPIFY_STORE_URL")
SHOPIFY_API_KEY = os.getenv("SHOPIFY_API_KEY")
SHOPIFY_API_SECRET = os.getenv("SHOPIFY_API_SECRET")
SHOPIFY_ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN") 


class ShopifyClient:
    def __init__(self):
        self.session = httpx.AsyncClient(
            base_url=f"{SHOPIFY_STORE_URL}/admin/api/2023-04",
            headers={
                "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                "Content-Type": "application/json"
            }
        )

    async def create_draft_order(self, payload: dict):
        """Creates a draft order for custom products/services."""
        response = await self.session.post("/draft_orders.json", json={"draft_order": payload})
        response.raise_for_status()
        return response.json()

    async def verify_webhook(self, request_body: bytes, hmac_header: str) -> bool:
        digest = hmac.new(SHOPIFY_API_SECRET.encode(), request_body, hashlib.sha256).digest()
        calculated_hmac = base64.b64encode(digest).decode()
        return hmac.compare_digest(calculated_hmac, hmac_header)
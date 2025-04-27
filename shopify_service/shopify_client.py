import httpx
import os
import hmac, hashlib, base64


SHOPIFY_STORE_URL = os.getenv("SHOPIFY_STORE_URL")  # e.g., https://your-store.myshopify.com
SHOPIFY_API_KEY = os.getenv("SHOPIFY_API_KEY")
SHOPIFY_API_SECRET = os.getenv("SHOPIFY_API_SECRET")
SHOPIFY_ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN")  # Private app or custom app

class ShopifyClient:
    def __init__(self):
        self.session = httpx.AsyncClient(
            base_url=f"{SHOPIFY_STORE_URL}/admin/api/2023-04",
            headers={
                "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                "Content-Type": "application/json"
            }
        )

    async def create_checkout(self, payload: dict):
        """Creates a checkout session."""
        response = await self.session.post("/checkouts.json", json={"checkout": payload})
        response.raise_for_status()
        return response.json()

    async def verify_webhook(self, request_body: bytes, hmac_header: str) -> bool:
        """Optional: Verify webhook signatures."""
        digest = hmac.new(SHOPIFY_API_SECRET.encode(), request_body, hashlib.sha256).digest()
        calculated_hmac = base64.b64encode(digest).decode()
        return hmac.compare_digest(calculated_hmac, hmac_header)
import httpx
from jwt_auth import generate_token


class ServiceClient:
    """Thin async HTTP client with JWT auth for inter-service calls."""

    def __init__(self, base_url: str, service_name: str = "stripe_service"):
        self.base_url = base_url
        self.service_name = service_name

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {generate_token(self.service_name)}",
            "Content-Type": "application/json",
        }

    async def get(self, path: str, **kwargs) -> httpx.Response:
        async with httpx.AsyncClient() as client:
            return await client.get(
                f"{self.base_url}{path}",
                headers=self._headers(),
                **kwargs,
            )

    async def post(self, path: str, **kwargs) -> httpx.Response:
        async with httpx.AsyncClient() as client:
            return await client.post(
                f"{self.base_url}{path}",
                headers=self._headers(),
                **kwargs,
            )

    async def patch(self, path: str, **kwargs) -> httpx.Response:
        async with httpx.AsyncClient() as client:
            return await client.patch(
                f"{self.base_url}{path}",
                headers=self._headers(),
                **kwargs,
            )

import httpx


async def session_exists(session_id: str) -> bool:
    cookies = {"fitd_session_data": session_id}
    url = "http://localhost:2468/get_session"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, cookies=cookies)
            return response.status_code == 200
        except httpx.HTTPError as e:
            print(f"HTTP error occurred: {e}")
            return False
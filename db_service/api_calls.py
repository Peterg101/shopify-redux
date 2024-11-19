import httpx


async def session_exists(session_id: str):
    url = "http://localhost:2468/get_session"
    headers = {
        "Cookie": f"{session_id}"
    }
    print('running')
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
    return response.status_code == 200
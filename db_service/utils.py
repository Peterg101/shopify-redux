from typing import Union
from api_calls import session_exists


async def check_session_token_active(session_token: Union[str, None]) -> bool:
    print('checking session token')
    if not session_token:
        return False
    print('active session')
    active_session = await session_exists(session_token)
    return active_session

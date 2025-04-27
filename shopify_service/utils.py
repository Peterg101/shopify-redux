from fastapi import Request, HTTPException
from fitd_schemas.fitd_classes import UserInformation,
from api_calls import session_exists, session_exists_user_only

async def cookie_verification(request: Request):
    session_id = request.cookies.get("fitd_session_data")
    print(session_id)
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = await session_exists(session_id)
    print(session_data)
    if not session_data:
        raise HTTPException(status_code=401, detail="No Session Found")


async def cookie_verification_user_only(request: Request) -> UserInformation:
    session_id = request.cookies.get("fitd_session_data")
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = await session_exists_user_only(session_id)
    if not session_data:
        raise HTTPException(status_code=401, detail="No Session Found")

    return session_data
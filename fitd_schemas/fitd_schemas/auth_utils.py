from fastapi import Request, HTTPException
from fitd_schemas.fitd_classes import UserInformation


async def cookie_verification(request: Request, session_checker):
    session_id = request.cookies.get("fitd_session_data")
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session_data = await session_checker(session_id)
    if not session_data:
        raise HTTPException(status_code=401, detail="No Session Found")


async def cookie_verification_user_only(request: Request, session_checker) -> UserInformation:
    session_id = request.cookies.get("fitd_session_data")
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session_data = await session_checker(session_id)
    if not session_data:
        raise HTTPException(status_code=401, detail="No Session Found")
    return session_data

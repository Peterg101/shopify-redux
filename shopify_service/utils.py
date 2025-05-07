from fastapi import Request, HTTPException
from fitd_schemas.fitd_classes import UserInformation
from fitd_schemas.fitd_db_schemas import BasketItem
from typing import List
from api_calls import session_exists, session_exists_user_only
from datetime import datetime
import uuid


async def cookie_verification(request: Request):
    session_id = request.cookies.get("fitd_session_data")
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = await session_exists(session_id)
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


def convert_basket_items_to_line_items(basket_items: List[BasketItem]) -> List[dict]:
    line_items = []
    for item in basket_items:
        line_item = {
            "title": item.name,
            "price": f"{item.price:.2f}",
            "quantity": item.quantity,
            "properties": {
                "Material": item.material,
                "Technique": item.technique,
                "Sizing": item.sizing,
                "Colour": item.colour,
                "File Type": item.selectedFileType,
                "File Name": item.selectedFile
            }
        }
        line_items.append(line_item)
    return line_items
    

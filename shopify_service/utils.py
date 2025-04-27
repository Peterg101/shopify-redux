from fastapi import Request, HTTPException
from fitd_schemas.fitd_classes import UserInformation, BasketItem, Order
from typing import List
from api_calls import session_exists, session_exists_user_only
from datetime import datetime
import uuid


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


def convert_basket_items_to_orders(basket_items: List[BasketItem]) -> List[Order]:
    created_orders = []
    for item in basket_items:
        order = Order(
            order_id=str(uuid.uuid4()),
            user_id=user_id,
            task_id=item.task_id,
            name=item.name,
            material=item.material,
            technique=item.technique,
            sizing=item.sizing,
            colour=item.colour,
            selectedFile=item.selectedFile,
            selectedFileType=item.selectedFileType,
            price=item.price,
            quantity=item.quantity,
            created_at=datetime.utcnow().isoformat(),
            is_collaborative=False,
            status="open"
        )
        created_orders.append(order)
    return created_orders
    

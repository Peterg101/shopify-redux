from typing import Union, Dict, List
from api_calls import session_exists, session_exists_user_only
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.exc import NoResultFound, IntegrityError
from fitd_schemas.fitd_db_schemas import User, Task, BasketItem, PortID, Claim, Order
from fitd_schemas.fitd_classes import UserInformation, TaskInformation, BasketItemInformation, ClaimOrder
from fitd_schemas.auth_utils import cookie_verification as _cookie_verification, cookie_verification_user_only as _cookie_verification_user_only
from fastapi import HTTPException, Request
from datetime import datetime
from pathlib import Path
import base64


async def check_session_token_active(session_token: Union[str, None]) -> bool:
    if not session_token:
        return False
    active_session = await session_exists(session_token)
    return active_session


def check_user_existence(db: Session, user_id: str | None) -> bool:
    if not user_id:  # Handle invalid input
        return False

    # Query the database to check for existence
    user_exists = db.query(User).filter(User.user_id == user_id).first() is not None
    return user_exists


def add_user_to_db(db: Session, user_information: UserInformation) -> User:
    user = User(
        user_id=user_information.user_id,
        username=user_information.username,
        email=user_information.email,
        password_hash=user_information.password_hash,
        auth_provider=user_information.auth_provider or "google",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def add_task_to_db(db: Session, task_information: TaskInformation) -> Task:

    task = Task(
        task_id=task_information.task_id,
        user_id=task_information.user_id,
        task_name=task_information.task_name,
        file_type=task_information.file_type or "obj",
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def add_port_to_db(db: Session, task_id: str, port_id: str) -> Task:

    portIdObject = PortID(task_id=task_id, port_id=port_id)
    db.add(portIdObject)
    db.commit()
    db.refresh(portIdObject)
    return portIdObject


def mark_meshy_task_complete(db: Session, task_id: str):
    # Retrieve the task record with the provided task_id
    task = db.query(Task).filter(Task.task_id == task_id).first()

    if not task:
        raise NoResultFound(f"Task with task_id {task_id} not found")

    # Update the 'complete' field to True
    task.complete = True

    # Commit the transaction to save the change to the database
    db.commit()
    db.refresh(task)


def delete_port_id(db: Session, task_id: str):
    port = db.query(PortID).filter(PortID.task_id == task_id).first()
    if port:
        db.delete(port)
        db.commit()


def add_or_update_basket_item_in_db(
    db: Session, basket_item_info: BasketItemInformation
) -> BasketItem:
    # Check if the item already exists in the database
    existing_item = (
        db.query(BasketItem)
        .filter(BasketItem.task_id == basket_item_info.task_id)
        .first()
    )
    if existing_item:
        # Check if any fields have changed
        has_changed = any(
            [
                existing_item.user_id != basket_item_info.user_id,
                existing_item.name != basket_item_info.name,
                existing_item.material != basket_item_info.material,
                existing_item.technique != basket_item_info.technique,
                existing_item.sizing != basket_item_info.sizing,
                existing_item.colour != basket_item_info.colour,
                existing_item.selectedFile != basket_item_info.selected_file,
                existing_item.selectedFileType != basket_item_info.selectedFileType,
                existing_item.price != basket_item_info.price,
                existing_item.quantity != basket_item_info.quantity
            ]
        )

        if has_changed:
            # Update the fields if they have changed
            existing_item.user_id = basket_item_info.user_id
            existing_item.name = basket_item_info.name
            existing_item.material = basket_item_info.material
            existing_item.technique = basket_item_info.technique
            existing_item.sizing = basket_item_info.sizing
            existing_item.colour = basket_item_info.colour
            existing_item.selectedFile = basket_item_info.selected_file
            existing_item.selectedFileType = basket_item_info.selectedFileType
            existing_item.price = basket_item_info.price
            existing_item.quantity = basket_item_info.quantity
            db.commit()
            db.refresh(existing_item)

        return existing_item

    # If no existing item, create a new one
    new_item = BasketItem(
        task_id=basket_item_info.task_id,
        user_id=basket_item_info.user_id,
        name=basket_item_info.name,
        material=basket_item_info.material,
        technique=basket_item_info.technique,
        sizing=basket_item_info.sizing,
        colour=basket_item_info.colour,
        selectedFile=basket_item_info.selected_file,
        selectedFileType=basket_item_info.selectedFileType,
        price=basket_item_info.price,
        quantity=basket_item_info.quantity
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    return new_item


async def cookie_verification(request: Request):
    return await _cookie_verification(request, session_exists)


async def cookie_verification_user_only(request: Request) -> UserInformation:
    return await _cookie_verification_user_only(request, session_exists_user_only)


def decode_file(file_blob: str, file_name: str, upload_dir: Path):

    file_path = upload_dir / f"{file_name}.obj"
    file_exists = check_file_exists(file_path)
    if not file_exists:
        file_data = base64.b64decode(file_blob)
        with open(file_path, "wb") as file:
            file.write(file_data)


def check_file_exists(file_path: Path) -> bool:
    return file_path.exists() and file_path.is_file()


def add_claim_to_db(
        db: Session, 
        claimed_order: ClaimOrder, 
        user_info: UserInformation) -> Claim:
    try:
        if claimed_order.quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

        # Lock the order row (with_for_update() is a no-op on SQLite;
        # the UniqueConstraint on (order_id, claimant_user_id) provides protection)
        order = db.execute(
            select(Order)
            .where(Order.order_id == claimed_order.order_id)
            .with_for_update()
        ).scalar_one()

        available = order.quantity - order.quantity_claimed
        if claimed_order.quantity > available:
            raise HTTPException(
                status_code=400,
                detail=f"Only {available} items remaining"
            )

        claim = Claim(
            order_id=order.order_id,
            claimant_user_id=user_info.user_id,
            quantity=claimed_order.quantity,
            status="pending",
        )

        db.add(claim)
        db.commit()
        db.refresh(claim)

        return claim

    except Exception:
        db.rollback()
        raise
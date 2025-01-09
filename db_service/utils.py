from typing import Union, Dict
from api_calls import session_exists
from sqlalchemy.orm import Session
from models import User, Task, BasketItem
from classes import UserInformation, TaskInformation, BasketItemInformation
from fastapi import HTTPException, Request
from datetime import datetime
from pathlib import Path
import base64


async def check_session_token_active(session_token: Union[str, None]) -> bool:
    print('checking session token')
    if not session_token:
        return False
    print('active session')
    active_session = await session_exists(session_token)
    return active_session


def check_user_existence(db: Session, user_id: str | None) -> bool:
    if not user_id:  # Handle invalid input
        print("NO USER ID PROVIDED")
        return False

    # Query the database to check for existence
    user_exists = db.query(User).filter(User.user_id == user_id).first() is not None
    return user_exists


def add_user_to_db(db: Session, user_information: UserInformation) -> User:
    user = User(
        user_id=user_information.user_id,
        username=user_information.username,
        email=user_information.email
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
        created_at=task_information.created_at
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def add_or_update_basket_item_in_db(db: Session, basket_item_info: BasketItemInformation) -> BasketItem:
    # Check if the item already exists in the database
    existing_item = db.query(BasketItem).filter(BasketItem.task_id == basket_item_info.task_id).first()

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
                existing_item.selectedFileType != basket_item_info.selected_file_type,
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
            existing_item.selectedFileType = basket_item_info.selected_file_type

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
        selectedFileType=basket_item_info.selected_file_type,
    )

    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    return new_item


async def cookie_verification(request: Request):
    session_id = request.cookies.get("fitd_session_data")
    print(session_id)
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_data = await session_exists(session_id)
    if not session_data:
        raise HTTPException(status_code=401, detail="No Session Found")


def decode_file(file_blob: str, file_name: str, upload_dir: Path):
    
    file_path = upload_dir / f"{file_name}.obj"
    file_exists = check_file_exists(file_path)
    if not file_exists:
        print(file_blob)
        file_data = base64.b64decode(file_blob)
        print(file_data)
        with open(file_path, "wb") as file:
            file.write(file_data)


def check_file_exists(file_path: Path) -> bool:
    return file_path.exists() and file_path.is_file()

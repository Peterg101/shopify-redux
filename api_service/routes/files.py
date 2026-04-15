"""File upload and basket storage endpoints."""
import os
import re
import logging
import base64

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from dependencies import get_db, get_redis, get_any_user
from cache import cache_invalidate
from events import publish_event
from config import UPLOAD_DIR, MAX_FILE_SIZE_MB, MAX_FILE_SIZE_B64
from utils import (
    check_user_existence,
    add_or_update_basket_item_in_db,
    decode_file,
)
from jwt_auth import verify_jwt_token
from rate_limit import limiter

from fitd_schemas.fitd_db_schemas import User, Task, BasketItem
from fitd_schemas.fitd_classes import (
    BasketItemInformation,
    BasketQuantityUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()

SAFE_FILE_ID = re.compile(r'^[a-zA-Z0-9_-]+$')


def _validate_file_id(file_id: str) -> str:
    """Validate file_id to prevent path traversal."""
    if not SAFE_FILE_ID.match(file_id) or '..' in file_id:
        raise HTTPException(status_code=400, detail="Invalid file ID format")
    return file_id


@router.post("/basket_item_quantity")
def update_basket_quantity(
    update_data: BasketQuantityUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_any_user),
    redis_client=Depends(get_redis),
):
    basket_item = db.query(BasketItem).filter(
        BasketItem.task_id == update_data.task_id,
    ).first()

    if not basket_item:
        raise HTTPException(status_code=404, detail="Basket item not found")

    if basket_item.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this basket item")

    basket_item.quantity = update_data.quantity
    db.commit()
    db.refresh(basket_item)
    cache_invalidate(redis_client, f"fitd:basket:{user.user_id}")
    publish_event(redis_client, "basket:updated", user_id=user.user_id)

    return basket_item


@router.get("/file_storage/{file_id}")
def get_file_from_storage(
    request: Request, file_id: str, _: User = Depends(get_any_user)
):
    _validate_file_id(file_id)
    file_path = os.path.join("uploads", f"{file_id}.obj")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    with open(file_path, "rb") as file:
        file_data = file.read()
        encoded_data = base64.b64encode(file_data).decode("utf-8")

    return {"file_id": file_id, "file_data": encoded_data}


@router.post("/file_storage")
@limiter.limit("30/minute")
def post_basket_item_to_storage(
    request: Request,
    basket_item: BasketItemInformation,
    db: Session = Depends(get_db),
    user: User = Depends(get_any_user),
    redis_client=Depends(get_redis),
):
    user_exists = check_user_existence(db, basket_item.user_id)
    if not user_exists:
        raise HTTPException(status_code=404, detail="User not found")

    if basket_item.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to add items for another user")

    if not basket_item.file_blob:
        raise HTTPException(status_code=400, detail="File blob not provided")

    if len(basket_item.file_blob) > MAX_FILE_SIZE_B64:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_FILE_SIZE_MB}MB limit")

    # Ensure the task exists (manual uploads may not have created one)
    existing_task = db.query(Task).filter(Task.task_id == basket_item.task_id).first()
    if not existing_task:
        db.add(Task(
            task_id=basket_item.task_id,
            user_id=basket_item.user_id,
            task_name=basket_item.name,
            file_type=basket_item.selectedFileType,
            complete=True,
        ))
        db.flush()

    try:
        decode_file(basket_item.file_blob, basket_item.task_id, UPLOAD_DIR)
        add_or_update_basket_item_in_db(db, basket_item)
    except Exception as e:
        logger.exception("File decoding failed")
        raise HTTPException(status_code=500, detail="File decoding failed")
    cache_invalidate(redis_client, f"fitd:basket:{basket_item.user_id}")
    publish_event(redis_client, "basket:updated", user_id=basket_item.user_id)
    return {"message": "File successfully saved"}


@router.delete("/file_storage/{file_id}")
def delete_basket_item(
    request: Request,
    file_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_any_user),
    redis_client=Depends(get_redis),
):
    _validate_file_id(file_id)
    try:
        basket_item = db.query(BasketItem).filter(
            BasketItem.task_id == file_id
            ).first()

        if not basket_item:
            raise HTTPException(
                status_code=404, detail=f"Item with ID {file_id} not found."
            )

        if basket_item.user_id != user.user_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this basket item")

        extensions = ["stl", "obj", "step", "stp"]

        file_deleted = False
        for ext in extensions:
            file_path = os.path.join(UPLOAD_DIR, f"{file_id}.{ext}")
            if os.path.exists(file_path):
                os.remove(file_path)
                file_deleted = True
                logger.info(f"Deleted file: {file_path}")

        if not file_deleted:
            raise HTTPException(
                status_code=404,
                detail=f"File {file_id} with extensions {extensions} not found in upload directory.",
            )

        user_id = basket_item.user_id
        db.delete(basket_item)
        db.commit()
        cache_invalidate(redis_client, f"fitd:basket:{user_id}")
        publish_event(redis_client, "basket:updated", user_id=user_id)

        return {
            "message": f"Item with ID {file_id} and associated file(s) deleted successfully."
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception("An unexpected error occurred while deleting basket item")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.get("/all_basket_items")
def get_all_basket_items(
    user_id: str,
    db: Session = Depends(get_db),
    authorization: str = Depends(verify_jwt_token),
):
    basket_items = db.query(BasketItem).filter(BasketItem.user_id == user_id).all()
    if not basket_items:
        raise HTTPException(status_code=400, detail="Basket is empty")

    return basket_items

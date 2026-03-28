"""File upload and basket storage endpoints."""
import os
import logging
import base64

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from dependencies import get_db, get_redis
from cache import cache_invalidate
from events import publish_event
from config import UPLOAD_DIR, MAX_FILE_SIZE_MB, MAX_FILE_SIZE_B64
from utils import (
    check_user_existence,
    add_or_update_basket_item_in_db,
    cookie_verification,
    cookie_verification_user_only,
    decode_file,
    mark_meshy_task_complete,
    delete_port_id,
)
from jwt_auth import verify_jwt_token

from fitd_schemas.fitd_db_schemas import Task, BasketItem
from fitd_schemas.fitd_classes import (
    MeshyTaskStatusResponse,
    ImageTo3DMeshyTaskStatusResponse,
    BasketItemInformation,
    BasketQuantityUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/file_upload")
def receive_meshy_task(
    response: MeshyTaskStatusResponse,
    payload: dict = Depends(verify_jwt_token),
    db: Session = Depends(get_db),
):
    if response.obj_file_blob:
        if len(response.obj_file_blob) > MAX_FILE_SIZE_B64:
            raise HTTPException(status_code=413, detail=f"File exceeds {MAX_FILE_SIZE_MB}MB limit")
        file_data = base64.b64decode(response.obj_file_blob)
        file_path = UPLOAD_DIR / f"{response.id}.obj"

        with open(file_path, "wb") as file:
            file.write(file_data)
        mark_meshy_task_complete(db, response.id)
        delete_port_id(db, response.id)
        return {
            "message": "File saved successfully.",
            "file_name": str(file_path),
            "user": payload,
        }
    return {"message": "No OBJ file blob provided."}


@router.post("/file_upload_from_image")
def receive_meshy_task_from_image_generator(
    response: ImageTo3DMeshyTaskStatusResponse,
    payload: dict = Depends(verify_jwt_token),
    db: Session = Depends(get_db),
):
    if response.obj_file_blob:
        if len(response.obj_file_blob) > MAX_FILE_SIZE_B64:
            raise HTTPException(status_code=413, detail=f"File exceeds {MAX_FILE_SIZE_MB}MB limit")
        file_data = base64.b64decode(response.obj_file_blob)
        file_path = UPLOAD_DIR / f"{response.id}.obj"

        with open(file_path, "wb") as file:
            file.write(file_data)
        mark_meshy_task_complete(db, response.id)
        delete_port_id(db, response.id)
        return {
            "message": "File saved successfully.",
            "file_name": str(file_path),
            "user": payload,
        }
    return {"message": "No OBJ file blob provided."}


@router.post("/basket_item_quantity")
def update_basket_quantity(
    update_data: BasketQuantityUpdate,
    db: Session = Depends(get_db),
    user_information: None = Depends(cookie_verification_user_only),
    redis_client=Depends(get_redis),
):
    basket_item = db.query(BasketItem).filter(
        BasketItem.task_id == update_data.task_id,
    ).first()

    if not basket_item:
        raise HTTPException(status_code=404, detail="Basket item not found")

    if basket_item.user_id != user_information.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this basket item")

    basket_item.quantity = update_data.quantity
    db.commit()
    db.refresh(basket_item)
    cache_invalidate(redis_client, f"fitd:basket:{user_information.user_id}")
    publish_event(redis_client, "basket:updated", user_id=user_information.user_id)

    return basket_item


@router.get("/file_storage/{file_id}")
def get_file_from_storage(
    request: Request, file_id: str, _: None = Depends(cookie_verification)
):
    file_path = os.path.join("uploads", f"{file_id}.obj")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    with open(file_path, "rb") as file:
        file_data = file.read()
        encoded_data = base64.b64encode(file_data).decode("utf-8")

    return {"file_id": file_id, "file_data": encoded_data}


@router.post("/file_storage")
def post_basket_item_to_storage(
    request: Request,
    basket_item: BasketItemInformation,
    db: Session = Depends(get_db),
    user_information: None = Depends(cookie_verification_user_only),
    redis_client=Depends(get_redis),
):
    user_exists = check_user_existence(db, basket_item.user_id)
    if not user_exists:
        raise HTTPException(status_code=404, detail="User not found")

    if basket_item.user_id != user_information.user_id:
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
    user_information: None = Depends(cookie_verification_user_only),
    redis_client=Depends(get_redis),
):
    try:
        basket_item = db.query(BasketItem).filter(
            BasketItem.task_id == file_id
            ).first()

        if not basket_item:
            raise HTTPException(
                status_code=404, detail=f"Item with ID {file_id} not found."
            )

        if basket_item.user_id != user_information.user_id:
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

"""Parts catalog endpoints."""
import json
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from dependencies import get_db
from config import UPLOAD_DIR
from utils import cookie_verification, cookie_verification_user_only

from fitd_schemas.fitd_db_schemas import Task, BasketItem, Part
from fitd_schemas.fitd_classes import (
    PartCreate,
    PartUpdate,
    PartResponse,
    PartListResponse,
    PartOrderConfig,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/parts", response_model=PartListResponse)
def list_parts(
    q: Optional[str] = None,
    category: Optional[str] = None,
    file_type: Optional[str] = None,
    process: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    _: None = Depends(cookie_verification),
):
    query = db.query(Part).filter(Part.status == "published", Part.is_public == True)

    if q:
        query = query.filter(Part.name.ilike(f"%{q}%"))
    if category:
        query = query.filter(Part.category == category)
    if file_type:
        query = query.filter(Part.file_type == file_type)
    if process:
        query = query.filter(Part.recommended_process == process)

    total = query.count()
    parts = query.order_by(Part.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "parts": [PartResponse.from_orm(p) for p in parts],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/parts/{part_id}", response_model=PartResponse)
def get_part(
    part_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(cookie_verification),
):
    part = db.query(Part).filter(Part.id == part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    return part


@router.post("/parts", response_model=PartResponse, status_code=201)
def create_part(
    part_data: PartCreate,
    db: Session = Depends(get_db),
    user_information=Depends(cookie_verification_user_only),
):
    task = db.query(Task).filter(Task.task_id == part_data.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.user_id != user_information.user_id:
        raise HTTPException(status_code=403, detail="You can only publish parts from your own files")

    part = Part(
        publisher_user_id=user_information.user_id,
        name=part_data.name,
        description=part_data.description,
        category=part_data.category,
        tags=json.dumps(part_data.tags) if part_data.tags else None,
        task_id=part_data.task_id,
        file_type=part_data.file_type,
        thumbnail_url=part_data.thumbnail_url,
        bounding_box_x=part_data.bounding_box_x,
        bounding_box_y=part_data.bounding_box_y,
        bounding_box_z=part_data.bounding_box_z,
        volume_cm3=part_data.volume_cm3,
        surface_area_cm2=part_data.surface_area_cm2,
        recommended_process=part_data.recommended_process,
        recommended_material=part_data.recommended_material,
        status=part_data.status,
    )
    db.add(part)
    db.commit()
    db.refresh(part)
    return part


@router.put("/parts/{part_id}", response_model=PartResponse)
def update_part(
    part_id: str,
    part_data: PartUpdate,
    db: Session = Depends(get_db),
    user_information=Depends(cookie_verification_user_only),
):
    part = db.query(Part).filter(Part.id == part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    if part.publisher_user_id != user_information.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this part")

    update_fields = part_data.dict(exclude_unset=True)
    for field, value in update_fields.items():
        if field == "tags" and value is not None:
            setattr(part, field, json.dumps(value))
        else:
            setattr(part, field, value)

    db.commit()
    db.refresh(part)
    return part


@router.delete("/parts/{part_id}")
def delete_part(
    part_id: str,
    db: Session = Depends(get_db),
    user_information=Depends(cookie_verification_user_only),
):
    part = db.query(Part).filter(Part.id == part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    if part.publisher_user_id != user_information.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this part")

    part.status = "archived"
    db.commit()
    return {"message": "Part archived", "part_id": part_id}


@router.post("/parts/{part_id}/order", status_code=201)
def order_from_part(
    part_id: str,
    config: PartOrderConfig,
    db: Session = Depends(get_db),
    user_information=Depends(cookie_verification_user_only),
):
    part = db.query(Part).filter(Part.id == part_id, Part.status == "published").first()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found or not published")

    task = db.query(Task).filter(Task.task_id == part.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Source file not found")

    material = config.material or part.recommended_material or "PLA Basic"
    technique = config.technique or part.recommended_process or "FDM"

    file_path = UPLOAD_DIR / f"{part.task_id}.{part.file_type}"
    selected_file = str(file_path) if file_path.exists() else part.task_id

    basket_item = BasketItem(
        task_id=f"catalog-{part.id}-{str(uuid.uuid4())[:8]}",
        user_id=user_information.user_id,
        name=part.name,
        material=material,
        technique=technique,
        sizing=config.sizing,
        colour=config.colour,
        selectedFile=selected_file,
        selectedFileType=part.file_type,
        price=config.price,
        quantity=config.quantity,
    )
    db.add(basket_item)

    part.download_count += 1
    db.commit()

    return {"message": "Part added to basket", "part_id": part_id, "basket_task_id": basket_item.task_id}

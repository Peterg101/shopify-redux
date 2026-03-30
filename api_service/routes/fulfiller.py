"""Fulfiller profile and manufacturing reference data endpoints."""
import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from dependencies import get_db, get_redis, get_any_user
from cache import cached, cache_invalidate
from events import publish_event

from fitd_schemas.fitd_db_schemas import (
    User, ManufacturingProcess, ManufacturingMaterial, FulfillerProfile, FulfillerCapability,
)
from fitd_schemas.fitd_classes import (
    ManufacturingProcessResponse,
    ManufacturingMaterialResponse,
    FulfillerProfileCreate,
    FulfillerProfileResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/fulfiller_profile/{user_id}", response_model=FulfillerProfileResponse)
def get_fulfiller_profile(
    user_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_any_user),
):
    profile = db.query(FulfillerProfile).filter(FulfillerProfile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Fulfiller profile not found")
    return profile


@router.post("/fulfiller_profile", response_model=FulfillerProfileResponse, status_code=201)
def create_fulfiller_profile(
    profile_data: FulfillerProfileCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_any_user),
    redis_client=Depends(get_redis),
):
    existing = db.query(FulfillerProfile).filter(
        FulfillerProfile.user_id == user.user_id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Fulfiller profile already exists. Use PUT to update.")

    profile = FulfillerProfile(
        user_id=user.user_id,
        business_name=profile_data.business_name,
        description=profile_data.description,
        max_build_volume_x=profile_data.max_build_volume_x,
        max_build_volume_y=profile_data.max_build_volume_y,
        max_build_volume_z=profile_data.max_build_volume_z,
        min_tolerance_mm=profile_data.min_tolerance_mm,
        lead_time_days_min=profile_data.lead_time_days_min,
        lead_time_days_max=profile_data.lead_time_days_max,
        certifications=json.dumps(profile_data.certifications) if profile_data.certifications else None,
        post_processing=json.dumps(profile_data.post_processing) if profile_data.post_processing else None,
    )
    db.add(profile)
    db.flush()

    for cap in profile_data.capabilities:
        process = db.query(ManufacturingProcess).filter(ManufacturingProcess.id == cap.process_id).first()
        if not process:
            raise HTTPException(status_code=400, detail=f"Invalid process_id: {cap.process_id}")
        capability = FulfillerCapability(
            profile_id=profile.id,
            process_id=cap.process_id,
            materials=json.dumps(cap.materials) if cap.materials else None,
            notes=cap.notes,
        )
        db.add(capability)

    db.commit()
    db.refresh(profile)
    cache_invalidate(redis_client, f"fitd:session:{user.user_id}")
    publish_event(redis_client, "profile:updated", user_id=user.user_id)
    return profile


@router.put("/fulfiller_profile", response_model=FulfillerProfileResponse)
def update_fulfiller_profile(
    profile_data: FulfillerProfileCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_any_user),
    redis_client=Depends(get_redis),
):
    profile = db.query(FulfillerProfile).filter(
        FulfillerProfile.user_id == user.user_id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Fulfiller profile not found. Use POST to create.")

    profile.business_name = profile_data.business_name
    profile.description = profile_data.description
    profile.max_build_volume_x = profile_data.max_build_volume_x
    profile.max_build_volume_y = profile_data.max_build_volume_y
    profile.max_build_volume_z = profile_data.max_build_volume_z
    profile.min_tolerance_mm = profile_data.min_tolerance_mm
    profile.lead_time_days_min = profile_data.lead_time_days_min
    profile.lead_time_days_max = profile_data.lead_time_days_max
    profile.certifications = json.dumps(profile_data.certifications) if profile_data.certifications else None
    profile.post_processing = json.dumps(profile_data.post_processing) if profile_data.post_processing else None

    db.query(FulfillerCapability).filter(FulfillerCapability.profile_id == profile.id).delete()
    for cap in profile_data.capabilities:
        process = db.query(ManufacturingProcess).filter(ManufacturingProcess.id == cap.process_id).first()
        if not process:
            raise HTTPException(status_code=400, detail=f"Invalid process_id: {cap.process_id}")
        capability = FulfillerCapability(
            profile_id=profile.id,
            process_id=cap.process_id,
            materials=json.dumps(cap.materials) if cap.materials else None,
            notes=cap.notes,
        )
        db.add(capability)

    db.commit()
    db.refresh(profile)
    cache_invalidate(redis_client, f"fitd:session:{user.user_id}")
    publish_event(redis_client, "profile:updated", user_id=user.user_id)
    return profile


@router.get("/manufacturing/processes", response_model=List[ManufacturingProcessResponse])
def list_manufacturing_processes(
    db: Session = Depends(get_db),
    redis_client=Depends(get_redis),
    _: User = Depends(get_any_user),
):
    return cached(
        redis_client, "fitd:ref:processes", ttl=21600,
        loader=lambda: [ManufacturingProcessResponse.from_orm(p) for p in db.query(ManufacturingProcess).order_by(ManufacturingProcess.family, ManufacturingProcess.name).all()],
        model_class=ManufacturingProcessResponse, is_list=True, l1=True, l1_ttl=3600,
    )


@router.get("/manufacturing/materials", response_model=List[ManufacturingMaterialResponse])
def list_manufacturing_materials(
    process_family: Optional[str] = None,
    db: Session = Depends(get_db),
    redis_client=Depends(get_redis),
    _: User = Depends(get_any_user),
):
    cache_key = f"fitd:ref:materials:{process_family or 'all'}"
    query = db.query(ManufacturingMaterial)
    if process_family:
        query = query.filter(ManufacturingMaterial.process_family == process_family)
    return cached(
        redis_client, cache_key, ttl=21600,
        loader=lambda: [ManufacturingMaterialResponse.from_orm(m) for m in query.order_by(ManufacturingMaterial.category, ManufacturingMaterial.name).all()],
        model_class=ManufacturingMaterialResponse, is_list=True, l1=True, l1_ttl=3600,
    )

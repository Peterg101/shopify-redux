"""User-related endpoints."""
import logging
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session, joinedload, selectinload

from dependencies import get_db, get_redis, get_any_user
from cache import cached, cache_invalidate
from events import publish_event
from helpers import _order_to_response
from utils import (
    check_user_existence,
    add_user_to_db,
)
from jwt_auth import verify_jwt_token

from fitd_schemas.fitd_db_schemas import (
    User, Task, BasketItem, Order, UserStripeAccount, Claim, FulfillerProfile,
)
from fitd_schemas.fitd_classes import (
    UserInformation,
    UserHydrationResponse,
    UserResponse,
    TaskResponse,
    BasketItemResponse,
    OrderResponse,
    ClaimWithOrderResponse,
    IncompleteTaskResponse,
    FulfillerProfileResponse,
    SlimSessionResponse,
    PasswordVerifyRequest,
    EmailRegisterRequest,
    StripeAccountCreateRequest,
    FulfillerAddressUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/users", response_model=Dict[str, str], status_code=201)
def create_user(
    user_information: UserInformation,
    db: Session = Depends(get_db),
    authorization: str = Depends(verify_jwt_token),
):
    user_exists = check_user_existence(db, user_information.user_id)

    if not user_exists:
        user = add_user_to_db(db, user_information)
    else:
        user = db.query(User).filter(User.user_id == user_information.user_id).first()

    return {"user_id": user.user_id, "username": user.username, "email": user.email}


@router.post("/users/register", response_model=Dict[str, str], status_code=201)
def register_user(
    user_information: UserInformation,
    db: Session = Depends(get_db),
    authorization: str = Depends(verify_jwt_token),
):
    existing_email = db.query(User).filter(User.email == user_information.email).first()
    if existing_email:
        raise HTTPException(status_code=409, detail="Email already registered")

    existing_username = db.query(User).filter(User.username == user_information.username).first()
    if existing_username:
        raise HTTPException(status_code=409, detail="Username already taken")

    user = add_user_to_db(db, user_information)
    return {"user_id": user.user_id, "username": user.username, "email": user.email}


@router.get("/users/by_email/{email}")
def get_user_by_email(
    email: str,
    db: Session = Depends(get_db),
    authorization: str = Depends(verify_jwt_token),
):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "user_id": user.user_id,
        "username": user.username,
        "email": user.email,
        "auth_provider": user.auth_provider,
    }


@router.post("/auth/verify_password")
def verify_password(
    payload: PasswordVerifyRequest,
    db: Session = Depends(get_db),
    authorization: str = Depends(verify_jwt_token),
):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.password_hash:
        raise HTTPException(status_code=400, detail="No password set for this account")
    import bcrypt
    is_valid = bcrypt.checkpw(payload.password.encode("utf-8"), user.password_hash.encode("utf-8"))
    if not is_valid:
        return {"verified": False}
    return {"verified": True, "user_id": user.user_id, "username": user.username,
            "email": user.email, "auth_provider": user.auth_provider}


## -- Slim / Cached User Sub-Resource Endpoints --

@router.get("/users/{user_id}/session", response_model=SlimSessionResponse)
def get_user_session(
    user_id: str,
    db: Session = Depends(get_db),
    redis_client=Depends(get_redis),
    authorization: str = Depends(verify_jwt_token),
):
    cache_key = f"fitd:session:{user_id}"

    if redis_client is not None:
        try:
            raw = redis_client.get(cache_key)
            if raw is not None:
                return SlimSessionResponse.parse_raw(raw)
        except Exception:
            logger.warning(f"Redis GET failed for {cache_key}, falling through to DB")

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    incomplete = (
        db.query(Task)
        .filter(Task.user_id == user_id, Task.complete == False)
        .options(joinedload(Task.port))
        .first()
    )

    user_stripe = db.query(UserStripeAccount).filter(
        UserStripeAccount.user_id == user_id
    ).first()

    fulfiller_profile = db.query(FulfillerProfile).filter(
        FulfillerProfile.user_id == user_id
    ).first()

    result = SlimSessionResponse(
        user=UserResponse.from_orm(user),
        stripe_onboarded=bool(user_stripe and user_stripe.onboarding_complete),
        has_fulfiller_profile=bool(fulfiller_profile),
        email_verified=getattr(user, "email_verified", False),
        incomplete_task=IncompleteTaskResponse.from_orm(incomplete) if incomplete else None,
    )

    if redis_client is not None:
        try:
            redis_client.set(cache_key, result.json(), ex=30)
        except Exception:
            logger.warning(f"Redis SET failed for {cache_key}")

    return result


@router.get("/users/{user_id}/basket")
def get_user_basket(
    user_id: str,
    db: Session = Depends(get_db),
    redis_client=Depends(get_redis),
    authorization: str = Depends(verify_jwt_token),
):
    return cached(
        redis_client, f"fitd:basket:{user_id}", ttl=60,
        loader=lambda: [BasketItemResponse.from_orm(b) for b in db.query(BasketItem).filter(BasketItem.user_id == user_id).all()],
        model_class=BasketItemResponse, is_list=True,
    )


@router.get("/users/{user_id}/orders")
def get_user_orders(
    user_id: str,
    db: Session = Depends(get_db),
    redis_client=Depends(get_redis),
    authorization: str = Depends(verify_jwt_token),
):
    return cached(
        redis_client, f"fitd:orders:{user_id}", ttl=120,
        loader=lambda: [_order_to_response(o) for o in db.query(Order).filter(Order.user_id == user_id).all()],
        model_class=OrderResponse, is_list=True,
    )


@router.get("/users/{user_id}/claims")
def get_user_claims(
    user_id: str,
    db: Session = Depends(get_db),
    redis_client=Depends(get_redis),
    authorization: str = Depends(verify_jwt_token),
):
    cache_key = f"fitd:claims:{user_id}"

    if redis_client is not None:
        try:
            raw = redis_client.get(cache_key)
            if raw is not None:
                import json as _json
                return [ClaimWithOrderResponse.parse_obj(item) for item in _json.loads(raw)]
        except Exception:
            logger.warning(f"Redis GET failed for {cache_key}, falling through to DB")

    claims = (
        db.query(Claim)
        .filter(Claim.claimant_user_id == user_id)
        .options(selectinload(Claim.order))
        .all()
    )
    claims_response = []
    for claim in claims:
        order_data = _order_to_response(claim.order)
        claims_response.append(ClaimWithOrderResponse(
            id=claim.id, order_id=claim.order_id,
            claimant_user_id=claim.claimant_user_id,
            quantity=claim.quantity, status=claim.status,
            created_at=claim.created_at, updated_at=claim.updated_at,
            order=order_data,
        ))

    if redis_client is not None:
        try:
            import json as _json
            serialized = _json.dumps([c.dict() for c in claims_response], default=str)
            redis_client.set(cache_key, serialized, ex=120)
        except Exception:
            logger.warning(f"Redis SET failed for {cache_key}")

    return claims_response


@router.get("/users/{user_id}/claimable")
def get_user_claimable_orders(
    user_id: str,
    db: Session = Depends(get_db),
    redis_client=Depends(get_redis),
    authorization: str = Depends(verify_jwt_token),
):
    cache_key = f"fitd:claimable:{user_id}"

    if redis_client is not None:
        try:
            raw = redis_client.get(cache_key)
            if raw is not None:
                import json as _json
                return [OrderResponse.parse_obj(item) for item in _json.loads(raw)]
        except Exception:
            logger.warning(f"Redis GET failed for {cache_key}, falling through to DB")

    all_collaborative = db.query(Order).filter(
        Order.user_id != user_id,
        Order.is_collaborative == True,
    ).all()

    fulfiller_profile = db.query(FulfillerProfile).filter(
        FulfillerProfile.user_id == user_id
    ).first()

    if fulfiller_profile and fulfiller_profile.capabilities:
        import json as _json
        cap_lookup = {}
        for cap in fulfiller_profile.capabilities:
            mat_ids = None
            if cap.materials:
                try:
                    parsed = _json.loads(cap.materials) if isinstance(cap.materials, str) else cap.materials
                    mat_ids = set(parsed) if parsed else None
                except (ValueError, TypeError):
                    mat_ids = None
            cap_lookup[cap.process_id] = mat_ids

        claimable_orders = []
        for order in all_collaborative:
            if order.process_id is None:
                claimable_orders.append(order)
            elif order.process_id in cap_lookup:
                fulfiller_mats = cap_lookup[order.process_id]
                if fulfiller_mats is None or order.material_id is None or order.material_id in fulfiller_mats:
                    claimable_orders.append(order)
    else:
        claimable_orders = all_collaborative

    claimable_response = [_order_to_response(order) for order in claimable_orders]

    if redis_client is not None:
        try:
            import json as _json
            serialized = _json.dumps([o.dict() for o in claimable_response], default=str)
            redis_client.set(cache_key, serialized, ex=60)
        except Exception:
            logger.warning(f"Redis SET failed for {cache_key}")

    return claimable_response


@router.get("/users/{user_id}/tasks")
def get_user_tasks(
    user_id: str,
    db: Session = Depends(get_db),
    redis_client=Depends(get_redis),
    authorization: str = Depends(verify_jwt_token),
):
    return cached(
        redis_client, f"fitd:tasks:{user_id}", ttl=120,
        loader=lambda: [TaskResponse.from_orm(t) for t in db.query(Task).filter(Task.user_id == user_id).options(joinedload(Task.port)).all()],
        model_class=TaskResponse, is_list=True,
    )


@router.get("/users/{user_id}", response_model=UserHydrationResponse)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    authorization: str = Depends(verify_jwt_token),
):
    user = (
        db.query(User)
        .filter(User.user_id == user_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    tasks = (
        db.query(Task)
        .filter(Task.user_id == user_id)
        .options(joinedload(Task.port))
        .all()
    )
    incomplete_task = next((t for t in tasks if not t.complete), None)

    basket_items = (
        db.query(BasketItem)
        .filter(BasketItem.user_id == user_id)
        .all()
    )

    claims = (
        db.query(Claim)
        .filter(Claim.claimant_user_id == user_id)
        .options(selectinload(Claim.order))
        .all()
    )
    claims_response = []
    for claim in claims:
        order_data = _order_to_response(claim.order)
        claims_response.append(ClaimWithOrderResponse(
            id=claim.id, order_id=claim.order_id,
            claimant_user_id=claim.claimant_user_id,
            quantity=claim.quantity, status=claim.status,
            created_at=claim.created_at, updated_at=claim.updated_at,
            order=order_data,
        ))

    orders = db.query(Order).filter(Order.user_id == user_id).all()
    orders_response = [_order_to_response(order) for order in orders]

    user_stripe = db.query(UserStripeAccount).filter(
        UserStripeAccount.user_id == user_id
    ).first()
    stripe_onboarded = bool(user_stripe and user_stripe.onboarding_complete)

    fulfiller_profile = db.query(FulfillerProfile).filter(
        FulfillerProfile.user_id == user_id
    ).first()
    fulfiller_profile_response = FulfillerProfileResponse.from_orm(fulfiller_profile) if fulfiller_profile else None

    all_collaborative = db.query(Order).filter(
        Order.user_id != user_id,
        Order.is_collaborative == True
    ).all()

    if fulfiller_profile and fulfiller_profile.capabilities:
        import json as _json
        cap_lookup = {}
        for cap in fulfiller_profile.capabilities:
            mat_ids = None
            if cap.materials:
                try:
                    parsed = _json.loads(cap.materials) if isinstance(cap.materials, str) else cap.materials
                    mat_ids = set(parsed) if parsed else None
                except (ValueError, TypeError):
                    mat_ids = None
            cap_lookup[cap.process_id] = mat_ids

        claimable_orders = []
        for order in all_collaborative:
            if order.process_id is None:
                claimable_orders.append(order)
            elif order.process_id in cap_lookup:
                fulfiller_mats = cap_lookup[order.process_id]
                if fulfiller_mats is None or order.material_id is None or order.material_id in fulfiller_mats:
                    claimable_orders.append(order)
    else:
        claimable_orders = all_collaborative

    claimable_orders_response = [_order_to_response(order) for order in claimable_orders]

    return UserHydrationResponse(
        user=UserResponse.from_orm(user),
        tasks=[TaskResponse.from_orm(t) for t in tasks],
        basket_items=[BasketItemResponse.from_orm(b) for b in basket_items],
        incomplete_task=IncompleteTaskResponse.from_orm(incomplete_task) if incomplete_task else None,
        claimable_orders=claimable_orders_response,
        orders=orders_response,
        claims=claims_response,
        stripe_onboarded=stripe_onboarded,
        fulfiller_profile=fulfiller_profile_response,
    )


@router.get("/only_user/{user_id}")
def get_only_user(
    user_id: str,
    db: Session = Depends(get_db),
    authorization: str = Depends(verify_jwt_token),
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/user_onboarded_with_stripe/{user_id}")
def check_user_onboarded_with_stripe(
    user_id: str,
    db: Session = Depends(get_db),
    _: str = Depends(verify_jwt_token),
):
    user_stripe = (
        db.query(UserStripeAccount)
        .filter(UserStripeAccount.user_id == user_id)
        .first()
    )

    if not user_stripe:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    response_data = {
        "stripe_account_id": user_stripe.stripe_account_id,
        "onboarding_complete": getattr(user_stripe, "onboarding_complete", False),
        "created_at": getattr(user_stripe, "created_at", None),
        "updated_at": getattr(user_stripe, "updated_at", None),
    }

    return response_data


@router.post("/generate_user_stripe_account_in_db/{user_id}")
def generate_user_stripe_account_in_db(
    user_id: str,
    payload: StripeAccountCreateRequest,
    db: Session = Depends(get_db),
    _: str = Depends(verify_jwt_token),
):
    existing = db.query(UserStripeAccount).filter_by(user_id=user_id).first()
    if existing:
        existing.stripe_account_id = payload.stripe_account_id
        db.commit()
        return {"message": "Stripe account updated", "user_id": user_id}

    record = UserStripeAccount(
        user_id=user_id,
        stripe_account_id=payload.stripe_account_id,
        onboarding_complete=False
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {"message": "Stripe account created", "user_id": user_id, "stripe_account_id": payload.stripe_account_id}


@router.post("/stripe/confirm_onboarding/{stripe_account_id}")
def confirm_onboarding(
    stripe_account_id: str,
    payload: dict = Depends(verify_jwt_token),
    db: Session = Depends(get_db),
    redis_client=Depends(get_redis),
):
    account = db.query(UserStripeAccount).filter(
        UserStripeAccount.stripe_account_id == stripe_account_id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Stripe account not found")

    account.onboarding_complete = True
    db.commit()
    cache_invalidate(redis_client, f"fitd:session:{account.user_id}")
    publish_event(redis_client, "stripe:onboarded", user_id=account.user_id)
    return {"message": "Onboarding confirmed", "stripe_account_id": stripe_account_id}


@router.put("/users/{user_id}/fulfiller_address")
def update_fulfiller_address(
    user_id: str,
    address: FulfillerAddressUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_any_user),
):
    if user.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this address")

    stripe_account = db.query(UserStripeAccount).filter(
        UserStripeAccount.user_id == user_id
    ).first()
    if not stripe_account:
        raise HTTPException(status_code=404, detail="Stripe account not found. Complete Stripe onboarding first.")

    stripe_account.address_name = address.name
    stripe_account.address_line1 = address.line1
    stripe_account.address_line2 = address.line2
    stripe_account.address_city = address.city
    stripe_account.address_postal_code = address.postal_code
    stripe_account.address_country = address.country
    db.commit()

    return {"message": "Fulfiller address updated"}


@router.get("/users/{user_id}/fulfiller_address")
def get_fulfiller_address(
    user_id: str,
    user: User = Depends(get_any_user),
    db: Session = Depends(get_db),
):
    stripe_account = db.query(UserStripeAccount).filter(
        UserStripeAccount.user_id == user_id
    ).first()
    if not stripe_account or not stripe_account.address_line1:
        raise HTTPException(status_code=404, detail="Fulfiller address not found")

    return {
        "name": stripe_account.address_name,
        "line1": stripe_account.address_line1,
        "line2": stripe_account.address_line2,
        "city": stripe_account.address_city,
        "postal_code": stripe_account.address_postal_code,
        "country": stripe_account.address_country,
    }

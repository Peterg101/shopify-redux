import os
from dotenv import load_dotenv
load_dotenv()
import logging
from fastapi import FastAPI, HTTPException, Depends, Cookie, Header, Request, status, Response
from typing import List
from sqlalchemy.orm import Session, joinedload, selectinload
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)
from fitd_schemas.fitd_db_schemas import User, Task, BasketItem, PortID, Base, Order, UserStripeAccount, Claim, Disbursement, ClaimEvidence, ClaimStatusHistory, Dispute
from fitd_schemas.fitd_classes import UserHydrationResponse, ClaimWithOrderResponse, OrderResponse, OrderDetailResponse, ClaimDetailResponse, DisputeFulfillerResponse, DisputeResolveRequest, DisputeResponse, ClaimEvidenceResponse, ClaimStatusHistoryResponse
from datetime import datetime, timedelta
import uuid
from db_setup import engine, get_db
from utils import (
    check_session_token_active,
    add_or_update_basket_item_in_db,
    add_port_to_db,
    check_user_existence,
    add_user_to_db,
    add_task_to_db,
    cookie_verification,
    cookie_verification_user_only,
    decode_file,
    mark_meshy_task_complete,
    delete_port_id,
    add_claim_to_db
)

from api_calls import session_exists
import os
from fitd_schemas.fitd_classes import(
    UserInformation,
    TaskInformation,
    MeshyTaskStatusResponse,
    BasketItemInformation,
    BasketQuantityUpdate,
    ImageTo3DMeshyTaskStatusResponse,
    StripeCheckoutOrder,
    ClaimOrder,
    ClaimStatusUpdate,
    EmailRegisterRequest,
    ClaimQuantityUpdate,
    FulfillerAddressUpdate,
    ClaimShippingUpdate,
)
import uvicorn
from typing import Optional, Dict
from jwt_auth import verify_jwt_token
import base64
from pathlib import Path
import re

UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Initialize FastAPI app
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:1234", "http://localhost:100"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/users", response_model=Dict[str, str], status_code=201)
def create_user(
    user_information: UserInformation,
    db: Session = Depends(get_db),
    authorization: str = Depends(verify_jwt_token),
):
    # Check if the user already exists
    user_exists = check_user_existence(db, user_information.email)

    # Add the user to the database
    if not user_exists:
        user = add_user_to_db(db, user_information)

    # Return the created user's data
    return {"user_id": user.user_id, "username": user.username, "email": user.email}


@app.post("/users/register", response_model=Dict[str, str])
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


@app.get("/users/by_email/{email}")
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
        "password_hash": user.password_hash,
        "auth_provider": user.auth_provider,
    }


# Add a Task
@app.post("/tasks", status_code=201)
async def add_task(
    task_information: TaskInformation,
    db: Session = Depends(get_db),
    authorization: str = Depends(verify_jwt_token),
):
    user_exists = check_user_existence(db, task_information.user_id)

    if user_exists and task_information.port_id and task_information.task_id:
        add_task_to_db(db, task_information)
        add_port_to_db(db, task_information.task_id, task_information.port_id)
    return ""


@app.get("/users/{user_id}", response_model=UserHydrationResponse)
async def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    authorization: str = Depends(verify_jwt_token),
):
    # 1️⃣ Load the user (fail fast)
    user = (
        db.query(User)
        .filter(User.user_id == user_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 2️⃣ Tasks — single query with eager-loaded port for incomplete task detection
    tasks = (
        db.query(Task)
        .filter(Task.user_id == user_id)
        .options(joinedload(Task.port))
        .all()
    )
    incomplete_task = next((t for t in tasks if not t.complete), None)
    
       
    # 3️⃣ Basket items
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
    claims_response = [ClaimWithOrderResponse.from_orm(claim) for claim in claims]

    # Convert orders to Pydantic too
    orders = db.query(Order).filter(Order.user_id == user_id).all()
    claimable_orders = db.query(Order).filter(
        Order.user_id != user_id,
        Order.is_collaborative == True
    ).all()
    orders_response = [OrderResponse.from_orm(order) for order in orders]
    claimable_orders_response = [OrderResponse.from_orm(order) for order in claimable_orders]

    # Check Stripe onboarding status
    user_stripe = db.query(UserStripeAccount).filter(
        UserStripeAccount.user_id == user_id
    ).first()
    stripe_onboarded = bool(user_stripe and user_stripe.onboarding_complete)

    return {
        "user": user,
        "tasks": tasks,
        "basket_items": basket_items,
        "incomplete_task": incomplete_task,
        "claimable_orders": claimable_orders_response,
        "orders": orders_response,
        "claims": claims_response,
        "stripe_onboarded": stripe_onboarded,
    }


# Get User
@app.get("/only_user/{user_id}")
async def get_only_user(
    user_id: str,
    db: Session = Depends(get_db),
    authorization: str = Depends(verify_jwt_token),
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# Check that user is onboarded with stripe
@app.get("/user_onboarded_with_stripe/{user_id}")
async def check_user_onboarded_with_stripe(
    user_id: str,
    db: Session = Depends(get_db),
    _: str = Depends(verify_jwt_token),
):
    """
    Return the user's Stripe account info if onboarded,
    otherwise return 204 No Content.
    """
    user_stripe = (
        db.query(UserStripeAccount)
        .filter(UserStripeAccount.user_id == user_id)
        .first()
    )

    if not user_stripe:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    # If you only want to return limited fields, filter them here:
    response_data = {
        "stripe_account_id": user_stripe.stripe_account_id,
        "onboarding_complete": getattr(user_stripe, "onboarding_complete", False),
        "created_at": getattr(user_stripe, "created_at", None),
        "updated_at": getattr(user_stripe, "updated_at", None),
    }

    return response_data


@app.post("/generate_user_stripe_account_in_db/{user_id}")
async def generate_user_stripe_account_in_db(
    user_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    _: str = Depends(verify_jwt_token),
):
    """
    Creates a Stripe account record in the DB for a given user.
    """
    stripe_account_id = payload.get("stripe_account_id")
    if not stripe_account_id:
        raise HTTPException(status_code=400, detail="Missing stripe_account_id")

    existing = db.query(UserStripeAccount).filter_by(user_id=user_id).first()
    if existing:
        existing.stripe_account_id = stripe_account_id
        db.commit()
        return {"message": "Stripe account updated", "user_id": user_id}

    record = UserStripeAccount(
        user_id=user_id,
        stripe_account_id=stripe_account_id,
        onboarding_complete=False
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {"message": "Stripe account created", "user_id": user_id, "stripe_account_id": stripe_account_id}


@app.post("/file_upload")
async def receive_meshy_task(
    response: MeshyTaskStatusResponse,
    payload: dict = Depends(verify_jwt_token),
    db: Session = Depends(get_db),
):
    if response.obj_file_blob:
        # Decode the Base64 blob
        file_data = base64.b64decode(response.obj_file_blob)
        file_path = UPLOAD_DIR / f"{response.id}.obj"

        # Save the decoded file
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


@app.post("/file_upload_from_image")
async def receive_meshy_task_from_image_generator(
    response: ImageTo3DMeshyTaskStatusResponse,
    payload: dict = Depends(verify_jwt_token),
    db: Session = Depends(get_db),
):
    if response.obj_file_blob:
        # Decode the Base64 blob
        file_data = base64.b64decode(response.obj_file_blob)
        file_path = UPLOAD_DIR / f"{response.id}.obj"

        # Save the decoded file
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


@app.post("/basket_item_quantity")
async def update_basket_quantity(
    update_data: BasketQuantityUpdate,
    db: Session = Depends(get_db),
    _: None = Depends(cookie_verification),
   
):
    basket_item = db.query(BasketItem).filter(
        BasketItem.task_id == update_data.task_id,
    ).first()

    if not basket_item:
        raise HTTPException(status_code=404, detail="Basket item not found")
    
    basket_item.quantity = update_data.quantity
    db.commit()
    db.refresh(basket_item)

    return basket_item


@app.get("/file_storage/{file_id}")
async def get_file_from_storage(
    request: Request, file_id: str, _: None = Depends(cookie_verification)
):
    file_path = os.path.join("uploads", f"{file_id}.obj")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    with open(file_path, "rb") as file:
        file_data = file.read()
        encoded_data = base64.b64encode(file_data).decode("utf-8")

    return {"file_id": file_id, "file_data": encoded_data}


@app.post("/file_storage")
async def post_basket_item_to_storage(
    request: Request,
    basket_item: BasketItemInformation,
    db: Session = Depends(get_db),
    _: None = Depends(cookie_verification),
):
    # Check if the user exists in the database
    user_exists = check_user_existence(db, basket_item.user_id)
    if not user_exists:
        raise HTTPException(status_code=404, detail="User not found")
    # Validate the file_blob presence
    if not basket_item.file_blob:
        raise HTTPException(status_code=400, detail="File blob not provided")

    # Decode the file and save to the specified directory
    try:
        decode_file(basket_item.file_blob, basket_item.task_id, UPLOAD_DIR)
        add_or_update_basket_item_in_db(db, basket_item)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File decoding failed: {str(e)}")
    return {"message": "File successfully saved"}


@app.delete("/file_storage/{file_id}")
async def delete_basket_item(
    request: Request,
    file_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(
        cookie_verification
    ),  
):
    try:
        # Query the database for the item to delete
        basket_item = db.query(BasketItem).filter(
            BasketItem.task_id == file_id
            ).first()

        # If the item doesn't exist, raise a 404 error
        if not basket_item:
            raise HTTPException(
                status_code=404, detail=f"Item with ID {file_id} not found."
            )

        # Possible file extensions
        extensions = ["str", "obj"]

        # Attempt to delete the file for each extension
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

        # Delete the item from the database
        db.delete(basket_item)
        db.commit()

        return {
            "message": f"Item with ID {file_id} and associated file(s) deleted successfully."
        }
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        db.rollback()  # Rollback in case of an error
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")


@app.get("/all_basket_items")
async def get_all_basket_items(
    user_id: str,
    db: Session = Depends(get_db),
    authorization: str = Depends(verify_jwt_token),
):
    
    basket_items = db.query(BasketItem).filter(BasketItem.user_id == user_id).all()
    if not basket_items:
        raise HTTPException(status_code=400, detail="Basket is empty")
    
    return basket_items


@app.post("/orders/create_from_stripe_checkout")
async def create_order_from_stripe(
    checkout_order: StripeCheckoutOrder,
    payload: dict = Depends(verify_jwt_token),
    db: Session = Depends(get_db)
):
    if not checkout_order.line_items:
        raise HTTPException(status_code=400, detail="No line items found")

    # Idempotency guard: if orders already exist for this session, return early
    existing = db.query(Order).filter(
        Order.stripe_checkout_session_id == checkout_order.stripe_checkout_session_id
    ).first()
    if existing:
        return {"status": "already_processed", "stripe_checkout_session_id": checkout_order.stripe_checkout_session_id}

    shipping = checkout_order.shipping_address
    created_orders = []
    for item in checkout_order.line_items:
        order = Order(
            stripe_checkout_session_id=checkout_order.stripe_checkout_session_id,
            user_id=item.user_id,
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
            status=checkout_order.order_status,
            shipping_name=shipping.name if shipping else None,
            shipping_line1=shipping.line1 if shipping else None,
            shipping_line2=shipping.line2 if shipping else None,
            shipping_city=shipping.city if shipping else None,
            shipping_postal_code=shipping.postal_code if shipping else None,
            shipping_country=shipping.country if shipping else None,
        )
        created_orders.append(order)
        db.add(order)

    db.query(BasketItem).filter(BasketItem.user_id == checkout_order.user_id).delete()
    db.commit()
    return {"status": "success", "order_count": len(created_orders)}


@app.get("/orders/{order_id}/detail", response_model=OrderDetailResponse)
async def get_order_detail(
    order_id: str,
    db: Session = Depends(get_db),
    user_information: None = Depends(cookie_verification_user_only),
):
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    owner = db.query(User).filter(User.user_id == order.user_id).first()

    claims_detail = []
    for claim in order.claims:
        claimant = db.query(User).filter(User.user_id == claim.claimant_user_id).first()
        evidence = (
            db.query(ClaimEvidence)
            .filter(ClaimEvidence.claim_id == claim.id)
            .order_by(ClaimEvidence.uploaded_at)
            .all()
        )
        history = (
            db.query(ClaimStatusHistory)
            .filter(ClaimStatusHistory.claim_id == claim.id)
            .order_by(ClaimStatusHistory.changed_at)
            .all()
        )
        dispute = db.query(Dispute).filter(Dispute.claim_id == claim.id).first()

        claims_detail.append(ClaimDetailResponse(
            id=claim.id,
            order_id=claim.order_id,
            claimant_user_id=claim.claimant_user_id,
            claimant_username=claimant.username if claimant else "Unknown",
            quantity=claim.quantity,
            status=claim.status,
            created_at=claim.created_at,
            updated_at=claim.updated_at,
            evidence=[ClaimEvidenceResponse.from_orm(e) for e in evidence],
            status_history=[ClaimStatusHistoryResponse.from_orm(h) for h in history],
            dispute=DisputeResponse.from_orm(dispute) if dispute else None,
            tracking_number=claim.tracking_number,
            label_url=claim.label_url,
            carrier_code=claim.carrier_code,
        ))

    return OrderDetailResponse(
        order_id=order.order_id,
        task_id=order.task_id,
        user_id=order.user_id,
        owner_username=owner.username if owner else "Unknown",
        name=order.name,
        material=order.material,
        technique=order.technique,
        sizing=order.sizing,
        colour=order.colour,
        selectedFile=order.selectedFile,
        selectedFileType=order.selectedFileType,
        price=order.price,
        quantity=order.quantity,
        quantity_claimed=order.quantity_claimed,
        created_at=order.created_at,
        is_collaborative=order.is_collaborative,
        status=order.status,
        qa_level=order.qa_level,
        claims=claims_detail,
        shipping_name=order.shipping_name,
        shipping_line1=order.shipping_line1,
        shipping_line2=order.shipping_line2,
        shipping_city=order.shipping_city,
        shipping_postal_code=order.shipping_postal_code,
        shipping_country=order.shipping_country,
    )


@app.patch("/orders/{order_id}/visibility")
async def toggle_order_visibility(
    order_id: str,
    db: Session = Depends(get_db),
    user_information: None = Depends(cookie_verification_user_only),
):
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.user_id != user_information.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this order")
    # Don't allow making an order collaborative if it has active claims
    if not order.is_collaborative:
        # Allow toggling to collaborative freely
        pass
    else:
        # Toggling back to solo — block if there are active (non-terminal) claims
        active_claims = [c for c in order.claims if c.status not in ("accepted", "resolved_accepted", "resolved_partial", "resolved_rejected")]
        if active_claims:
            raise HTTPException(status_code=400, detail="Cannot make order private while it has active claims")
    order.is_collaborative = not order.is_collaborative
    db.commit()
    return {"order_id": order_id, "is_collaborative": order.is_collaborative}


@app.post("/orders/update_order")
async def update_order(
    update_payload: dict,
    payload: dict = Depends(verify_jwt_token),
    db: Session = Depends(get_db)
):
    try:
        order_id = update_payload.get("order_id")
        new_status = update_payload.get("order_status")
        if not order_id or not new_status:
            raise HTTPException(status_code=400, detail="order_id and order_status are required")

        orders = db.query(Order).filter(Order.order_id == order_id).all()

        if not orders:
            raise HTTPException(status_code=404, detail=f"No orders found with ID {order_id}")

        for order in orders:
            order.status = new_status

        db.commit()

        return {
            "status": "success",
            "updated_count": len(orders),
            "order_id": order_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating orders: {str(e)}")


@app.post("/stripe/confirm_onboarding/{stripe_account_id}")
async def confirm_onboarding(
    stripe_account_id: str,
    payload: dict = Depends(verify_jwt_token),
    db: Session = Depends(get_db),
):
    account = db.query(UserStripeAccount).filter(
        UserStripeAccount.stripe_account_id == stripe_account_id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Stripe account not found")

    account.onboarding_complete = True
    db.commit()
    return {"message": "Onboarding confirmed", "stripe_account_id": stripe_account_id}


@app.post("/claims/claim_order")
async def claim_order(
    claimed_order: ClaimOrder, 
    db: Session = Depends(get_db),
    user_information: None = Depends(cookie_verification_user_only),
):
    try:
        existing_claim = db.query(Claim).filter(
            Claim.order_id == claimed_order.order_id,
            Claim.claimant_user_id == user_information.user_id
        ).first()

        if existing_claim:
            raise HTTPException(status_code=409, detail="You have already claimed this order")

        add_claim_to_db(db, claimed_order, user_information)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error claiming order: {str(e)}")

@app.patch("/claims/{claim_id}/quantity")
async def update_claim_quantity(
    claim_id: str,
    quantity_update: ClaimQuantityUpdate,
    db: Session = Depends(get_db),
    user_information: None = Depends(cookie_verification_user_only),
):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if claim.claimant_user_id != user_information.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this claim")

    if claim.status not in ("pending", "in_progress"):
        raise HTTPException(status_code=400, detail="Can only adjust quantity while claim is pending or in_progress")

    if quantity_update.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

    order = claim.order
    # Available = total - claimed by others (exclude this claim's current quantity)
    other_claimed = sum(c.quantity for c in order.claims if c.id != claim.id)
    available = order.quantity - other_claimed

    if quantity_update.quantity > available:
        raise HTTPException(
            status_code=400,
            detail=f"Only {available} items available (order has {order.quantity}, {other_claimed} claimed by others)"
        )

    claim.quantity = quantity_update.quantity
    claim.updated_at = datetime.utcnow()
    db.commit()

    return {"message": "Claim quantity updated", "claim_id": claim_id, "new_quantity": quantity_update.quantity}


DISPUTE_RESPONSE_DAYS = 7
DISPUTE_BUYER_REVIEW_DAYS = 7


def check_and_auto_resolve(dispute: Dispute, db: Session):
    """Lazy timer check: auto-resolve disputes when deadlines pass."""
    now = datetime.utcnow()
    if dispute.status == "resolved":
        return

    claim = dispute.claim
    order = claim.order

    if dispute.status == "open" and dispute.fulfiller_deadline < now:
        # Fulfiller didn't respond — buyer wins (rejected)
        dispute.status = "resolved"
        dispute.resolution = "rejected"
        dispute.resolved_by = "auto"
        dispute.resolved_at = now

        disbursement = db.query(Disbursement).filter(
            Disbursement.claim_id == claim.id, Disbursement.status == "held"
        ).first()
        if disbursement:
            disbursement.status = "cancelled"

        previous_status = claim.status
        claim.status = "resolved_rejected"
        db.add(ClaimStatusHistory(
            claim_id=claim.id,
            previous_status=previous_status,
            new_status="resolved_rejected",
            changed_by="system",
        ))
        db.commit()

    elif dispute.status == "responded" and dispute.buyer_deadline and dispute.buyer_deadline < now:
        # Buyer didn't act — fulfiller wins (accepted)
        dispute.status = "resolved"
        dispute.resolution = "accepted"
        dispute.resolved_by = "auto"
        dispute.resolved_at = now

        disbursement = db.query(Disbursement).filter(
            Disbursement.claim_id == claim.id, Disbursement.status == "held"
        ).first()
        if disbursement:
            disbursement.status = "pending"

        previous_status = claim.status
        claim.status = "resolved_accepted"
        db.add(ClaimStatusHistory(
            claim_id=claim.id,
            previous_status=previous_status,
            new_status="resolved_accepted",
            changed_by="system",
        ))
        db.commit()


ALLOWED_STATUS_TRANSITIONS = {
    "pending": ["in_progress", "cancelled"],
    "in_progress": ["printing", "cancelled"],
    "printing": ["qa_check"],
    "qa_check": ["shipped"],
    "shipped": ["delivered"],
    "delivered": ["accepted", "disputed"],
}


@app.patch("/claims/{claim_id}/status")
async def update_claim_status(
    claim_id: str,
    status_update: ClaimStatusUpdate,
    db: Session = Depends(get_db),
    user_information: None = Depends(cookie_verification_user_only),
):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    order = claim.order

    # Authorization split: delivered -> accepted/disputed requires the ORDER OWNER (buyer)
    if claim.status == "delivered":
        if order.user_id != user_information.user_id:
            raise HTTPException(status_code=403, detail="Only the buyer can accept or dispute a delivered claim")
    else:
        if claim.claimant_user_id != user_information.user_id:
            raise HTTPException(status_code=403, detail="Not authorized to update this claim")

    allowed = ALLOWED_STATUS_TRANSITIONS.get(claim.status, [])
    if status_update.status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from '{claim.status}' to '{status_update.status}'. Allowed: {allowed}"
        )

    # QA gate: high-QA orders require evidence before shipping
    if claim.status == "qa_check" and status_update.status == "shipped":
        if order.qa_level == "high":
            evidence_count = db.query(ClaimEvidence).filter(
                ClaimEvidence.claim_id == claim.id,
                ClaimEvidence.status_at_upload == "qa_check"
            ).count()
            if evidence_count == 0:
                raise HTTPException(
                    status_code=400,
                    detail="High-QA orders require at least one evidence photo during QA check before shipping"
                )

    previous_status = claim.status

    # Dispute requires reason
    if status_update.status == "disputed" and not status_update.reason:
        raise HTTPException(status_code=400, detail="Reason is required when disputing a claim")

    claim.status = status_update.status
    db.commit()

    # Record status change in history
    history = ClaimStatusHistory(
        claim_id=claim.id,
        previous_status=previous_status,
        new_status=status_update.status,
        changed_by=user_information.user_id,
    )
    db.add(history)
    db.commit()

    # Disbursement triggers on "accepted" (not "completed")
    if status_update.status == "accepted":
        amount_cents = round(order.price * claim.quantity / order.quantity * 100)
        disbursement = Disbursement(
            claim_id=claim.id,
            user_id=claim.claimant_user_id,
            amount_cents=amount_cents,
            status="pending",
        )
        db.add(disbursement)
        db.commit()

    # Dispute flow: create held escrow + dispute record
    if status_update.status == "disputed":
        amount_cents = round(order.price * claim.quantity / order.quantity * 100)
        disbursement = Disbursement(
            claim_id=claim.id,
            user_id=claim.claimant_user_id,
            amount_cents=amount_cents,
            status="held",
        )
        db.add(disbursement)

        dispute = Dispute(
            claim_id=claim.id,
            opened_by=user_information.user_id,
            reason=status_update.reason,
            status="open",
            fulfiller_deadline=datetime.utcnow() + timedelta(days=DISPUTE_RESPONSE_DAYS),
        )
        db.add(dispute)
        db.commit()

    return {"message": "Claim status updated", "claim_id": claim_id, "new_status": status_update.status}


@app.post("/claims/{claim_id}/evidence")
async def upload_claim_evidence(
    claim_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    user_information: None = Depends(cookie_verification_user_only),
):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if claim.claimant_user_id != user_information.user_id:
        raise HTTPException(status_code=403, detail="Only the fulfiller can upload evidence")

    image_data = payload.get("image_data")
    if not image_data:
        raise HTTPException(status_code=400, detail="Missing image_data")

    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"evidence_{file_id}.jpg"
    file_bytes = base64.b64decode(image_data)
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    evidence = ClaimEvidence(
        claim_id=claim_id,
        file_path=str(file_path),
        status_at_upload=claim.status,
        description=payload.get("description"),
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    return {
        "id": evidence.id,
        "claim_id": evidence.claim_id,
        "file_path": evidence.file_path,
        "status_at_upload": evidence.status_at_upload,
        "description": evidence.description,
    }


@app.get("/claims/{claim_id}/evidence")
async def get_claim_evidence(
    claim_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(cookie_verification),
):
    evidence_list = db.query(ClaimEvidence).filter(ClaimEvidence.claim_id == claim_id).all()
    result = []
    for ev in evidence_list:
        ev_data = {
            "id": ev.id,
            "claim_id": ev.claim_id,
            "file_path": ev.file_path,
            "uploaded_at": ev.uploaded_at.isoformat() if ev.uploaded_at else None,
            "status_at_upload": ev.status_at_upload,
            "description": ev.description,
        }
        # Include base64 image data if file exists
        if os.path.exists(ev.file_path):
            with open(ev.file_path, "rb") as f:
                ev_data["image_data"] = base64.b64encode(f.read()).decode("utf-8")
        result.append(ev_data)
    return result


@app.get("/claims/{claim_id}/history")
async def get_claim_history(
    claim_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(cookie_verification),
):
    history = db.query(ClaimStatusHistory).filter(
        ClaimStatusHistory.claim_id == claim_id
    ).order_by(ClaimStatusHistory.changed_at).all()
    return [
        {
            "id": h.id,
            "claim_id": h.claim_id,
            "previous_status": h.previous_status,
            "new_status": h.new_status,
            "changed_by": h.changed_by,
            "changed_at": h.changed_at.isoformat() if h.changed_at else None,
        }
        for h in history
    ]


@app.get("/disbursements/pending/{claim_id}")
async def get_pending_disbursement(
    claim_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_jwt_token),
):
    disbursement = db.query(Disbursement).filter(
        Disbursement.claim_id == claim_id,
        Disbursement.status == "pending"
    ).first()
    if not disbursement:
        raise HTTPException(status_code=404, detail="No pending disbursement found")
    return {
        "id": disbursement.id,
        "claim_id": disbursement.claim_id,
        "user_id": disbursement.user_id,
        "amount_cents": disbursement.amount_cents,
        "status": disbursement.status,
    }


@app.patch("/disbursements/{disbursement_id}/paid")
async def mark_disbursement_paid(
    disbursement_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_jwt_token),
):
    disbursement = db.query(Disbursement).filter(Disbursement.id == disbursement_id).first()
    if not disbursement:
        raise HTTPException(status_code=404, detail="Disbursement not found")

    stripe_transfer_id = payload.get("stripe_transfer_id")
    if not stripe_transfer_id:
        raise HTTPException(status_code=400, detail="Missing stripe_transfer_id")

    disbursement.status = "paid"
    db.commit()

    return {"message": "Disbursement marked as paid", "disbursement_id": disbursement_id}


@app.get("/disputes/{claim_id}", response_model=DisputeResponse)
async def get_dispute(
    claim_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(cookie_verification),
):
    dispute = db.query(Dispute).filter(Dispute.claim_id == claim_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    check_and_auto_resolve(dispute, db)
    return dispute


@app.post("/disputes/{dispute_id}/respond")
async def respond_to_dispute(
    dispute_id: str,
    payload: DisputeFulfillerResponse,
    db: Session = Depends(get_db),
    user_information: None = Depends(cookie_verification_user_only),
):
    dispute = db.query(Dispute).filter(Dispute.id == dispute_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    claim = dispute.claim
    if claim.claimant_user_id != user_information.user_id:
        raise HTTPException(status_code=403, detail="Only the fulfiller can respond to a dispute")

    if dispute.status != "open":
        raise HTTPException(status_code=400, detail="Dispute is not open for response")

    now = datetime.utcnow()
    if dispute.fulfiller_deadline < now:
        check_and_auto_resolve(dispute, db)
        raise HTTPException(status_code=400, detail="Response deadline has passed")

    dispute.fulfiller_response = payload.response_text
    dispute.responded_at = now
    dispute.status = "responded"
    dispute.buyer_deadline = now + timedelta(days=DISPUTE_BUYER_REVIEW_DAYS)
    db.commit()

    return {"message": "Response recorded", "dispute_id": dispute_id, "status": "responded"}


@app.post("/disputes/{dispute_id}/resolve")
async def resolve_dispute(
    dispute_id: str,
    payload: DisputeResolveRequest,
    db: Session = Depends(get_db),
    user_information: None = Depends(cookie_verification_user_only),
):
    dispute = db.query(Dispute).filter(Dispute.id == dispute_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    claim = dispute.claim
    order = claim.order

    if order.user_id != user_information.user_id:
        raise HTTPException(status_code=403, detail="Only the buyer can resolve a dispute")

    if payload.resolution not in ("accepted", "partial", "rejected"):
        raise HTTPException(status_code=400, detail="Resolution must be accepted, partial, or rejected")

    disbursement = db.query(Disbursement).filter(
        Disbursement.claim_id == claim.id, Disbursement.status == "held"
    ).first()

    previous_status = claim.status
    now = datetime.utcnow()

    if payload.resolution == "accepted":
        if disbursement:
            disbursement.status = "pending"
        claim.status = "resolved_accepted"
    elif payload.resolution == "partial":
        if not payload.partial_amount_cents or payload.partial_amount_cents <= 0:
            raise HTTPException(status_code=400, detail="partial_amount_cents is required for partial resolution")
        max_amount = round(order.price * claim.quantity / order.quantity * 100)
        if payload.partial_amount_cents > max_amount:
            raise HTTPException(
                status_code=400,
                detail=f"Partial amount ({payload.partial_amount_cents}) exceeds claim value ({max_amount} cents)"
            )
        if disbursement:
            disbursement.amount_cents = payload.partial_amount_cents
            disbursement.status = "pending"
        claim.status = "resolved_partial"
    elif payload.resolution == "rejected":
        if disbursement:
            disbursement.status = "cancelled"
        claim.status = "resolved_rejected"

    dispute.status = "resolved"
    dispute.resolution = payload.resolution
    dispute.resolution_amount_cents = payload.partial_amount_cents
    dispute.resolved_by = "buyer"
    dispute.resolved_at = now

    db.add(ClaimStatusHistory(
        claim_id=claim.id,
        previous_status=previous_status,
        new_status=claim.status,
        changed_by=user_information.user_id,
    ))
    db.commit()

    return {"message": "Dispute resolved", "dispute_id": dispute_id, "resolution": payload.resolution}


@app.post("/disputes/{dispute_id}/evidence")
async def upload_dispute_evidence(
    dispute_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    user_information: None = Depends(cookie_verification_user_only),
):
    dispute = db.query(Dispute).filter(Dispute.id == dispute_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    claim = dispute.claim
    if claim.claimant_user_id != user_information.user_id:
        raise HTTPException(status_code=403, detail="Only the fulfiller can upload counter-evidence")

    image_data = payload.get("image_data")
    if not image_data:
        raise HTTPException(status_code=400, detail="Missing image_data")

    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"evidence_{file_id}.jpg"
    file_bytes = base64.b64decode(image_data)
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    evidence = ClaimEvidence(
        claim_id=claim.id,
        file_path=str(file_path),
        status_at_upload="disputed",
        description=payload.get("description"),
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    return {
        "id": evidence.id,
        "claim_id": evidence.claim_id,
        "file_path": evidence.file_path,
        "status_at_upload": evidence.status_at_upload,
        "description": evidence.description,
    }


@app.put("/users/{user_id}/fulfiller_address")
async def update_fulfiller_address(
    user_id: str,
    address: FulfillerAddressUpdate,
    db: Session = Depends(get_db),
    user_information=Depends(cookie_verification_user_only),
):
    if user_information.user_id != user_id:
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


@app.get("/users/{user_id}/fulfiller_address")
async def get_fulfiller_address(
    user_id: str,
    payload: dict = Depends(verify_jwt_token),
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


@app.get("/claims/{claim_id}/shipping_context")
async def get_claim_shipping_context(
    claim_id: str,
    payload: dict = Depends(verify_jwt_token),
    db: Session = Depends(get_db),
):
    """Returns claim + order shipping details for label creation (inter-service)."""
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    order = claim.order
    return {
        "claim_id": claim.id,
        "claimant_user_id": claim.claimant_user_id,
        "status": claim.status,
        "order_id": order.order_id,
        "ship_to": {
            "name": order.shipping_name,
            "line1": order.shipping_line1,
            "line2": order.shipping_line2,
            "city": order.shipping_city,
            "postal_code": order.shipping_postal_code,
            "country": order.shipping_country,
        },
    }


@app.patch("/claims/{claim_id}/shipping")
async def update_claim_shipping(
    claim_id: str,
    shipping_data: ClaimShippingUpdate,
    payload: dict = Depends(verify_jwt_token),
    db: Session = Depends(get_db),
):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    claim.tracking_number = shipping_data.tracking_number
    claim.label_url = shipping_data.label_url
    claim.carrier_code = shipping_data.carrier_code
    claim.shipment_id = shipping_data.shipment_id
    db.commit()

    return {"message": "Shipping info updated", "claim_id": claim_id}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

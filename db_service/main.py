import logging
from fastapi import FastAPI, HTTPException, Depends, Cookie, Header, Request, status, Response
from typing import List
from sqlalchemy.orm import Session, joinedload, selectinload
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)
from fitd_schemas.fitd_db_schemas import User, Task, BasketItem, PortID, Base, Order, UserStripeAccount, Claim, Disbursement
from fitd_schemas.fitd_classes import UserHydrationResponse, ClaimWithOrderResponse, OrderResponse
from datetime import datetime
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
    get_property_value_strict,
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
    ShopifyOrder,
    ClaimOrder,
    ClaimStatusUpdate
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
    allow_origins=[FRONTEND_URL, "http://localhost:1234", "http://localhost:369"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/users", response_model=Dict[str, str])
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


# Add a Task
@app.post("/tasks")
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

    # 2️⃣ Tasks (including incomplete + port)
    tasks = db.query(Task).filter(Task.user_id == user_id).all()

    incomplete_task = (
        db.query(Task)
        .filter(Task.user_id == user_id, Task.complete == False)
        .options(joinedload(Task.port))  # Preload the PortID relationship
        .first()
    )
    
       
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
    claimable_orders = db.query(Order).filter(Order.user_id != user_id).all()
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


@app.post("/orders/create_order")
async def create_order(
    shopify_order: ShopifyOrder, 
    payload: dict = Depends(verify_jwt_token), 
    db: Session = Depends(get_db)
):
    if not shopify_order.line_items:
        raise HTTPException(status_code=404, detail="No line items found")

    user_id = get_property_value_strict(shopify_order.line_items[0], "User Id")
    created_orders = []

    for line_item in shopify_order.line_items:
        order = Order(
            shopify_order_id=str(shopify_order.id),
            user_id=get_property_value_strict(line_item, "User Id"),
            task_id=get_property_value_strict(line_item, "Task Id"),
            name=line_item.name,
            material=get_property_value_strict(line_item, "Material"),
            technique=get_property_value_strict(line_item, "Technique"),
            sizing=get_property_value_strict(line_item, "Sizing"),
            colour=get_property_value_strict(line_item, "Colour"),
            selectedFile=get_property_value_strict(line_item, "Selected File"),
            selectedFileType=get_property_value_strict(line_item, "Selected File Type"),
            price=line_item.price,
            quantity=line_item.quantity,
            created_at=datetime.utcnow().isoformat(),
            is_collaborative=False,
            status=shopify_order.order_status
        )
        created_orders.append(order)
        db.add(order)
    db.query(BasketItem).filter(BasketItem.user_id == user_id).delete()
    db.commit()
    return {"status": "success", "order_count": len(created_orders)}


@app.post("/orders/update_order")
async def update_order(
    shopify_order: ShopifyOrder, 
    payload: dict = Depends(verify_jwt_token), 
    db: Session = Depends(get_db)
):
    try:
        order_id = shopify_order.id
        new_status = shopify_order.order_status
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

ALLOWED_STATUS_TRANSITIONS = {
    "pending": ["in_progress"],
    "in_progress": ["printing", "shipped", "completed"],
    "printing": ["shipped"],
    "shipped": ["completed"],
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

    if claim.claimant_user_id != user_information.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this claim")

    allowed = ALLOWED_STATUS_TRANSITIONS.get(claim.status, [])
    if status_update.status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from '{claim.status}' to '{status_update.status}'. Allowed: {allowed}"
        )

    claim.status = status_update.status
    db.commit()

    # If claim is completed, create a disbursement
    if status_update.status == "completed":
        order = claim.order
        amount_cents = int(order.price * claim.quantity / order.quantity * 100)
        disbursement = Disbursement(
            claim_id=claim.id,
            user_id=claim.claimant_user_id,
            amount_cents=amount_cents,
            status="pending",
        )
        db.add(disbursement)
        db.commit()

    return {"message": "Claim status updated", "claim_id": claim_id, "new_status": status_update.status}


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


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

from fastapi import FastAPI, HTTPException, Depends, Cookie, Header, Request, status, Response
from typing import List
from sqlalchemy.orm import Session, joinedload
from fastapi.middleware.cors import CORSMiddleware
from fitd_schemas.fitd_db_schemas import User, Task, BasketItem, PortID, Base, Order, UserStripeAccount, Claim
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
    get_property_value_strict
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
    ClaimOrder
)
import uvicorn
from typing import Optional, Dict
from jwt_auth import verify_jwt_token
import base64
from pathlib import Path
import re

UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Ensure tables are created
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:1234", "http://localhost:369"],
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


# Get User
@app.get("/users/{user_id}")
async def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    authorization: str = Depends(verify_jwt_token),
):

    user = db.query(User).filter(User.user_id == user_id).first()
    tasks = db.query(Task).filter(Task.user_id == user_id).all()
    basket_items = db.query(BasketItem).filter(BasketItem.user_id == user_id).all()
    incomplete_task = (
        db.query(Task)
        .filter(Task.user_id == user_id, Task.complete == False)
        .options(joinedload(Task.port))  # Preload the PortID relationship
        .first()
    )
    orders = db.query(Order).filter(Order.user_id == user_id).all()
    print(orders)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "user": user,
        "tasks": tasks,
        "basket_items": basket_items,
        "incomplete_task": incomplete_task,
        "orders": orders
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
                print(f"Deleted file: {file_path}")

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

    
# @app.post("/tasks/from_basket")
# async def generate_tasks_from_basket_items(
#     request: Request,
#     db: Session = Depends(get_db),
#     user_info: None = Depends(cookie_verification_user_only),
# ):
#     user_id = user_info.user_id
#     basket_items = db.query(BasketItem).filter(BasketItem.user_id == user_info.user_id).all()
#     if not basket_items:
#         raise HTTPException(status_code=400, detail="Basket is empty")

#     created_orders = []
#     for item in basket_items:
#         order = Order(
#             order_id=str(uuid.uuid4()),
#             user_id=user_id,
#             task_id=item.task_id,
#             name=item.name,
#             material=item.material,
#             technique=item.technique,
#             sizing=item.sizing,
#             colour=item.colour,
#             selectedFile=item.selectedFile,
#             selectedFileType=item.selectedFileType,
#             price=item.price,
#             quantity=item.quantity,
#             created_at=datetime.utcnow().isoformat(),
#             is_collaborative=False,
#             status="open"
#         )
#         db.add(order)
#         created_orders.append(order)

#     db.query(BasketItem).filter(BasketItem.user_id == user_id).delete()
#     db.commit()
#     return {"message": f"{len(created_orders)} orders created", "task_ids": [o.order_id for o in created_orders]}

@app.post("/orders/create_order")
async def create_order(
    shopify_order: ShopifyOrder, 
    payload: dict = Depends(verify_jwt_token), 
    db: Session = Depends(get_db)
):
    user_id = get_property_value_strict(shopify_order.line_items[0], "User Id")
    created_orders = []
    if not shopify_order.line_items:
        raise HTTPException(status_code=404, detail="No line items found")
    
    for line_item in shopify_order.line_items:
        order = Order(
            order_id=shopify_order.id,
            user_id=get_property_value_strict(line_item, "User Id"),
            item_id=str(uuid.uuid4()),
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

@app.post("/stripe/confirm_onboarding")
async def confirm_onboarding(
    payload: dict = Depends(verify_jwt_token),
    db:Session = Depends(get_db)
):
    print("hit it")

@app.post("/claims/claim_order")
async def claim_order(
    claimed_order: ClaimOrder, 
    db: Session = Depends(get_db),
    _: None = Depends(cookie_verification),
):
    print(claimed_order)
    print("hitting here")
    # try:
    #     order_id = claimed_order.id
    #     new_status = shopify_order.order_status
    #     orders = db.query(Order).filter(Order.order_id == order_id).all()

    #     if not orders:
    #         raise HTTPException(status_code=404, detail=f"No orders found with ID {order_id}")

    #     for order in orders:
    #         order.status = new_status

    #     db.commit()

    #     return {
    #         "status": "success",
    #         "updated_count": len(orders),
    #         "order_id": order_id,
    #     }

    # except Exception as e:
    #     db.rollback()
    #     raise HTTPException(status_code=500, detail=f"Error updating orders: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

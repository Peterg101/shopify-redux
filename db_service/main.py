from fastapi import FastAPI, HTTPException, Depends, Cookie, Header, Request
from sqlalchemy.orm import Session, joinedload
from fastapi.middleware.cors import CORSMiddleware
from fitd_schemas.fitd_db_schemas import User, Task, BasketItem, PortID, Base, TaskOrder
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
    decode_file,
    mark_meshy_task_complete,
    delete_port_id,
)

from api_calls import session_exists
import os
from fitd_schemas.fitd_classes import(
    UserInformation,
    TaskInformation,
    MeshyTaskStatusResponse,
    BasketItemInformation,
    BasketQuantityUpdate,
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
    allow_origins=["http://localhost:3000", "http://localhost:1234"],
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

    # Step 2: Query the database to get the user by user_id
    user = db.query(User).filter(User.user_id == user_id).first()
    tasks = db.query(Task).filter(Task.user_id == user_id).all()
    basket_items = db.query(BasketItem).filter(BasketItem.user_id == user_id).all()
    incomplete_task = (
        db.query(Task)
        .filter(Task.user_id == user_id, Task.complete == False)
        .options(joinedload(Task.port))  # Preload the PortID relationship
        .first()
    )
    # Step 3: If user not found, raise an exception
    if not user:
        print("user not found")
        raise HTTPException(status_code=404, detail="User not found")

    # Optional: If you want to fetch tasks or other related data, you can do that here.
    # tasks = db.query(Task).filter(Task.user_id == user.id).all()

    # Step 4: Return the user data (you can return the user with additional info like tasks if needed)
    return {
        "user": user,
        "tasks": tasks,
        "basket_items": basket_items,
        "incomplete_task": incomplete_task,
    }  # If you fetched tasks, include that in the return value as well


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
    print(basket_item.price)
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


@app.post("/tasks/from_basket")
async def generate_tasks_from_basket_items(
    request: Request,
    user_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(cookie_verification),
):
    
    basket_items = db.query(BasketItem).filter(BasketItem.user_id == user_id).all()
    if not basket_items:
        raise HTTPException(status_code=400, detail="Basket is empty")

    created_tasks = []

    for item in basket_items:
        task = TaskOrder(
            task_id=str(uuid.uuid4()),
            user_id=user_id,
            task_name=item.name,
            complete=False,
            created_at=datetime.utcnow().isoformat(),
            quantity=item.quantity
        )
        db.add(task)
        created_tasks.append(task)

    db.query(BasketItem).filter(BasketItem.user_id == user_id).delete()
    db.commit()

    return {"message": f"{len(created_tasks)} tasks created", "task_ids": [t.task_id for t in created_tasks]}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

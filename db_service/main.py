from fastapi import FastAPI, HTTPException, Depends, Cookie, Header, Request
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from models import User, Task
from db_setup import Base, engine, get_db
from utils import(
    check_session_token_active,
    check_user_existence,
    add_user_to_db,
    add_task_to_db,
    cookie_verification
)
from api_calls import session_exists
import os
from classes import UserInformation, TaskInformation, MeshyTaskStatusResponse
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
    authorization: str = Depends(verify_jwt_token)
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
    authorization: str = Depends(verify_jwt_token)
):
    print('hitting here')
    # verify_jwt_token(authorization)

    user_exists = check_user_existence(db, task_information.user_id)

    if user_exists:
        task = add_task_to_db(db, task_information)
        return task.__dict__
    return ""


# Get User 
@app.get("/users/{user_id}")
async def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    authorization: str = Depends(verify_jwt_token)
):
    
    # Step 2: Query the database to get the user by user_id
    user = db.query(User).filter(User.user_id == user_id).first()
    tasks = db.query(Task).filter(Task.user_id == user_id).all()
    # Step 3: If user not found, raise an exception
    if not user:
        print("user not found")
        raise HTTPException(status_code=404, detail="User not found")

    # Optional: If you want to fetch tasks or other related data, you can do that here.
    # tasks = db.query(Task).filter(Task.user_id == user.id).all()

    # Step 4: Return the user data (you can return the user with additional info like tasks if needed)
    return {"user": user, "tasks": tasks}  # If you fetched tasks, include that in the return value as well


@app.post("/file_upload")
async def receive_meshy_task(response: MeshyTaskStatusResponse, payload: dict = Depends(verify_jwt_token)):
    print("receiving meshy task")
    if response.obj_file_blob:
        # Decode the Base64 blob
        file_data = base64.b64decode(response.obj_file_blob)
        file_path = UPLOAD_DIR / f"{response.id}.obj"

        # Save the decoded file
        with open(file_path, "wb") as file:
            file.write(file_data)

        return {"message": "File saved successfully.", "file_name": str(file_path), "user": payload}
    return {"message": "No OBJ file blob provided."}


@app.get("/file_storage/{file_id}")
async def get_file_from_storage(
    request: Request,
    file_id: str,
    _: None = Depends(cookie_verification)
):
    print(file_id)
    file_path = os.path.join("uploads", f"{file_id}.obj")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    with open(file_path, "rb") as file:
        file_data = file.read()
        encoded_data = base64.b64encode(file_data).decode("utf-8")
    
    return {"file_id": file_id, "file_data": encoded_data}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

 
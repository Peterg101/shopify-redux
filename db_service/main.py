from fastapi import FastAPI, HTTPException, Depends, Cookie, Header
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from models import User, Task
from db_setup import Base, engine, get_db
from utils import(
    check_session_token_active,
    check_user_existence,
    add_user_to_db,
    add_task_to_db
) 
from classes import UserInformation, TaskInformation
import uvicorn
from typing import Optional, Dict
from jwt_auth import verify_jwt_token
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
    authorization: str = Header(None)
):
    # Validate the JWT token
    verify_jwt_token(authorization)

    # Check if the user already exists
    user_exists = check_user_existence(db, user_information.email)

    # Add the user to the database
    if not user_exists:
        user = add_user_to_db(db, user_information)

    # Return the created user's data
    return {"id": user.id, "username": user.username, "email": user.email}


# Add a Task
@app.post("/tasks")
async def add_task(
    task_information: TaskInformation,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    
    verify_jwt_token(authorization)

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
    authorization: str = Header(None)
):
    payload = verify_jwt_token(authorization)
    print(payload)
    print("SESSION ACTIVE")
    # Step 2: Query the database to get the user by user_id
    user = db.query(User).filter(User.id == user_id).first()
    tasks = db.query(Task).filter(Task.user_id == user_id).all()
    # Step 3: If user not found, raise an exception
    if not user:
        print("user not found")
        raise HTTPException(status_code=404, detail="User not found")

    # Optional: If you want to fetch tasks or other related data, you can do that here.
    # tasks = db.query(Task).filter(Task.user_id == user.id).all()

    # Step 4: Return the user data (you can return the user with additional info like tasks if needed)
    return {"user": user, "tasks": tasks}  # If you fetched tasks, include that in the return value as well


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=369)

 
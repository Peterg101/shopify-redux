from fastapi import FastAPI, HTTPException, Depends, Cookie
from sqlalchemy.orm import Session
from models import User, Task
from db_setup import Base, engine, get_db
from utils import check_session_token_active

import uvicorn
# Ensure tables are created
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI()


# Create a User
@app.post("/users")
def create_user(
    username: str,
    email: str,
    db: Session = Depends(get_db),
    session_token: str = Cookie(default=None)
):
    session_active = check_session_token_active(session_token)

    if not session_active:
        raise HTTPException(status_code=403, detail="Session token is invalid or doesn't exist")
    # Check for duplicate email
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already exists")

    user = User(username=username, email=email)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "username": user.username, "email": user.email}


# Add a Task
@app.post("/tasks")
def add_task(
    user_id: int,
    task_name: str,
    status: str,
    db: Session = Depends(get_db),
    session_token: str = Cookie(default=None)
):
    session_active = check_session_token_active(session_token)

    if not session_active:
        raise HTTPException(status_code=403, detail="Session token is invalid or doesn't exist")
    # Check if user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    task = Task(user_id=user_id, task_name=task_name, status=status)
    db.add(task)
    db.commit()
    db.refresh(task)
    return {
        "id": task.id,
        "user_id": task.user_id,
        "task_name": task.task_name,
        "status": task.status,
        "created_at": task.created_at,
    }


# Get User with Tasks
@app.get("/users/{user_id}")
async def get_user_with_tasks(
    user_id: int,
    db: Session = Depends(get_db),
    session_token: str = Cookie(default=None)
):
    session_active = check_session_token_active(session_token)

    if not session_active:
        raise HTTPException(status_code=403, detail="Session token is invalid or doesn't exist")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "tasks": [{"id": t.id, "name": t.task_name, "status": t.status} for t in user.tasks],
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=369)

 
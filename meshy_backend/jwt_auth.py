from fastapi import HTTPException, Header
import jwt
import datetime
import json

SECRET_KEY = "your-secret-key"  # This should be stored securely (e.g., environment variables)
ALGORITHM = "HS256"  # JWT signing algorithm


def generate_token():
    """
    Generate a JWT token for inter-service communication.
    """
    expiration = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    payload = {
        "sub": "microservice-1",  # Service identity
        "exp": expiration,        # Expiration time
        "iat": datetime.datetime.now(),  # Issued at time
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token


def verify_jwt_token(authorization: str = Header(None)):
    """
    Verify the JWT token from the Authorization header.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=403, detail="Invalid or missing Authorization header")

    # Extract the JWT from the header
    token = authorization.split("Bearer ")[1]
    print(token)
    try:
        # Decode the JWT token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload  # Return the decoded payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=403, detail="Invalid token")


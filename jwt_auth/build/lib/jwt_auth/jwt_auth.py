from fastapi import HTTPException, Header
import jwt
import datetime

SECRET_KEY = "your-secret-key"  # Store securely (e.g., environment variables)
ALGORITHM = "HS256"  # JWT signing algorithm


def generate_token(microservice_id: str):
    """
    Generate a JWT token for inter-service communication.
    """
    now = datetime.datetime.now(datetime.timezone.utc)  # Current UTC time
    expiration = now + datetime.timedelta(hours=1)      # Expiration in 1 hour
    payload = {
        "sub": microservice_id,  # Service identity
        "exp": expiration,        # Expiration time
        "iat": now,               # Issued at time
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

    try:
        # Decode the JWT token (PyJWT automatically validates `exp` and `iat`)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=403, detail="Invalid token")

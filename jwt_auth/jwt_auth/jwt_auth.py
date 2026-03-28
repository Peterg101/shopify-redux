import os
from fastapi import HTTPException, Header
import jwt
import datetime

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY environment variable is not set. "
        "Set it in your .env file or start-dev.sh before starting any service."
    )
ALGORITHM = "HS256"  # JWT signing algorithm


def generate_token(microservice_id: str, audience: str = None):
    """
    Generate a JWT token for inter-service communication.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    expiration = now + datetime.timedelta(minutes=5)
    payload = {
        "sub": microservice_id,
        "iss": microservice_id,
        "exp": expiration,
        "iat": now,
    }
    if audience:
        payload["aud"] = audience
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token


def verify_jwt_token(authorization: str = Header(None)):
    """
    Verify the JWT token from the Authorization header.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=403, detail="Invalid or missing Authorization header"
        )

    token = authorization.split("Bearer ")[1]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_aud": False})
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=403, detail="Invalid token")

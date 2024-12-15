import pytest
from fastapi import HTTPException
import jwt
import datetime
from jwt_auth.jwt_auth import generate_token, verify_jwt_token

SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
MICROSERVICE_ID = "test-microservice"

# Parameterized test for generate_token
@pytest.mark.parametrize(
    "microservice_id, expiration_duration, expected_sub",
    [
        ("service-1", datetime.timedelta(hours=1), "service-1"),
        ("service-2", datetime.timedelta(minutes=30), "service-2"),
    ]
)
def test_generate_token(microservice_id, expiration_duration, expected_sub):
    token = generate_token(
        microservice_id=microservice_id
    )

    # Decode token to verify its content
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert payload["sub"] == expected_sub
    assert "exp" in payload
    assert "iat" in payload

    # Ensure the expiration time is correct
    exp_time = datetime.datetime.fromtimestamp(payload["exp"], datetime.timezone.utc)
    now = datetime.datetime.now(datetime.timezone.utc)
    assert exp_time > now


# Parameterized test for verify_jwt_token
@pytest.mark.parametrize(
    "token_data, header_prefix, expected_status",
    [
        (  # Valid token
            {
                "sub": MICROSERVICE_ID,
                "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1),
                "iat": datetime.datetime.now(datetime.timezone.utc),
            },
            "Bearer ",
            200,
        ),
        (  # Expired token
            {
                "sub": MICROSERVICE_ID,
                "exp": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=1),
                "iat": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=2),
            },
            "Bearer ",
            401,
        ),
        (  # Invalid prefix
            {
                "sub": MICROSERVICE_ID,
                "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1),
                "iat": datetime.datetime.now(datetime.timezone.utc),
            },
            "Token ",
            403,
        ),
        (  # Invalid token
            None,  # No token payload
            "Bearer ",
            403,
        ),
    ]
)
def test_verify_jwt_token(token_data, header_prefix, expected_status):
    if token_data:
        token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    else:
        token = "invalid-token"

    auth_header = f"{header_prefix}{token}"

    if expected_status == 200:
        payload = verify_jwt_token(authorization=auth_header)
        assert payload["sub"] == MICROSERVICE_ID
    else:
        with pytest.raises(HTTPException) as exc_info:
            verify_jwt_token(authorization=auth_header)
        assert exc_info.value.status_code == expected_status

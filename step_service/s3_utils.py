"""S3 upload/download helpers for STEP file storage."""
import os
import boto3
from botocore.config import Config


def get_s3_client():
    """Create S3 client — uses MinIO for local dev, AWS S3 for production."""
    endpoint_url = os.getenv("S3_ENDPOINT_URL")  # e.g. http://localhost:9000 for MinIO
    return boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "minioadmin"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "minioadmin"),
        config=Config(signature_version="s3v4"),
        region_name=os.getenv("AWS_REGION", "us-east-1"),
    )


BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "fitd-files")


def upload_file(local_path: str, s3_key: str, content_type: str = "application/octet-stream"):
    """Upload a local file to S3."""
    client = get_s3_client()
    client.upload_file(
        local_path,
        BUCKET_NAME,
        s3_key,
        ExtraArgs={"ContentType": content_type},
    )
    return s3_key


def upload_bytes(data: bytes, s3_key: str, content_type: str = "application/octet-stream"):
    """Upload bytes directly to S3."""
    client = get_s3_client()
    client.put_object(
        Bucket=BUCKET_NAME,
        Key=s3_key,
        Body=data,
        ContentType=content_type,
    )
    return s3_key


def generate_presigned_url(s3_key: str, expiration: int = 3600) -> str:
    """Generate a pre-signed URL for downloading a file from S3."""
    client = get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET_NAME, "Key": s3_key},
        ExpiresIn=expiration,
    )


def ensure_bucket_exists():
    """Create the S3 bucket if it doesn't exist (useful for MinIO local dev)."""
    client = get_s3_client()
    try:
        client.head_bucket(Bucket=BUCKET_NAME)
    except Exception:
        try:
            client.create_bucket(Bucket=BUCKET_NAME)
        except Exception:
            pass  # Bucket might already exist in a race condition

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
    """Generate a pre-signed URL for downloading a file from S3.

    Uses S3_PUBLIC_URL when set so that presigned URLs are reachable from
    the browser (e.g. http://localhost:9000 instead of http://minio:9000).
    """
    public_url = os.getenv("S3_PUBLIC_URL")
    if public_url:
        # Build a client pointing at the public endpoint for URL generation
        public_client = boto3.client(
            "s3",
            endpoint_url=public_url,
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "minioadmin"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "minioadmin"),
            config=Config(signature_version="s3v4"),
            region_name=os.getenv("AWS_REGION", "us-east-1"),
        )
    else:
        public_client = get_s3_client()

    return public_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET_NAME, "Key": s3_key},
        ExpiresIn=expiration,
    )


def find_preview_key_by_task_id(task_id: str) -> str | None:
    """Search S3 for a preview.glb matching the given task_id.

    S3 keys follow the pattern: files/{user_id}/{task_id}/preview.glb
    Uses a paginator to handle >1000 objects and a targeted suffix match.
    """
    client = get_s3_client()
    try:
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=BUCKET_NAME, Prefix="files/"):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                # Match exact path segment: .../task_id/preview.glb
                if key.endswith(f"/{task_id}/preview.glb"):
                    return key
    except Exception:
        pass
    return None


def find_thumbnail_key_by_task_id(task_id: str) -> str | None:
    """Search S3 for a thumbnail.png matching the given task_id.

    S3 keys follow the pattern: files/{user_id}/{task_id}/thumbnail.png
    Uses a paginator to handle >1000 objects and a targeted suffix match.
    """
    client = get_s3_client()
    try:
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=BUCKET_NAME, Prefix="files/"):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                if key.endswith(f"/{task_id}/thumbnail.png"):
                    return key
    except Exception:
        pass
    return None


def find_original_key_by_task_id(task_id: str) -> str | None:
    """Search S3 for an original.step matching the given task_id."""
    client = get_s3_client()
    try:
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=BUCKET_NAME, Prefix="files/"):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                if key.endswith(f"/{task_id}/original.step"):
                    return key
    except Exception:
        pass
    return None


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

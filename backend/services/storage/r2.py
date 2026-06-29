from __future__ import annotations

import re
from pathlib import Path
from typing import BinaryIO

import boto3

from config import settings


SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._-]+")

# Local dev storage dir — used when R2 credentials are not configured
_LOCAL_STORAGE_DIR = Path(__file__).parent.parent.parent / ".local_storage"


def _local_mode() -> bool:
    return not (settings.r2_account_id and settings.r2_access_key_id and settings.r2_secret_access_key)


def get_r2_client():
    endpoint_url = settings.r2_endpoint_url or (
        f"https://{settings.r2_account_id}.r2.cloudflarestorage.com"
    )
    return boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
    )


def sanitize_filename(filename: str) -> str:
    original = Path(filename or "document").name
    stem = SAFE_FILENAME_RE.sub("-", Path(original).stem).strip("-.") or "document"
    suffix = Path(original).suffix.lower()
    return f"{stem}{suffix}"


def build_document_storage_key(workspace_id: str, document_id: str, filename: str) -> str:
    safe_filename = sanitize_filename(filename)
    return f"workspaces/{workspace_id}/documents/{document_id}/{safe_filename}"


def upload_document_file(key: str, fileobj: BinaryIO, content_type: str | None) -> None:
    if _local_mode():
        dest = _LOCAL_STORAGE_DIR / key
        dest.parent.mkdir(parents=True, exist_ok=True)
        fileobj.seek(0)
        dest.write_bytes(fileobj.read())
        return
    client = get_r2_client()
    extra_args = {"ContentType": content_type} if content_type else None
    fileobj.seek(0)
    if extra_args:
        client.upload_fileobj(fileobj, settings.r2_bucket, key, ExtraArgs=extra_args)
    else:
        client.upload_fileobj(fileobj, settings.r2_bucket, key)


def download_document_bytes(key: str) -> bytes:
    if _local_mode():
        return (_LOCAL_STORAGE_DIR / key).read_bytes()
    client = get_r2_client()
    response = client.get_object(Bucket=settings.r2_bucket, Key=key)
    return response["Body"].read()


def delete_document_object(key: str) -> None:
    if _local_mode():
        path = _LOCAL_STORAGE_DIR / key
        if path.exists():
            path.unlink()
        return
    client = get_r2_client()
    client.delete_object(Bucket=settings.r2_bucket, Key=key)


def generate_presigned_url(key: str, expires_in: int = 300) -> str:
    """Generate a short-lived presigned GET URL for an R2 object (default 5 min TTL)."""
    if _local_mode():
        # In dev mode, serve via the backend's local-file endpoint (no R2 needed)
        import urllib.parse
        encoded = urllib.parse.quote(key, safe="")
        return f"{settings.backend_url}/api/documents/dev-file/{encoded}"
    client = get_r2_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.r2_bucket, "Key": key},
        ExpiresIn=expires_in,
    )

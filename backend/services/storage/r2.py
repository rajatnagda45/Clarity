from __future__ import annotations

import re
from pathlib import Path
from typing import BinaryIO

import boto3

from config import settings


SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


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
    client = get_r2_client()
    extra_args = {"ContentType": content_type} if content_type else None
    fileobj.seek(0)
    if extra_args:
        client.upload_fileobj(fileobj, settings.r2_bucket, key, ExtraArgs=extra_args)
    else:
        client.upload_fileobj(fileobj, settings.r2_bucket, key)


def download_document_bytes(key: str) -> bytes:
    client = get_r2_client()
    response = client.get_object(Bucket=settings.r2_bucket, Key=key)
    return response["Body"].read()


def delete_document_object(key: str) -> None:
    client = get_r2_client()
    client.delete_object(Bucket=settings.r2_bucket, Key=key)

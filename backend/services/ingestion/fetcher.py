from __future__ import annotations

from services.storage.r2 import download_document_bytes


def fetch_document_source(r2_key: str) -> bytes:
    return download_document_bytes(r2_key)

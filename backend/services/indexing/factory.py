from __future__ import annotations

from config import settings
from services.indexing.base import IndexProvider
from services.indexing.providers.pinecone_provider import PineconeIndexProvider


def get_index_provider() -> IndexProvider:
    if settings.index_provider == "pinecone":
        return PineconeIndexProvider()
    raise ValueError(f"Unsupported index provider '{settings.index_provider}'.")

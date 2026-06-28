from __future__ import annotations

from config import settings
from services.embeddings.base import EmbeddingProvider
from services.embeddings.providers.openai_provider import OpenAIEmbeddingProvider


def get_embedding_provider() -> EmbeddingProvider:
    if settings.embedding_provider == "openai":
        return OpenAIEmbeddingProvider()
    raise ValueError(f"Unsupported embedding provider '{settings.embedding_provider}'.")

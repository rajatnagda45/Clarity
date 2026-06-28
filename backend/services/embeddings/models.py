from __future__ import annotations

from pydantic import BaseModel, Field


class EmbeddingTarget(BaseModel):
    provider: str
    model: str
    dimension: int = Field(gt=0)
    version: str
    parser_version: str
    chunk_version: str


class EmbeddingRequestItem(BaseModel):
    workspace_id: str
    document_id: str
    chunk_id: str
    chunk_index: int = Field(ge=0)
    checksum: str
    token_count: int = Field(ge=1)
    text: str


class GeneratedEmbedding(BaseModel):
    workspace_id: str
    document_id: str
    chunk_id: str
    chunk_index: int = Field(ge=0)
    embedding_provider: str
    embedding_model: str
    embedding_dimension: int = Field(gt=0)
    embedding_version: str
    parser_version: str
    chunk_version: str
    checksum: str
    token_count: int = Field(ge=1)
    latency_ms: int = Field(ge=0)
    retry_count: int = Field(ge=0)
    estimated_cost_usd: float = Field(ge=0.0)
    vector_preview: list[float] = Field(default_factory=list)
    vector: list[float] | None = None


class EmbeddingBatchResult(BaseModel):
    target: EmbeddingTarget
    embeddings: list[GeneratedEmbedding]
    batch_latency_ms: int = Field(ge=0)

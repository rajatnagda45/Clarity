from __future__ import annotations

from pydantic import BaseModel, Field


class IndexingTarget(BaseModel):
    provider: str
    index_name: str
    namespace: str
    embedding_provider: str
    embedding_model: str
    embedding_dimension: int = Field(gt=0)
    embedding_version: str
    parser_version: str
    chunk_version: str


class IndexVectorRecord(BaseModel):
    workspace_id: str
    document_id: str
    chunk_id: str
    chunk_index: int = Field(ge=0)
    section_title: str | None = None
    clause_number: str | None = None
    page_start: int = Field(ge=1)
    page_end: int = Field(ge=1)
    checksum: str
    vector_id: str
    vector: list[float] = Field(min_length=1)
    embedding_provider: str
    embedding_model: str
    embedding_dimension: int = Field(gt=0)
    embedding_version: str
    parser_version: str
    chunk_version: str

    @property
    def metadata(self) -> dict[str, str | int]:
        return {
            "workspace_id": self.workspace_id,
            "document_id": self.document_id,
            "chunk_id": self.chunk_id,
            "chunk_index": self.chunk_index,
            "parser_version": self.parser_version,
            "chunk_version": self.chunk_version,
            "embedding_version": self.embedding_version,
            "provider": self.embedding_provider,
            "model": self.embedding_model,
            "checksum": self.checksum,
            "section_title": self.section_title or "",
            "clause_number": self.clause_number or "",
            "page_start": self.page_start,
            "page_end": self.page_end,
        }


class IndexBatchResult(BaseModel):
    target: IndexingTarget
    vector_ids: list[str]
    batch_latency_ms: int = Field(ge=0)

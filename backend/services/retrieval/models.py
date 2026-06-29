from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class RetrievalFilters(BaseModel):
    section_title: str | None = Field(default=None, alias="sectionTitle")
    clause_number: str | None = Field(default=None, alias="clauseNumber")
    page_start: int | None = Field(default=None, alias="pageStart", ge=1)
    page_end: int | None = Field(default=None, alias="pageEnd", ge=1)
    chunk_kind: str | None = Field(default=None, alias="chunkKind")

    model_config = {"populate_by_name": True}


class RetrievalRequest(BaseModel):
    query: str = Field(min_length=1)
    document_ids: list[str] = Field(default_factory=list)
    filters: RetrievalFilters | None = None
    limit: int | None = Field(default=None, ge=1, le=20)


class NormalizedQuery(BaseModel):
    raw_query: str = Field(alias="rawQuery")
    normalized_query: str = Field(alias="normalizedQuery")
    tokens: list[str]
    clause_refs: list[str] = Field(alias="clauseRefs")
    quoted_phrases: list[str] = Field(alias="quotedPhrases")

    model_config = {"populate_by_name": True}


class DenseCandidate(BaseModel):
    vector_id: str = Field(alias="vectorId")
    chunk_id: str = Field(alias="chunkId")
    document_id: str = Field(alias="documentId")
    score: float
    rank: int = Field(ge=1)

    model_config = {"populate_by_name": True}


class SparseCandidate(BaseModel):
    chunk_id: str = Field(alias="chunkId")
    document_id: str = Field(alias="documentId")
    score: float
    rank: int = Field(ge=1)

    model_config = {"populate_by_name": True}


class RetrievalEvidence(BaseModel):
    workspace_id: str = Field(alias="workspaceId")
    document_id: str = Field(alias="documentId")
    chunk_id: str = Field(alias="chunkId")
    chunk_index: int = Field(alias="chunkIndex", ge=0)
    text: str
    section_title: str | None = Field(default=None, alias="sectionTitle")
    clause_number: str | None = Field(default=None, alias="clauseNumber")
    page_start: int = Field(alias="pageStart", ge=1)
    page_end: int = Field(alias="pageEnd", ge=1)
    chunk_kind: str = Field(alias="chunkKind")
    cross_references: list[str] = Field(alias="crossReferences")
    vector_score: float | None = Field(default=None, alias="vectorScore")
    bm25_score: float | None = Field(default=None, alias="bm25Score")
    rrf_score: float = Field(alias="rrfScore")
    rerank_score: float | None = Field(default=None, alias="rerankScore")
    final_score: float = Field(alias="finalScore")
    final_rank: int = Field(alias="finalRank", ge=1)
    retrieval_reason: str = Field(alias="retrievalReason")
    retrieval_sources: list[Literal["dense", "sparse", "cross_reference"]] = Field(alias="retrievalSources")
    parser_version: str = Field(alias="parserVersion")
    chunk_version: str = Field(alias="chunkVersion")
    embedding_version: str | None = Field(default=None, alias="embeddingVersion")

    model_config = {"populate_by_name": True}


class RetrievalResponse(BaseModel):
    normalized_query: NormalizedQuery = Field(alias="normalizedQuery")
    retrieval_mode: str = Field(alias="retrievalMode")
    cache_hit: bool = Field(alias="cacheHit")
    results: list[RetrievalEvidence]

    model_config = {"populate_by_name": True}


class RetrievalStageEntry(BaseModel):
    chunk_id: str = Field(alias="chunkId")
    document_id: str = Field(alias="documentId")
    rank: int
    score: float
    reason: str | None = None

    model_config = {"populate_by_name": True}


class RetrievalExplorerResponse(BaseModel):
    normalized_query: NormalizedQuery = Field(alias="normalizedQuery")
    cache_hit: bool = Field(alias="cacheHit")
    dense_candidates: list[RetrievalStageEntry] = Field(alias="denseCandidates")
    sparse_candidates: list[RetrievalStageEntry] = Field(alias="sparseCandidates")
    fused_candidates: list[RetrievalStageEntry] = Field(alias="fusedCandidates")
    results: list[RetrievalEvidence]
    dense_latency_ms: int = Field(alias="denseLatencyMs")
    sparse_latency_ms: int = Field(alias="sparseLatencyMs")
    fusion_latency_ms: int = Field(alias="fusionLatencyMs")
    total_latency_ms: int = Field(alias="totalLatencyMs")

    model_config = {"populate_by_name": True}

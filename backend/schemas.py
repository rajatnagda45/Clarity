from typing import Literal
from pydantic import BaseModel, Field


class SpanRef(BaseModel):
    chunk_id: str
    document_id: str
    page: int
    char_start: int
    char_end: int
    text: str
    rerank_score: float = Field(ge=0.0, le=1.0)


class BoundingBox(BaseModel):
    """Pixel-accurate quad from PyMuPDF page.search_for(), for canvas overlay."""
    page: int
    x0: float
    y0: float
    x1: float
    y1: float


class Claim(BaseModel):
    id: str
    text: str
    span_ids: list[str]
    supported: bool = False        # true only if Critic AND NLI entailment agree
    uncertain: bool = False
    entailment_label: Literal["entail", "neutral", "contradict"] | None = None
    entailment_score: float | None = Field(default=None, ge=0.0, le=1.0)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)  # calibrated


class TrustScore(BaseModel):
    faithfulness: float = Field(ge=0.0, le=1.0)
    relevance: float = Field(ge=0.0, le=1.0)
    overall: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)   # calibrated
    calibrated: bool = True


class Abstention(BaseModel):
    reason: str
    missing_evidence_query: str | None = None


class DebateTurn(BaseModel):
    round: int = Field(ge=0, le=2)
    actor: Literal["writer", "critic"]
    action: Literal["draft", "flag", "revise", "reretrieve", "resolve"]
    claim_id: str | None = None
    note: str | None = None


class Contradiction(BaseModel):
    id: str
    topic: str
    doc_a: str
    span_a: str | None
    value_a: str | None
    doc_b: str
    span_b: str | None
    value_b: str | None
    severity: Literal["minor", "major"]
    note: str | None = None


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    environment: str


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None


class WorkspaceSummary(BaseModel):
    id: str
    name: str
    role: Literal["owner", "editor", "viewer"]
    plan: Literal["free", "pro", "team"]


class MeResponse(BaseModel):
    user_id: str = Field(alias="userId")
    workspaces: list[WorkspaceSummary]

    model_config = {"populate_by_name": True}


class CreateWorkspaceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class CreateWorkspaceResponse(BaseModel):
    id: str
    name: str
    role: Literal["owner"]
    plan: Literal["free", "pro", "team"]


class ClauseSummary(BaseModel):
    id: str
    clause_type: str = Field(alias="clauseType")
    text: str
    page: int
    risk_flag: str = Field(alias="riskFlag")
    rationale: str | None = None
    benchmark_match_id: str | None = Field(default=None, alias="benchmarkMatchId")
    deviation_note: str | None = Field(default=None, alias="deviationNote")
    risk_score: float | None = Field(default=None, alias="riskScore")

    model_config = {"populate_by_name": True}


class DocumentSummary(BaseModel):
    id: str
    filename: str
    status: Literal[
        "uploaded",
        "extracted",
        "normalized",
        "metadata_ready",
        "awaiting_chunking",
        "chunking",
        "chunked",
        "awaiting_embeddings",
        "embedding",
        "embedded",
        "awaiting_index",
        "indexing",
        "indexed",
        "failed",
    ]
    source_type: Literal["pdf", "docx", "url"] = Field(alias="sourceType")
    page_count: int | None = Field(default=None, alias="pageCount")
    created_at: str = Field(alias="createdAt")
    error: str | None = None

    model_config = {"populate_by_name": True}


class DocumentListResponse(BaseModel):
    documents: list[DocumentSummary]


class DocumentDetailResponse(DocumentSummary):
    clauses: list[ClauseSummary]


class ChunkSourceOffset(BaseModel):
    page: int
    block_order: int = Field(alias="blockOrder")
    char_start: int = Field(alias="charStart")
    char_end: int = Field(alias="charEnd")

    model_config = {"populate_by_name": True}


class DocumentChunkSummary(BaseModel):
    chunk_id: str = Field(alias="chunkId")
    chunk_index: int = Field(alias="chunkIndex")
    section_title: str | None = Field(default=None, alias="sectionTitle")
    clause_number: str | None = Field(default=None, alias="clauseNumber")
    page_start: int = Field(alias="pageStart")
    page_end: int = Field(alias="pageEnd")
    source_offsets: list[ChunkSourceOffset] = Field(alias="sourceOffsets")
    token_count: int = Field(alias="tokenCount")
    checksum: str
    parser_version: str = Field(alias="parserVersion")
    chunk_version: str = Field(alias="chunkVersion")
    chunk_kind: str = Field(alias="chunkKind")
    fragment_index: int = Field(alias="fragmentIndex")
    fragment_count: int = Field(alias="fragmentCount")
    cross_references: list[str] = Field(alias="crossReferences")
    text: str

    model_config = {"populate_by_name": True}


class DocumentChunkListResponse(BaseModel):
    document_id: str = Field(alias="documentId")
    chunks: list[DocumentChunkSummary]

    model_config = {"populate_by_name": True}


class DocumentEmbeddingSummary(BaseModel):
    chunk_id: str = Field(alias="chunkId")
    chunk_index: int = Field(alias="chunkIndex")
    status: Literal["current", "stale"] 
    embedding_provider: str = Field(alias="embeddingProvider")
    embedding_model: str = Field(alias="embeddingModel")
    embedding_dimension: int = Field(alias="embeddingDimension")
    embedding_version: str = Field(alias="embeddingVersion")
    parser_version: str = Field(alias="parserVersion")
    chunk_version: str = Field(alias="chunkVersion")
    checksum: str
    token_count: int = Field(alias="tokenCount")
    latency_ms: int | None = Field(default=None, alias="latencyMs")
    retry_count: int = Field(alias="retryCount")
    estimated_cost_usd: float = Field(alias="estimatedCostUsd")
    vector_preview: list[float] = Field(alias="vectorPreview")
    created_at: str = Field(alias="createdAt")

    model_config = {"populate_by_name": True}


class DocumentEmbeddingListResponse(BaseModel):
    document_id: str = Field(alias="documentId")
    current_embedding_provider: str | None = Field(default=None, alias="currentEmbeddingProvider")
    current_embedding_model: str | None = Field(default=None, alias="currentEmbeddingModel")
    current_embedding_dimension: int | None = Field(default=None, alias="currentEmbeddingDimension")
    current_embedding_version: str | None = Field(default=None, alias="currentEmbeddingVersion")
    current_embedding_parser_version: str | None = Field(default=None, alias="currentEmbeddingParserVersion")
    current_embedding_chunk_version: str | None = Field(default=None, alias="currentEmbeddingChunkVersion")
    embeddings: list[DocumentEmbeddingSummary]

    model_config = {"populate_by_name": True}


class EmbeddingMetricsResponse(BaseModel):
    documents_processed: int = Field(alias="documentsProcessed")
    chunks_processed: int = Field(alias="chunksProcessed")
    average_chunks_per_document: float = Field(alias="averageChunksPerDocument")
    average_tokens_per_chunk: float = Field(alias="averageTokensPerChunk")
    average_embedding_latency_ms: float = Field(alias="averageEmbeddingLatencyMs")
    processing_success_rate: float = Field(alias="processingSuccessRate")
    processing_failure_rate: float = Field(alias="processingFailureRate")
    retry_count: int = Field(alias="retryCount")
    average_document_processing_time_ms: float = Field(alias="averageDocumentProcessingTimeMs")
    average_embedding_queue_time_ms: float = Field(alias="averageEmbeddingQueueTimeMs")
    estimated_total_tokens: int = Field(alias="estimatedTotalTokens")
    estimated_total_cost_usd: float = Field(alias="estimatedTotalCostUsd")
    provider_usage_counts: dict[str, int] = Field(alias="providerUsageCounts")
    model_usage_counts: dict[str, int] = Field(alias="modelUsageCounts")

    model_config = {"populate_by_name": True}


class DocumentVectorIndexSummary(BaseModel):
    chunk_id: str = Field(alias="chunkId")
    chunk_index: int = Field(alias="chunkIndex")
    chunk_text: str = Field(alias="chunkText")
    vector_id: str = Field(alias="vectorId")
    namespace: str
    status: Literal["current", "stale"]
    index_provider: str = Field(alias="indexProvider")
    index_name: str = Field(alias="indexName")
    embedding_provider: str = Field(alias="embeddingProvider")
    embedding_model: str = Field(alias="embeddingModel")
    embedding_dimension: int = Field(alias="embeddingDimension")
    embedding_version: str = Field(alias="embeddingVersion")
    parser_version: str = Field(alias="parserVersion")
    chunk_version: str = Field(alias="chunkVersion")
    checksum: str
    section_title: str | None = Field(default=None, alias="sectionTitle")
    clause_number: str | None = Field(default=None, alias="clauseNumber")
    page_start: int = Field(alias="pageStart")
    page_end: int = Field(alias="pageEnd")
    retry_count: int = Field(alias="retryCount")
    latency_ms: int | None = Field(default=None, alias="latencyMs")
    indexed_at: str | None = Field(default=None, alias="indexedAt")

    model_config = {"populate_by_name": True}


class DocumentVectorIndexListResponse(BaseModel):
    document_id: str = Field(alias="documentId")
    current_index_provider: str | None = Field(default=None, alias="currentIndexProvider")
    current_index_name: str | None = Field(default=None, alias="currentIndexName")
    current_index_namespace: str | None = Field(default=None, alias="currentIndexNamespace")
    vectors: list[DocumentVectorIndexSummary]

    model_config = {"populate_by_name": True}


class IndexMetricsResponse(BaseModel):
    vectors_indexed: int = Field(alias="vectorsIndexed")
    average_indexing_latency_ms: float = Field(alias="averageIndexingLatencyMs")
    index_throughput: float = Field(alias="indexThroughput")
    failed_index_operations: int = Field(alias="failedIndexOperations")
    retry_count: int = Field(alias="retryCount")
    namespace_counts: dict[str, int] = Field(alias="namespaceCounts")
    index_size_estimate_bytes: int = Field(alias="indexSizeEstimateBytes")
    synchronization_lag_ms: float = Field(alias="synchronizationLagMs")
    current_embedding_version_coverage: float = Field(alias="currentEmbeddingVersionCoverage")
    indexed_documents: int = Field(alias="indexedDocuments")
    average_document_indexing_time_ms: float = Field(alias="averageDocumentIndexingTimeMs")
    indexed_dimensions: int = Field(alias="indexedDimensions")

    model_config = {"populate_by_name": True}


class DeveloperDashboardDocument(BaseModel):
    id: str
    filename: str
    status: str
    source_type: str = Field(alias="sourceType")
    created_at: str = Field(alias="createdAt")
    error: str | None = None
    embedding_queued_at: str | None = Field(default=None, alias="embeddingQueuedAt")
    embedding_started_at: str | None = Field(default=None, alias="embeddingStartedAt")
    embedding_completed_at: str | None = Field(default=None, alias="embeddingCompletedAt")
    index_queued_at: str | None = Field(default=None, alias="indexQueuedAt")
    index_started_at: str | None = Field(default=None, alias="indexStartedAt")
    index_completed_at: str | None = Field(default=None, alias="indexCompletedAt")

    model_config = {"populate_by_name": True}


class DeveloperDashboardResponse(BaseModel):
    documents: list[DeveloperDashboardDocument]
    status_counts: dict[str, int] = Field(alias="statusCounts")
    failed_jobs: list[DeveloperDashboardDocument] = Field(alias="failedJobs")

    model_config = {"populate_by_name": True}


class ApiErrorResponse(BaseModel):
    error: dict[str, str]

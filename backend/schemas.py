from typing import Literal
from pydantic import BaseModel, Field, model_validator


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
    span_ids: list[str] = Field(alias="spanIds")
    citation_keys: list[str] = Field(default_factory=list, alias="citationKeys")
    section: str | None = None
    verification_pass: int = Field(default=1, alias="verificationPass")
    supported: bool = False        # true only if Critic AND NLI entailment agree
    uncertain: bool = False
    critic_status: Literal["supported", "partial", "unsupported"] | None = Field(default=None, alias="criticStatus")
    critic_note: str | None = Field(default=None, alias="criticNote")
    corrected_text: str | None = Field(default=None, alias="correctedText")
    entailment_label: Literal["entail", "neutral", "contradict"] | None = Field(default=None, alias="entailmentLabel")
    entailment_score: float | None = Field(default=None, ge=0.0, le=1.0, alias="entailmentScore")
    support_probability: float | None = Field(default=None, ge=0.0, le=1.0, alias="supportProbability")
    contradiction_probability: float | None = Field(default=None, ge=0.0, le=1.0, alias="contradictionProbability")
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)  # calibrated

    model_config = {"populate_by_name": True}


class TrustScore(BaseModel):
    faithfulness: float = Field(ge=0.0, le=1.0)
    relevance: float | None = Field(default=None, ge=0.0, le=1.0)
    overall: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)   # calibrated
    calibrated: bool = True
    confidence_band: Literal["low", "medium", "high"] = Field(alias="confidenceBand")

    model_config = {"populate_by_name": True}


class Abstention(BaseModel):
    reason: str
    missing_evidence_query: str | None = Field(default=None, alias="missingEvidenceQuery")
    suggested_follow_up: str | None = Field(default=None, alias="suggestedFollowUp")

    model_config = {"populate_by_name": True}


class DebateTurn(BaseModel):
    round: int = Field(ge=0, le=2)
    actor: Literal["writer", "critic"]
    action: Literal["draft", "flag", "revise", "reretrieve", "resolve"]
    claim_id: str | None = Field(default=None, alias="claimId")
    created_at: str | None = Field(default=None, alias="createdAt")
    note: str | None = None

    model_config = {"populate_by_name": True}


class Contradiction(BaseModel):
    id: str
    topic: str
    doc_a: str = Field(alias="docA")
    span_a: str | None = Field(default=None, alias="spanA")
    value_a: str | None = Field(default=None, alias="valueA")
    doc_b: str = Field(alias="docB")
    span_b: str | None = Field(default=None, alias="spanB")
    value_b: str | None = Field(default=None, alias="valueB")
    severity: Literal["minor", "major"]
    note: str | None = None

    model_config = {"populate_by_name": True}


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
    workspace_id: str = Field(alias="workspaceId")
    document_id: str = Field(alias="documentId")
    clause_type: str = Field(alias="clauseType")
    text: str
    page: int
    risk_flag: str = Field(alias="riskFlag")
    rationale: str | None = None
    benchmark_match_id: str | None = Field(default=None, alias="benchmarkMatchId")
    deviation_note: str | None = Field(default=None, alias="deviationNote")
    risk_score: float | None = Field(default=None, alias="riskScore")
    created_at: str = Field(alias="createdAt")

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


class RetrievalFiltersRequest(BaseModel):
    section_title: str | None = Field(default=None, alias="sectionTitle")
    clause_number: str | None = Field(default=None, alias="clauseNumber")
    page_start: int | None = Field(default=None, alias="pageStart")
    page_end: int | None = Field(default=None, alias="pageEnd")
    chunk_kind: str | None = Field(default=None, alias="chunkKind")

    model_config = {"populate_by_name": True}


class RetrievalSearchRequest(BaseModel):
    query: str = Field(min_length=1)
    document_ids: list[str] = Field(default_factory=list)
    filters: RetrievalFiltersRequest | None = None
    limit: int | None = Field(default=None, ge=1, le=20)

    @model_validator(mode="before")
    @classmethod
    def _normalize_aliases(cls, value: object) -> object:
        if isinstance(value, dict) and "documentIds" in value and "document_ids" not in value:
            value = dict(value)
            value["document_ids"] = value.pop("documentIds")
        return value

    model_config = {"populate_by_name": True}


class RetrievalEvidenceResponse(BaseModel):
    workspace_id: str = Field(alias="workspaceId")
    document_id: str = Field(alias="documentId")
    chunk_id: str = Field(alias="chunkId")
    chunk_index: int = Field(alias="chunkIndex")
    text: str
    section_title: str | None = Field(default=None, alias="sectionTitle")
    clause_number: str | None = Field(default=None, alias="clauseNumber")
    page_start: int = Field(alias="pageStart")
    page_end: int = Field(alias="pageEnd")
    chunk_kind: str = Field(alias="chunkKind")
    cross_references: list[str] = Field(alias="crossReferences")
    vector_score: float | None = Field(default=None, alias="vectorScore")
    bm25_score: float | None = Field(default=None, alias="bm25Score")
    rrf_score: float = Field(alias="rrfScore")
    rerank_score: float | None = Field(default=None, alias="rerankScore")
    final_score: float = Field(alias="finalScore")
    final_rank: int = Field(alias="finalRank")
    retrieval_reason: str = Field(alias="retrievalReason")
    retrieval_sources: list[str] = Field(alias="retrievalSources")
    parser_version: str = Field(alias="parserVersion")
    chunk_version: str = Field(alias="chunkVersion")
    embedding_version: str | None = Field(default=None, alias="embeddingVersion")

    model_config = {"populate_by_name": True}


class RetrievalNormalizedQueryResponse(BaseModel):
    raw_query: str = Field(alias="rawQuery")
    normalized_query: str = Field(alias="normalizedQuery")
    tokens: list[str]
    clause_refs: list[str] = Field(alias="clauseRefs")
    quoted_phrases: list[str] = Field(alias="quotedPhrases")

    model_config = {"populate_by_name": True}


class RetrievalSearchResponse(BaseModel):
    normalized_query: RetrievalNormalizedQueryResponse = Field(alias="normalizedQuery")
    retrieval_mode: str = Field(alias="retrievalMode")
    cache_hit: bool = Field(alias="cacheHit")
    results: list[RetrievalEvidenceResponse]

    model_config = {"populate_by_name": True}


class RetrievalStageEntryResponse(BaseModel):
    chunk_id: str = Field(alias="chunkId")
    document_id: str = Field(alias="documentId")
    rank: int
    score: float
    reason: str | None = None

    model_config = {"populate_by_name": True}


class RetrievalExplorerResponse(BaseModel):
    normalized_query: RetrievalNormalizedQueryResponse = Field(alias="normalizedQuery")
    cache_hit: bool = Field(alias="cacheHit")
    dense_candidates: list[RetrievalStageEntryResponse] = Field(alias="denseCandidates")
    sparse_candidates: list[RetrievalStageEntryResponse] = Field(alias="sparseCandidates")
    fused_candidates: list[RetrievalStageEntryResponse] = Field(alias="fusedCandidates")
    results: list[RetrievalEvidenceResponse]
    dense_latency_ms: int = Field(alias="denseLatencyMs")
    sparse_latency_ms: int = Field(alias="sparseLatencyMs")
    fusion_latency_ms: int = Field(alias="fusionLatencyMs")
    total_latency_ms: int = Field(alias="totalLatencyMs")

    model_config = {"populate_by_name": True}


class RetrievalMetricsResponse(BaseModel):
    retrieval_latency_ms: float = Field(alias="retrievalLatencyMs")
    average_retrieved_chunks: float = Field(alias="averageRetrievedChunks")
    dense_recall: float = Field(alias="denseRecall")
    sparse_recall: float = Field(alias="sparseRecall")
    fusion_latency_ms: float = Field(alias="fusionLatencyMs")
    average_fusion_score: float = Field(alias="averageFusionScore")
    filter_usage: float = Field(alias="filterUsage")
    query_volume: int = Field(alias="queryVolume")
    retrieval_cache_hits: int = Field(alias="retrievalCacheHits")
    retrieval_failures: int = Field(alias="retrievalFailures")

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


class MessageCitation(BaseModel):
    citation_key: str = Field(alias="citationKey")
    document_id: str = Field(alias="documentId")
    chunk_id: str = Field(alias="chunkId")
    section_title: str | None = Field(default=None, alias="sectionTitle")
    clause_number: str | None = Field(default=None, alias="clauseNumber")
    page_start: int = Field(alias="pageStart")
    page_end: int = Field(alias="pageEnd")
    checksum: str | None = None
    source_offsets: list[ChunkSourceOffset] = Field(default_factory=list, alias="sourceOffsets")

    model_config = {"populate_by_name": True}


class DocumentFileResponse(BaseModel):
    document_id: str = Field(alias="documentId")
    filename: str
    signed_url: str = Field(alias="signedUrl")
    expires_in_seconds: int = Field(alias="expiresInSeconds")

    model_config = {"populate_by_name": True}


class ClaimSpanResponse(BaseModel):
    chunk_id: str = Field(alias="chunkId")
    document_id: str = Field(alias="documentId")
    page: int
    char_start: int = Field(alias="charStart")
    char_end: int = Field(alias="charEnd")
    text: str
    rerank_score: float = Field(alias="rerankScore")

    model_config = {"populate_by_name": True}


class ClaimSpanListResponse(BaseModel):
    spans: list[ClaimSpanResponse]


class ConversationSummary(BaseModel):
    id: str
    workspace_id: str = Field(alias="workspaceId")
    title: str | None = None
    created_at: str = Field(alias="createdAt")
    last_message_at: str = Field(alias="lastMessageAt")
    message_count: int = Field(alias="messageCount")

    model_config = {"populate_by_name": True}


class ConversationListResponse(BaseModel):
    conversations: list[ConversationSummary]


class ChatMessage(BaseModel):
    id: str
    workspace_id: str = Field(alias="workspaceId")
    conversation_id: str = Field(alias="conversationId")
    role: Literal["user", "assistant"]
    content: str
    created_at: str = Field(alias="createdAt")
    answer_run_id: str | None = Field(default=None, alias="answerRunId")
    retrieval_run_id: str | None = Field(default=None, alias="retrievalRunId")
    trust: TrustScore | None = None
    abstention: Abstention | None = None
    claims: list[Claim] = Field(default_factory=list)
    debate_turns: list[DebateTurn] = Field(default_factory=list, alias="debateTurns")
    retrieved_evidence: list[RetrievalEvidenceResponse] = Field(default_factory=list, alias="retrievedEvidence")
    citations: list[MessageCitation] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class ConversationDetailResponse(BaseModel):
    conversation: ConversationSummary
    messages: list[ChatMessage]

    model_config = {"populate_by_name": True}


class ChatRequest(BaseModel):
    conversation_id: str | None = None
    query: str = Field(min_length=1)
    document_ids: list[str] = Field(default_factory=list)
    request_id: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _normalize_aliases(cls, value: object) -> object:
        if not isinstance(value, dict):
            return value
        value = dict(value)
        if "conversationId" in value and "conversation_id" not in value:
            value["conversation_id"] = value.pop("conversationId")
        if "documentIds" in value and "document_ids" not in value:
            value["document_ids"] = value.pop("documentIds")
        if "requestId" in value and "request_id" not in value:
            value["request_id"] = value.pop("requestId")
        return value

    model_config = {"populate_by_name": True}


class AnswerMetricsResponse(BaseModel):
    conversations_created: int = Field(alias="conversationsCreated")
    messages_created: int = Field(alias="messagesCreated")
    answer_failures: int = Field(alias="answerFailures")
    answer_latency_ms: float = Field(alias="answerLatencyMs")
    first_token_latency_ms: float = Field(alias="firstTokenLatencyMs")
    streaming_duration_ms: float = Field(alias="streamingDurationMs")
    prompt_tokens: int = Field(alias="promptTokens")
    completion_tokens: int = Field(alias="completionTokens")
    total_tokens: int = Field(alias="totalTokens")
    estimated_cost_usd: float = Field(alias="estimatedCostUsd")
    average_citations_per_answer: float = Field(alias="averageCitationsPerAnswer")
    average_evidence_chunks_per_answer: float = Field(alias="averageEvidenceChunksPerAnswer")

    model_config = {"populate_by_name": True}


class AnswerExplorerRunResponse(BaseModel):
    answer_run_id: str = Field(alias="answerRunId")
    conversation_id: str = Field(alias="conversationId")
    retrieval_run_id: str = Field(alias="retrievalRunId")
    user_message_id: str = Field(alias="userMessageId")
    assistant_message_id: str | None = Field(default=None, alias="assistantMessageId")
    query: str
    normalized_query: str = Field(alias="normalizedQuery")
    provider: str
    model: str
    prompt_version: str = Field(alias="promptVersion")
    writer_version: str = Field(alias="writerVersion")
    status: str
    prompt_tokens: int = Field(alias="promptTokens")
    completion_tokens: int = Field(alias="completionTokens")
    total_tokens: int = Field(alias="totalTokens")
    estimated_cost_usd: float = Field(alias="estimatedCostUsd")
    latency_ms: int | None = Field(default=None, alias="latencyMs")
    first_token_latency_ms: int | None = Field(default=None, alias="firstTokenLatencyMs")
    retry_count: int = Field(alias="retryCount")
    created_at: str = Field(alias="createdAt")
    completed_at: str | None = Field(default=None, alias="completedAt")
    prompt_payload: dict = Field(alias="promptPayload")
    final_answer: str | None = Field(default=None, alias="finalAnswer")
    trust: TrustScore | None = None
    abstention: Abstention | None = None
    claims: list[Claim] = Field(default_factory=list)
    debate_turns: list[DebateTurn] = Field(default_factory=list, alias="debateTurns")
    citations: list[MessageCitation]
    retrieved_evidence: list[RetrievalEvidenceResponse] = Field(alias="retrievedEvidence")
    stream_events: list[dict] = Field(alias="streamEvents")

    model_config = {"populate_by_name": True}


class AnswerExplorerResponse(BaseModel):
    runs: list[AnswerExplorerRunResponse]

    model_config = {"populate_by_name": True}


class ApiErrorResponse(BaseModel):
    error: dict[str, str]


# ─── B3: Evaluation platform schemas ─────────────────────────────────────────

class JudgeScoresResponse(BaseModel):
    faithfulness: int | None = None
    grounding: int | None = None
    completeness: int | None = None
    correctness: int | None = None
    clarity: int | None = None
    citation_quality: int | None = Field(default=None, alias="citationQuality")
    hallucination_risk: int | None = Field(default=None, alias="hallucinationRisk")
    overall: int | None = None
    reasoning: dict | None = None

    model_config = {"populate_by_name": True}


class EvalRunResponse(BaseModel):
    id: str
    workspace_id: str = Field(alias="workspaceId")
    answer_run_id: str | None = Field(default=None, alias="answerRunId")
    judge_provider: str | None = Field(default=None, alias="judgeProvider")
    judge_model: str | None = Field(default=None, alias="judgeModel")
    judge_prompt_version: str | None = Field(default=None, alias="judgePromptVersion")
    judge_latency_ms: int | None = Field(default=None, alias="judgeLatencyMs")
    scores: JudgeScoresResponse | None = None
    created_at: str = Field(alias="createdAt")

    model_config = {"populate_by_name": True}


class EvalRunListResponse(BaseModel):
    evaluations: list[EvalRunResponse]
    total: int


class QualityRollupResponse(BaseModel):
    id: str
    workspace_id: str = Field(alias="workspaceId")
    day: str
    avg_faithfulness: float | None = Field(default=None, alias="avgFaithfulness")
    abstention_rate: float = Field(alias="abstentionRate")
    n: int
    avg_judge_overall: float | None = Field(default=None, alias="avgJudgeOverall")
    avg_hallucination_risk: float | None = Field(default=None, alias="avgHallucinationRisk")
    avg_confidence_score: float | None = Field(default=None, alias="avgConfidenceScore")
    abstention_count: int = Field(alias="abstentionCount")
    verification_pass_count: int = Field(alias="verificationPassCount")
    total_answers: int = Field(alias="totalAnswers")

    model_config = {"populate_by_name": True}


class QualityDashboardResponse(BaseModel):
    rollups: list[QualityRollupResponse]
    days: int


class CreateBenchmarkDatasetRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    dataset_type: Literal["contract_qa", "lease_qa", "policy_qa", "custom"]
    description: str | None = None


class BenchmarkDatasetResponse(BaseModel):
    id: str
    workspace_id: str = Field(alias="workspaceId")
    name: str
    dataset_type: str = Field(alias="datasetType")
    description: str | None = None
    created_at: str = Field(alias="createdAt")

    model_config = {"populate_by_name": True}


class CreateBenchmarkCaseRequest(BaseModel):
    question: str = Field(min_length=1)
    reference_answer: str | None = None
    document_ids: list[str] = Field(default_factory=list)
    expected_citations: dict | None = None


class BenchmarkCaseResponse(BaseModel):
    id: str
    workspace_id: str = Field(alias="workspaceId")
    dataset_id: str = Field(alias="datasetId")
    question: str
    reference_answer: str | None = Field(default=None, alias="referenceAnswer")
    document_ids: list[str] = Field(alias="documentIds")
    created_at: str = Field(alias="createdAt")

    model_config = {"populate_by_name": True}


class BenchmarkRunResponse(BaseModel):
    id: str
    workspace_id: str = Field(alias="workspaceId")
    dataset_id: str = Field(alias="datasetId")
    status: str
    total_cases: int = Field(alias="totalCases")
    completed_cases: int = Field(alias="completedCases")
    failed_cases: int = Field(alias="failedCases")
    avg_judge_overall: float | None = Field(default=None, alias="avgJudgeOverall")
    avg_trust_confidence: float | None = Field(default=None, alias="avgTrustConfidence")
    avg_latency_ms: int | None = Field(default=None, alias="avgLatencyMs")
    created_at: str = Field(alias="createdAt")

    model_config = {"populate_by_name": True}


class RegressionReportResponse(BaseModel):
    id: str
    workspace_id: str = Field(alias="workspaceId")
    current_eval_id: str = Field(alias="currentEvalId")
    window_size: int = Field(alias="windowSize")
    baseline_avg_judge_overall: float | None = Field(default=None, alias="baselineAvgJudgeOverall")
    current_judge_overall: int | None = Field(default=None, alias="currentJudgeOverall")
    judge_overall_delta: float | None = Field(default=None, alias="judgeOverallDelta")
    has_regression: bool = Field(alias="hasRegression")
    regression_flags: list[str] = Field(alias="regressionFlags")
    created_at: str = Field(alias="createdAt")

    model_config = {"populate_by_name": True}


class RegressionListResponse(BaseModel):
    reports: list[RegressionReportResponse]
    total: int

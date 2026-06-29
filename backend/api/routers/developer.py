from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import require_developer, require_workspace_role
from db.client import tenant_query
from schemas import (
    Abstention,
    AnswerExplorerResponse,
    AnswerExplorerRunResponse,
    AnswerMetricsResponse,
    Claim,
    ChunkSourceOffset,
    DebateTurn,
    DeveloperDashboardDocument,
    DeveloperDashboardResponse,
    EmbeddingMetricsResponse,
    IndexMetricsResponse,
    MessageCitation,
    RetrievalExplorerResponse,
    RetrievalMetricsResponse,
    RetrievalEvidenceResponse,
    RetrievalSearchRequest,
    TrustScore,
)
from services.embeddings.metrics import build_embedding_metrics
from services.indexing.metrics import build_index_metrics
from services.retrieval.metrics import build_retrieval_metrics
from services.retrieval.models import RetrievalRequest
from services.retrieval.service import retrieve_evidence


router = APIRouter(prefix="/api/developer", tags=["developer"])


def _error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def _build_answer_metrics(answer_rows: list[dict], message_rows: list[dict], conversation_rows: list[dict]) -> dict:
    completed = [row for row in answer_rows if row.get("status") == "completed"]
    count = len(completed) or 1
    return {
        "conversationsCreated": len(conversation_rows),
        "messagesCreated": len(message_rows),
        "answerFailures": sum(1 for row in answer_rows if row.get("status") == "failed"),
        "answerLatencyMs": sum((row.get("latency_ms") or 0) for row in completed) / count,
        "firstTokenLatencyMs": sum((row.get("first_token_latency_ms") or 0) for row in completed) / count,
        "streamingDurationMs": sum((row.get("latency_ms") or 0) for row in completed) / count,
        "promptTokens": sum((row.get("prompt_tokens") or 0) for row in answer_rows),
        "completionTokens": sum((row.get("completion_tokens") or 0) for row in answer_rows),
        "totalTokens": sum((row.get("total_tokens") or 0) for row in answer_rows),
        "estimatedCostUsd": float(sum(float(row.get("estimated_cost_usd") or 0) for row in answer_rows)),
        "averageCitationsPerAnswer": sum((row.get("citation_count") or 0) for row in completed) / count,
        "averageEvidenceChunksPerAnswer": sum((row.get("evidence_chunk_count") or 0) for row in completed) / count,
    }


def _build_message_citation(row: dict) -> MessageCitation:
    offsets = [
        ChunkSourceOffset(
            page=offset["page"],
            blockOrder=offset["block_order"] if "block_order" in offset else offset["blockOrder"],
            charStart=offset["char_start"] if "char_start" in offset else offset["charStart"],
            charEnd=offset["char_end"] if "char_end" in offset else offset["charEnd"],
        )
        for offset in (row.get("source_offsets") or [])
    ]
    return MessageCitation(
        citationKey=row["citation_key"],
        documentId=str(row["document_id"]),
        chunkId=row["chunk_id"],
        sectionTitle=row.get("section_title"),
        clauseNumber=row.get("clause_number"),
        pageStart=row["page_start"],
        pageEnd=row["page_end"],
        checksum=row.get("checksum"),
        sourceOffsets=offsets,
    )


@router.get("/metrics/embeddings", response_model=EmbeddingMetricsResponse)
async def get_embedding_metrics(
    _: str = Depends(require_developer),
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> EmbeddingMetricsResponse:
    workspace_id, _ = membership
    documents = (
        tenant_query("documents", workspace_id)
        .execute()
    )
    embedding_rows = (
        tenant_query("chunk_embeddings", workspace_id)
        .execute()
    )
    return EmbeddingMetricsResponse(
        **build_embedding_metrics(documents.data or [], embedding_rows.data or [])
    )


@router.get("/metrics/indexing", response_model=IndexMetricsResponse)
async def get_index_metrics(
    _: str = Depends(require_developer),
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> IndexMetricsResponse:
    workspace_id, _ = membership
    documents = tenant_query("documents", workspace_id).execute()
    index_rows = tenant_query("chunk_vector_index_records", workspace_id).execute()
    return IndexMetricsResponse(
        **build_index_metrics(documents.data or [], index_rows.data or [])
    )


@router.get("/metrics/retrieval", response_model=RetrievalMetricsResponse)
async def get_retrieval_metrics(
    _: str = Depends(require_developer),
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> RetrievalMetricsResponse:
    workspace_id, _ = membership
    event_rows = tenant_query("retrieval_events", workspace_id).execute()
    return RetrievalMetricsResponse(
        **build_retrieval_metrics(event_rows.data or [])
    )


@router.get("/metrics/answers", response_model=AnswerMetricsResponse)
async def get_answer_metrics(
    _: str = Depends(require_developer),
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> AnswerMetricsResponse:
    workspace_id, _ = membership
    answer_rows = tenant_query("answer_runs", workspace_id).execute().data or []
    message_rows = tenant_query("messages", workspace_id).execute().data or []
    conversation_rows = tenant_query("conversations", workspace_id).execute().data or []
    return AnswerMetricsResponse(**_build_answer_metrics(answer_rows, message_rows, conversation_rows))


@router.post("/retrieval/explore", response_model=RetrievalExplorerResponse)
async def explore_retrieval(
    payload: RetrievalSearchRequest,
    _: str = Depends(require_developer),
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> RetrievalExplorerResponse:
    workspace_id, _ = membership
    if payload.filters and payload.filters.page_start and payload.filters.page_end:
        if payload.filters.page_start > payload.filters.page_end:
            raise _error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "invalid_page_range",
                "pageStart cannot be greater than pageEnd.",
            )

    request = RetrievalRequest.model_validate(payload.model_dump())
    _, explorer = await retrieve_evidence(request, workspace_id)
    return RetrievalExplorerResponse(**explorer.model_dump(mode="json", by_alias=True))


@router.get("/answers", response_model=AnswerExplorerResponse)
async def get_answer_explorer(
    _: str = Depends(require_developer),
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> AnswerExplorerResponse:
    workspace_id, _ = membership
    answer_rows = (
        tenant_query("answer_runs", workspace_id)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    retrieval_rows = tenant_query("retrieval_runs", workspace_id).execute().data or []
    evidence_rows = tenant_query("retrieval_run_evidence", workspace_id).execute().data or []
    citation_rows = tenant_query("message_citations", workspace_id).execute().data or []
    event_rows = tenant_query("answer_stream_events", workspace_id).execute().data or []
    claim_rows = tenant_query("claims", workspace_id).execute().data or []
    debate_rows = tenant_query("debate_turns", workspace_id).execute().data or []
    abstention_rows = tenant_query("abstentions", workspace_id).execute().data or []

    retrieval_by_id = {str(row["id"]): row for row in retrieval_rows}
    evidence_by_run: dict[str, list[RetrievalEvidenceResponse]] = {}
    for row in evidence_rows:
        evidence_by_run.setdefault(str(row["retrieval_run_id"]), []).append(
            RetrievalEvidenceResponse(
                workspaceId=workspace_id,
                documentId=str(row["document_id"]),
                chunkId=row["chunk_id"],
                chunkIndex=row["chunk_index"],
                text=row["text"],
                sectionTitle=row.get("section_title"),
                clauseNumber=row.get("clause_number"),
                pageStart=row["page_start"],
                pageEnd=row["page_end"],
                chunkKind=row.get("chunk_kind", "clause"),
                crossReferences=row.get("cross_references") or [],
                vectorScore=row.get("vector_score"),
                bm25Score=row.get("bm25_score"),
                rrfScore=row["rrf_score"],
                rerankScore=row.get("final_score"),
                finalScore=row["final_score"],
                finalRank=row["final_rank"],
                retrievalReason=row["retrieval_reason"],
                retrievalSources=row.get("retrieval_sources") or [],
                parserVersion=row["parser_version"],
                chunkVersion=row["chunk_version"],
                embeddingVersion=row.get("embedding_version"),
            )
        )
    citations_by_run: dict[str, list[MessageCitation]] = {}
    for row in citation_rows:
        citations_by_run.setdefault(str(row["answer_run_id"]), []).append(_build_message_citation(row))
    events_by_run: dict[str, list[dict]] = {}
    for row in sorted(event_rows, key=lambda item: (str(item["answer_run_id"]), item["sequence_number"])):
        events_by_run.setdefault(str(row["answer_run_id"]), []).append(row["payload"])
    claims_by_run: dict[str, list[Claim]] = {}
    for row in sorted(claim_rows, key=lambda item: (str(item.get("answer_run_id") or ""), item.get("claim_index", 0))):
        answer_run_id = row.get("answer_run_id")
        if not answer_run_id:
            continue
        claims_by_run.setdefault(str(answer_run_id), []).append(
            Claim(
                id=str(row["id"]),
                text=row["text"],
                span_ids=row.get("span_ids") or [],
                citationKeys=row.get("citation_keys") or [],
                section=row.get("section"),
                verificationPass=row.get("verification_pass", 1),
                supported=row.get("supported", False),
                uncertain=row.get("uncertain", False),
                criticStatus=row.get("critic_status"),
                criticNote=row.get("critic_note"),
                correctedText=row.get("corrected_text"),
                entailmentLabel=row.get("entailment_label"),
                entailmentScore=float(row["entailment_score"]) if row.get("entailment_score") is not None else None,
                supportProbability=float(row["support_probability"]) if row.get("support_probability") is not None else None,
                contradictionProbability=float(row["contradiction_probability"]) if row.get("contradiction_probability") is not None else None,
                confidence=float(row["confidence"]) if row.get("confidence") is not None else None,
            )
        )
    debate_by_message: dict[str, list[DebateTurn]] = {}
    for row in debate_rows:
        debate_by_message.setdefault(str(row["message_id"]), []).append(
            DebateTurn(
                round=row["round"],
                actor=row["actor"],
                action=row["action"],
                claim_id=str(row["claim_id"]) if row.get("claim_id") else None,
                note=row.get("note"),
            )
        )
    abstention_by_message: dict[str, Abstention] = {}
    for row in abstention_rows:
        abstention_by_message[str(row["message_id"])] = Abstention(
            reason=row["reason"],
            missing_evidence_query=row.get("missing_evidence_query"),
            suggestedFollowUp=row.get("suggested_follow_up"),
        )

    runs = []
    for row in answer_rows.data or []:
        retrieval_row = retrieval_by_id.get(str(row["retrieval_run_id"]), {})
        trust = None
        if row.get("trust_confidence") is not None:
            trust = TrustScore(
                faithfulness=float(row.get("trust_faithfulness") or 0.0),
                relevance=float(row["trust_relevance"]) if row.get("trust_relevance") is not None else None,
                overall=float(row.get("trust_overall") or 0.0),
                confidence=float(row.get("trust_confidence") or 0.0),
                calibrated=bool(row.get("trust_calibrated", False)),
                confidenceBand=row.get("confidence_band") or "low",
            )
        runs.append(
            AnswerExplorerRunResponse(
                answerRunId=str(row["id"]),
                conversationId=str(row["conversation_id"]),
                retrievalRunId=str(row["retrieval_run_id"]),
                userMessageId=str(row["user_message_id"]),
                assistantMessageId=(
                    str(row["assistant_message_id"]) if row.get("assistant_message_id") else None
                ),
                query=retrieval_row.get("query", ""),
                normalizedQuery=retrieval_row.get("normalized_query", ""),
                provider=row["provider"],
                model=row["model"],
                promptVersion=row["prompt_version"],
                writerVersion=row["writer_version"],
                status=row["status"],
                promptTokens=row.get("prompt_tokens") or 0,
                completionTokens=row.get("completion_tokens") or 0,
                totalTokens=row.get("total_tokens") or 0,
                estimatedCostUsd=float(row.get("estimated_cost_usd") or 0),
                latencyMs=row.get("latency_ms"),
                firstTokenLatencyMs=row.get("first_token_latency_ms"),
                retryCount=row.get("retry_count") or 0,
                createdAt=row["created_at"],
                completedAt=row.get("completed_at"),
                promptPayload=row.get("prompt_payload") or {},
                finalAnswer=row.get("answer_markdown"),
                trust=trust,
                abstention=abstention_by_message.get(str(row.get("assistant_message_id"))),
                claims=claims_by_run.get(str(row["id"]), []),
                debateTurns=debate_by_message.get(str(row.get("assistant_message_id")), []),
                citations=citations_by_run.get(str(row["id"]), []),
                retrievedEvidence=evidence_by_run.get(str(row["retrieval_run_id"]), []),
                streamEvents=events_by_run.get(str(row["id"]), []),
            )
        )

    return AnswerExplorerResponse(runs=runs)


@router.get("/dashboard", response_model=DeveloperDashboardResponse)
async def get_developer_dashboard(
    _: str = Depends(require_developer),
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> DeveloperDashboardResponse:
    workspace_id, _ = membership
    documents = (
        tenant_query("documents", workspace_id)
        .order("created_at", desc=True)
        .execute()
    )

    dashboard_documents = [
        DeveloperDashboardDocument(
            id=str(row["id"]),
            filename=row["filename"],
            status=row["status"],
            sourceType=row["source_type"],
            createdAt=row["created_at"],
            error=row.get("error"),
            embeddingQueuedAt=row.get("embedding_queued_at"),
            embeddingStartedAt=row.get("embedding_started_at"),
            embeddingCompletedAt=row.get("embedding_completed_at"),
            indexQueuedAt=row.get("index_queued_at"),
            indexStartedAt=row.get("index_started_at"),
            indexCompletedAt=row.get("index_completed_at"),
        )
        for row in documents.data or []
    ]
    status_counts: dict[str, int] = {}
    for row in documents.data or []:
        status_name = row["status"]
        status_counts[status_name] = status_counts.get(status_name, 0) + 1

    return DeveloperDashboardResponse(
        documents=dashboard_documents,
        statusCounts=status_counts,
        failedJobs=[document for document in dashboard_documents if document.status == "failed"],
    )

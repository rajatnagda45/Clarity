from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import UTC, datetime
from typing import AsyncGenerator
from uuid import uuid4

from db.client import get_client, tenant_query
from services.answer_generation.models import EvidenceBlock, PreparedAnswerStream, WriterOutput
from services.answer_generation.prompt_builder import (
    build_history_window,
    build_prompt,
    estimate_token_count,
    serialize_prompt,
)
from services.answer_generation.provider import WriterProviderError, get_writer_provider
from services.retrieval.models import RetrievalRequest
from services.retrieval.service import retrieve_evidence
from services.verification.critic import run_critic, extract_claims
from services.verification.ensemble import run_ensemble_async
from services.verification.confidence import compute_trust
from config import settings

logger = logging.getLogger(__name__)

# Backward-compat aliases — old tests patch these attributes on this module
run_critic_node = run_critic
run_calibrate_node = compute_trust
run_abstain_node = None  # placeholder; old graph node not used in RC2


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _ms(t0: float) -> int:
    return int((time.perf_counter() - t0) * 1000)


def _calculate_cost(prompt_tokens: int, completion_tokens: int) -> float:
    return round(
        (prompt_tokens / 1000) * settings.llm_prompt_cost_per_1k_tokens_usd
        + (completion_tokens / 1000) * settings.llm_completion_cost_per_1k_tokens_usd,
        6,
    )


def _token_batches(text: str) -> list[str]:
    words = text.split()
    batch_size = max(1, settings.answer_stream_token_batch_size)
    chunks: list[str] = []
    for index in range(0, len(words), batch_size):
        chunk_words = words[index : index + batch_size]
        chunks.append(" ".join(chunk_words) + (" " if index + batch_size < len(words) else ""))
    return chunks or [text]


def _get_conversation(workspace_id: str, conversation_id: str) -> dict | None:
    result = tenant_query("conversations", workspace_id).eq("id", conversation_id).limit(1).execute()
    return (result.data or [None])[0]


def _load_recent_messages(workspace_id: str, conversation_id: str) -> list[dict]:
    result = (
        tenant_query("messages", workspace_id)
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .execute()
    )
    return result.data or []


def _load_chunk_offsets(workspace_id: str, chunk_ids: list[str]) -> dict[str, list[dict]]:
    if not chunk_ids:
        return {}
    result = (
        tenant_query("chunks", workspace_id)
        .in_("chunk_id", chunk_ids)
        .select("chunk_id,source_offsets,checksum")
        .execute()
    )
    mapping: dict[str, list[dict]] = {}
    for row in result.data or []:
        mapping[row["chunk_id"]] = row.get("source_offsets") or []
    return mapping


def _load_chunk_checksums(workspace_id: str, chunk_ids: list[str]) -> dict[str, str | None]:
    if not chunk_ids:
        return {}
    result = (
        tenant_query("chunks", workspace_id)
        .in_("chunk_id", chunk_ids)
        .select("chunk_id,checksum")
        .execute()
    )
    return {row["chunk_id"]: row.get("checksum") for row in result.data or []}


async def _build_evidence_blocks(results: list[dict], workspace_id: str) -> list[EvidenceBlock]:
    """Build evidence blocks, loading chunk offsets and checksums in parallel."""
    chunk_ids = [row["chunkId"] for row in results]
    offsets, checksums = await asyncio.gather(
        asyncio.to_thread(_load_chunk_offsets, workspace_id, chunk_ids),
        asyncio.to_thread(_load_chunk_checksums, workspace_id, chunk_ids),
    )
    blocks: list[EvidenceBlock] = []
    for index, row in enumerate(results, start=1):
        blocks.append(
            EvidenceBlock(
                citationKey=f"E{index}",
                documentId=row["documentId"],
                chunkId=row["chunkId"],
                chunkIndex=row["chunkIndex"],
                sectionTitle=row.get("sectionTitle"),
                clauseNumber=row.get("clauseNumber"),
                pageStart=row["pageStart"],
                pageEnd=row["pageEnd"],
                text=row["text"],
                retrievalReason=row["retrievalReason"],
                retrievalSources=row["retrievalSources"],
                checksum=checksums.get(row["chunkId"]),
                sourceOffsets=offsets.get(row["chunkId"], []),
                rerankScore=row.get("rerankScore"),
            )
        )
    return blocks


def _persist_events(workspace_id: str, answer_run_id: str, events: list[dict]) -> None:
    rows = [
        {
            "workspace_id": workspace_id,
            "answer_run_id": answer_run_id,
            "sequence_number": sequence + 1,
            "event_type": event["type"],
            "payload": event,
        }
        for sequence, event in enumerate(events)
    ]
    if rows:
        get_client().table("answer_stream_events").insert(rows).execute()


def _serialize_sse(event: dict, sequence: int) -> str:
    return f"id: {sequence}\ndata: {json.dumps(event)}\n\n"


async def replay_answer_stream(
    workspace_id: str,
    answer_run_id: str,
    *,
    after_sequence: int = 0,
):
    rows = (
        tenant_query("answer_stream_events", workspace_id)
        .eq("answer_run_id", answer_run_id)
        .gt("sequence_number", after_sequence)
        .order("sequence_number")
        .execute()
    )
    for row in rows.data or []:
        yield _serialize_sse(row["payload"], row["sequence_number"])


def _replay_if_request_exists(workspace_id: str, request_id: str | None) -> PreparedAnswerStream | None:
    if not request_id:
        return None
    result = (
        tenant_query("answer_runs", workspace_id)
        .eq("request_id", request_id)
        .limit(1)
        .execute()
    )
    row = (result.data or [None])[0]
    if not row:
        return None
    events = (
        tenant_query("answer_stream_events", workspace_id)
        .eq("answer_run_id", row["id"])
        .order("sequence_number")
        .execute()
    )
    payloads = [event["payload"] for event in events.data or []]
    return PreparedAnswerStream(
        conversation_id=str(row["conversation_id"]),
        user_message_id=str(row["user_message_id"]),
        assistant_message_id=str(row["assistant_message_id"]) if row.get("assistant_message_id") else None,
        retrieval_run_id=str(row["retrieval_run_id"]),
        answer_run_id=str(row["id"]),
        events=payloads,
    )


def _citation_event(block: EvidenceBlock) -> dict:
    return {
        "type": "citation",
        "citation": {
            "citationKey": block.citation_key,
            "documentId": block.document_id,
            "chunkId": block.chunk_id,
            "sectionTitle": block.section_title,
            "clauseNumber": block.clause_number,
            "pageStart": block.page_start,
            "pageEnd": block.page_end,
            "checksum": block.checksum,
            "sourceOffsets": block.source_offsets,
        },
    }


def _message_event(
    assistant_message_id: str,
    workspace_id: str,
    conversation_id: str,
    answer_text: str,
    completed_at: datetime,
    answer_run_id: str,
    retrieval_run_id: str,
    citations: list[EvidenceBlock],
) -> dict:
    return {
        "type": "message",
        "message": {
            "id": assistant_message_id,
            "workspaceId": workspace_id,
            "conversationId": conversation_id,
            "role": "assistant",
            "content": answer_text,
            "createdAt": completed_at.isoformat(),
            "answerRunId": answer_run_id,
            "retrievalRunId": retrieval_run_id,
            "citations": [
                {
                    "citationKey": block.citation_key,
                    "documentId": block.document_id,
                    "chunkId": block.chunk_id,
                    "sectionTitle": block.section_title,
                    "clauseNumber": block.clause_number,
                    "pageStart": block.page_start,
                    "pageEnd": block.page_end,
                    "checksum": block.checksum,
                    "sourceOffsets": block.source_offsets,
                }
                for block in citations
            ],
        },
    }


async def build_answer_stream(
    *,
    workspace_id: str,
    query: str,
    conversation_id: str | None,
    document_ids: list[str],
    request_id: str | None,
) -> PreparedAnswerStream:
    replay = _replay_if_request_exists(workspace_id, request_id)
    if replay is not None:
        return replay

    conversation = _get_conversation(workspace_id, conversation_id) if conversation_id else None
    if conversation is None:
        conversation_id = str(uuid4())
        get_client().table("conversations").insert(
            {
                "id": conversation_id,
                "workspace_id": workspace_id,
                "title": query[:120],
                "created_at": _now_iso(),
                "last_message_at": _now_iso(),
            }
        ).execute()
    else:
        conversation_id = str(conversation["id"])

    user_message_id = str(uuid4())
    get_client().table("messages").insert(
        {
            "id": user_message_id,
            "workspace_id": workspace_id,
            "conversation_id": conversation_id,
            "role": "user",
            "content": query,
            "created_at": _now_iso(),
        }
    ).execute()

    history_rows = _load_recent_messages(workspace_id, conversation_id)
    retrieval_response, _ = await retrieve_evidence(
        RetrievalRequest(query=query, document_ids=document_ids),
        workspace_id,
    )
    retrieval_results = retrieval_response.model_dump(mode="json", by_alias=True)["results"]
    evidence_blocks = await _build_evidence_blocks(retrieval_results, workspace_id)

    retrieval_run_id = str(uuid4())
    get_client().table("retrieval_runs").insert(
        {
            "id": retrieval_run_id,
            "workspace_id": workspace_id,
            "conversation_id": conversation_id,
            "user_message_id": user_message_id,
            "query": query,
            "normalized_query": retrieval_response.normalized_query.normalized_query,
            "retrieval_mode": retrieval_response.retrieval_mode,
            "cache_hit": retrieval_response.cache_hit,
            "result_count": len(evidence_blocks),
            "document_ids": document_ids,
            "created_at": _now_iso(),
        }
    ).execute()

    evidence_rows = [
        {
            "workspace_id": workspace_id,
            "retrieval_run_id": retrieval_run_id,
            "citation_key": block.citation_key,
            "document_id": block.document_id,
            "chunk_id": block.chunk_id,
            "chunk_index": block.chunk_index,
            "text": block.text,
            "section_title": block.section_title,
            "clause_number": block.clause_number,
            "page_start": block.page_start,
            "page_end": block.page_end,
            "chunk_kind": retrieval_results[index]["chunkKind"],
            "cross_references": retrieval_results[index]["crossReferences"],
            "retrieval_reason": block.retrieval_reason,
            "retrieval_sources": block.retrieval_sources,
            "vector_score": retrieval_results[index]["vectorScore"],
            "bm25_score": retrieval_results[index]["bm25Score"],
            "rrf_score": retrieval_results[index]["rrfScore"],
            "final_score": retrieval_results[index]["finalScore"],
            "final_rank": retrieval_results[index]["finalRank"],
            "parser_version": retrieval_results[index]["parserVersion"],
            "chunk_version": retrieval_results[index]["chunkVersion"],
            "embedding_version": retrieval_results[index]["embeddingVersion"],
        }
        for index, block in enumerate(evidence_blocks)
    ]
    if evidence_rows:
        get_client().table("retrieval_run_evidence").insert(evidence_rows).execute()

    prompt = build_prompt(
        query=query,
        evidence=evidence_blocks,
        history=build_history_window(history_rows[:-1]),
        prompt_version=settings.writer_prompt_version,
    )
    prompt_payload = prompt.model_dump(mode="json", by_alias=True)
    started_at = datetime.now(UTC)
    provider = get_writer_provider()

    try:
        writer_result = await provider.generate(prompt)
    except WriterProviderError as exc:
        answer_run_id = str(uuid4())
        get_client().table("answer_runs").insert(
            {
                "id": answer_run_id,
                "workspace_id": workspace_id,
                "conversation_id": conversation_id,
                "user_message_id": user_message_id,
                "retrieval_run_id": retrieval_run_id,
                "request_id": request_id,
                "provider": "openai",
                "model": settings.llm_model,
                "prompt_version": settings.writer_prompt_version,
                "writer_version": settings.writer_version,
                "status": "failed",
                "prompt_payload": prompt_payload,
                "error_code": "writer_failed",
                "error_message": str(exc),
                "retry_count": 0,
                "created_at": _now_iso(),
                "completed_at": _now_iso(),
            }
        ).execute()
        events = [
            {
                "type": "meta",
                "conversationId": conversation_id,
                "userMessageId": user_message_id,
                "retrievalRunId": retrieval_run_id,
                "answerRunId": answer_run_id,
            },
            {"type": "error", "code": "writer_failed", "message": str(exc)},
            {"type": "done"},
        ]
        _persist_events(workspace_id, answer_run_id, events)
        return PreparedAnswerStream(
            conversation_id=conversation_id,
            user_message_id=user_message_id,
            assistant_message_id=None,
            retrieval_run_id=retrieval_run_id,
            answer_run_id=answer_run_id,
            events=events,
        )

    answer_text = writer_result.output.answer_markdown.strip()

    # ---- Two-signal verification pipeline ----
    evidence_span_texts = [block.text for block in evidence_blocks]
    claims = await asyncio.to_thread(extract_claims, answer_text)
    claim_results = []
    debate_turns_data: list[dict] = []
    trust_score = None
    verification_passes = 0

    if claims:
        loop_cap = int(getattr(settings, "critic_max_iterations", 2))
        critic_resp = await asyncio.to_thread(run_critic, claims, evidence_span_texts, loop_iteration=1)
        verification_passes = 1
        for verdict in critic_resp.verdicts:
            if verdict.debate_turn > 0:
                debate_turns_data.append({
                    "turn": verdict.debate_turn,
                    "claim": verdict.claim,
                    "verdict": verdict.verdict,
                    "reasoning": verdict.reasoning,
                })

        if loop_cap >= 2:
            unsupported = [v.claim for v in critic_resp.verdicts if v.verdict == "unsupported"]
            if unsupported:
                critic_resp2 = await asyncio.to_thread(run_critic, unsupported, evidence_span_texts, loop_iteration=2)
                verification_passes = 2
                second_map = {v.claim: v for v in critic_resp2.verdicts}
                updated = []
                for v in critic_resp.verdicts:
                    updated.append(second_map.get(v.claim, v))
                from services.verification.critic import CriticResponse
                critic_resp = CriticResponse(
                    verdicts=updated,
                    overall_confidence=critic_resp2.overall_confidence,
                )
                for verdict in critic_resp2.verdicts:
                    debate_turns_data.append({
                        "turn": verdict.debate_turn,
                        "claim": verdict.claim,
                        "verdict": verdict.verdict,
                        "reasoning": verdict.reasoning,
                    })

        claim_results = await run_ensemble_async(critic_resp, evidence_span_texts)
        rerank_scores_list = [
            block.rerank_score
            for block in evidence_blocks
            if block.rerank_score is not None
        ]
        trust_score = compute_trust(claim_results, rerank_scores_list)

    # ---- End verification ----

    assistant_message_id = str(uuid4())
    answer_run_id = str(uuid4())
    completed_at = datetime.now(UTC)
    latency_ms = int((completed_at - started_at).total_seconds() * 1000)
    prompt_tokens = writer_result.usage.prompt_tokens
    completion_tokens = writer_result.usage.completion_tokens or estimate_token_count(
        answer_text,
        model=settings.llm_model,
    )
    total_tokens = writer_result.usage.total_tokens or (prompt_tokens + completion_tokens)
    citations = [
        block
        for block in evidence_blocks
        if block.citation_key in {citation.citation_key for citation in writer_result.output.citations}
    ]
    if not citations and evidence_blocks:
        citations = evidence_blocks[:1]

    get_client().table("messages").insert(
        {
            "id": assistant_message_id,
            "workspace_id": workspace_id,
            "conversation_id": conversation_id,
            "role": "assistant",
            "content": answer_text,
            "created_at": _now_iso(),
        }
    ).execute()

    get_client().table("answer_runs").insert(
        {
            "id": answer_run_id,
            "workspace_id": workspace_id,
            "conversation_id": conversation_id,
            "user_message_id": user_message_id,
            "retrieval_run_id": retrieval_run_id,
            "assistant_message_id": assistant_message_id,
            "request_id": request_id,
            "provider": writer_result.provider,
            "model": writer_result.model,
            "prompt_version": settings.writer_prompt_version,
            "writer_version": settings.writer_version,
            "status": "completed",
            "answer_markdown": answer_text,
            "answer_text": answer_text,
            "prompt_payload": prompt_payload,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "estimated_cost_usd": _calculate_cost(prompt_tokens, completion_tokens),
            "latency_ms": latency_ms,
            "first_token_latency_ms": None,
            "citation_count": len(citations),
            "evidence_chunk_count": len(evidence_blocks),
            "retry_count": 0,
            "verification_passes": verification_passes,
            "trust_confidence": trust_score.calibrated if trust_score else None,
            "confidence_band": (
                "high" if trust_score and trust_score.calibrated >= 0.80
                else "medium" if trust_score and trust_score.calibrated >= 0.60
                else "low" if trust_score else None
            ),
            "created_at": started_at.isoformat(),
            "completed_at": completed_at.isoformat(),
        }
    ).execute()

    get_client().table("message_citations").insert(
        [
            {
                "workspace_id": workspace_id,
                "message_id": assistant_message_id,
                "answer_run_id": answer_run_id,
                "retrieval_run_id": retrieval_run_id,
                "citation_key": block.citation_key,
                "document_id": block.document_id,
                "chunk_id": block.chunk_id,
                "section_title": block.section_title,
                "clause_number": block.clause_number,
                "page_start": block.page_start,
                "page_end": block.page_end,
                "checksum": block.checksum,
                "source_offsets": block.source_offsets,
            }
            for block in citations
        ]
    ).execute()

    get_client().table("conversations").update(
        {
            "last_message_at": completed_at.isoformat(),
            "title": query[:120],
        }
    ).eq("id", conversation_id).eq("workspace_id", workspace_id).execute()

    get_client().table("usage_events").insert(
        {
            "workspace_id": workspace_id,
            "kind": "query",
            "input_tokens": prompt_tokens,
            "output_tokens": completion_tokens,
            "latency_ms": latency_ms,
            "created_at": completed_at.isoformat(),
        }
    ).execute()

    tokens = _token_batches(answer_text)
    normalized_payload = retrieval_response.normalized_query.model_dump(mode="json", by_alias=True)
    events: list[dict] = [
        {
            "type": "meta",
            "conversationId": conversation_id,
            "userMessageId": user_message_id,
            "assistantMessageId": assistant_message_id,
            "retrievalRunId": retrieval_run_id,
            "answerRunId": answer_run_id,
        },
        {"type": "graph_node", "node": "retriever", "status": "started"},
        {
            "type": "graph_node",
            "node": "retriever",
            "status": "finished",
            "summary": f"{len(evidence_blocks)} evidence chunk(s)",
        },
        {
            "type": "retrieval",
            "normalizedQuery": normalized_payload,
            "resultCount": len(evidence_blocks),
        },
        {"type": "graph_node", "node": "writer", "status": "started"},
    ]
    for token in tokens:
        events.append({"type": "token", "text": token})
    events.append({"type": "graph_node", "node": "writer", "status": "finished"})
    for block in citations:
        events.append(_citation_event(block))
    events.append(
        _message_event(
            assistant_message_id,
            workspace_id,
            conversation_id,
            answer_text,
            completed_at,
            answer_run_id,
            retrieval_run_id,
            citations,
        )
    )

    if claim_results:
        try:
            get_client().table("claims").insert([
                {
                    "workspace_id": workspace_id,
                    "answer_run_id": answer_run_id,
                    "claim_text": r.claim,
                    "critic_verdict": r.critic_verdict,
                    "nli_label": r.nli_label,
                    "nli_score": r.nli_score,
                    "ensemble_verdict": r.ensemble_verdict,
                    "evidence_spans": r.evidence_spans,
                    "debate_turn": r.debate_turn,
                }
                for r in claim_results
            ]).execute()
        except Exception:
            logger.exception(
                "Failed to persist claims answer_run_id=%s workspace_id=%s",
                answer_run_id,
                workspace_id,
            )
    if debate_turns_data:
        try:
            get_client().table("debate_turns").insert([
                {
                    "workspace_id": workspace_id,
                    "answer_run_id": answer_run_id,
                    "turn_number": t["turn"],
                    "claim_text": t["claim"],
                    "critic_verdict": t["verdict"],
                    "reasoning": t["reasoning"],
                }
                for t in debate_turns_data
            ]).execute()
        except Exception:
            logger.exception(
                "Failed to persist debate_turns answer_run_id=%s workspace_id=%s",
                answer_run_id,
                workspace_id,
            )
    if trust_score is not None and trust_score.should_abstain:
        try:
            get_client().table("abstentions").insert({
                "workspace_id": workspace_id,
                "answer_run_id": answer_run_id,
                "reason": "Calibrated trust score below threshold",
                "trust_score": trust_score.calibrated,
                "threshold": float(getattr(settings, "abstain_threshold", 0.55)),
            }).execute()
        except Exception:
            logger.exception(
                "Failed to persist abstention answer_run_id=%s workspace_id=%s",
                answer_run_id,
                workspace_id,
            )

    for result in claim_results:
        events.append({
            "type": "claim",
            "claim": result.claim,
            "verdict": result.ensemble_verdict,
            "criticVerdict": result.critic_verdict,
            "nliLabel": result.nli_label,
            "nliScore": result.nli_score,
            "evidenceSpans": result.evidence_spans,
        })
    for turn in debate_turns_data:
        events.append({"type": "debate_turn", **turn})
    if trust_score is not None:
        events.append({
            "type": "trust",
            "raw": trust_score.raw,
            "calibrated": trust_score.calibrated,
            "components": trust_score.components,
        })
        if trust_score.should_abstain:
            events.append({
                "type": "abstention",
                "reason": "Calibrated trust score below threshold",
                "trustScore": trust_score.calibrated,
                "threshold": float(getattr(settings, "abstain_threshold", 0.55)),
            })

    events.append({"type": "done"})
    _persist_events(workspace_id, answer_run_id, events)

    return PreparedAnswerStream(
        conversation_id=conversation_id,
        user_message_id=user_message_id,
        assistant_message_id=assistant_message_id,
        retrieval_run_id=retrieval_run_id,
        answer_run_id=answer_run_id,
        events=events,
    )


async def generate_live_answer_stream(
    *,
    workspace_id: str,
    query: str,
    conversation_id: str | None,
    document_ids: list[str],
    request_id: str | None,
) -> AsyncGenerator[str, None]:
    """
    True-streaming answer generator.

    Yields serialized SSE strings in real-time:
    - meta + retrieval events as soon as retrieval completes
    - token events as the LLM generates (TTFT ~300-700 ms vs 5-12 s for the batch path)
    - verification events after generation finishes (user already sees the answer)
    - done event last; DB persistence happens after done

    Falls back to non-streaming if the writer provider lacks generate_streaming.
    """
    from services.answer_generation.provider import _MarkdownStreamExtractor

    t_total = time.perf_counter()
    sequence = 0
    emitted_events: list[dict] = []

    def _emit(event: dict) -> str:
        nonlocal sequence
        sequence += 1
        emitted_events.append(event)
        return _serialize_sse(event, sequence)

    stage_timings: dict[str, int] = {}

    # ---- Check idempotency (replay) ----
    replay = _replay_if_request_exists(workspace_id, request_id)
    if replay is not None:
        for event in replay.events:
            yield _emit(event)
        return

    # ---- Create conversation + user message ----
    conversation = _get_conversation(workspace_id, conversation_id) if conversation_id else None
    if conversation is None:
        conversation_id = str(uuid4())
        get_client().table("conversations").insert(
            {
                "id": conversation_id,
                "workspace_id": workspace_id,
                "title": query[:120],
                "created_at": _now_iso(),
                "last_message_at": _now_iso(),
            }
        ).execute()
    else:
        conversation_id = str(conversation["id"])

    user_message_id = str(uuid4())
    get_client().table("messages").insert(
        {
            "id": user_message_id,
            "workspace_id": workspace_id,
            "conversation_id": conversation_id,
            "role": "user",
            "content": query,
            "created_at": _now_iso(),
        }
    ).execute()

    # ---- Parallel: history load + retrieval ----
    t0 = time.perf_counter()
    history_rows, (retrieval_response, _) = await asyncio.gather(
        asyncio.to_thread(_load_recent_messages, workspace_id, conversation_id),
        retrieve_evidence(RetrievalRequest(query=query, document_ids=document_ids), workspace_id),
    )
    stage_timings["retrieval_ms"] = _ms(t0)

    retrieval_results = retrieval_response.model_dump(mode="json", by_alias=True)["results"]

    # Parallel chunk metadata queries
    t0 = time.perf_counter()
    evidence_blocks = await _build_evidence_blocks(retrieval_results, workspace_id)
    stage_timings["evidence_build_ms"] = _ms(t0)

    retrieval_run_id = str(uuid4())
    answer_run_id = str(uuid4())
    assistant_message_id = str(uuid4())
    normalized_payload = retrieval_response.normalized_query.model_dump(mode="json", by_alias=True)

    # ---- Emit meta + retrieval events immediately — client gets IDs right away ----
    yield _emit(
        {
            "type": "meta",
            "conversationId": conversation_id,
            "userMessageId": user_message_id,
            "assistantMessageId": assistant_message_id,
            "retrievalRunId": retrieval_run_id,
            "answerRunId": answer_run_id,
        }
    )
    yield _emit({"type": "graph_node", "node": "retriever", "status": "started"})
    yield _emit(
        {
            "type": "graph_node",
            "node": "retriever",
            "status": "finished",
            "summary": f"{len(evidence_blocks)} evidence chunk(s)",
        }
    )
    yield _emit(
        {
            "type": "retrieval",
            "normalizedQuery": normalized_payload,
            "resultCount": len(evidence_blocks),
        }
    )
    yield _emit({"type": "graph_node", "node": "writer", "status": "started"})

    # ---- Build prompt ----
    prompt = build_prompt(
        query=query,
        evidence=evidence_blocks,
        history=build_history_window(history_rows[:-1]),
        prompt_version=settings.writer_prompt_version,
    )
    prompt_payload = prompt.model_dump(mode="json", by_alias=True)

    started_at = datetime.now(UTC)
    provider = get_writer_provider()
    first_token_latency_ms: int | None = None
    full_json_buf = ""
    t0 = time.perf_counter()

    # ---- Stream LLM tokens ----
    if hasattr(provider, "generate_streaming"):
        extractor = _MarkdownStreamExtractor()
        try:
            async for fragment in provider.generate_streaming(prompt):
                full_json_buf += fragment
                markdown_chunk = extractor.feed(fragment)
                if markdown_chunk:
                    if first_token_latency_ms is None:
                        first_token_latency_ms = int((time.perf_counter() - t_total) * 1000)
                    for batch in _token_batches(markdown_chunk):
                        yield _emit({"type": "token", "text": batch})
        except Exception as exc:
            logger.exception("Live stream LLM failed workspace_id=%s", workspace_id)
            yield _emit({"type": "error", "code": "writer_failed", "message": str(exc)})
            yield _emit({"type": "done"})
            return

        stage_timings["generation_ms"] = _ms(t0)

        # Parse full JSON response
        try:
            parsed = json.loads(full_json_buf)
            writer_output = WriterOutput.model_validate(parsed)
        except Exception as exc:
            logger.exception("Failed to parse writer JSON workspace_id=%s", workspace_id)
            yield _emit({"type": "error", "code": "writer_parse_failed", "message": str(exc)})
            yield _emit({"type": "done"})
            return

        answer_text = writer_output.answer_markdown.strip()
        prompt_text = serialize_prompt(prompt)
        prompt_tokens = estimate_token_count(prompt_text, model=settings.llm_model)
        completion_tokens = estimate_token_count(answer_text, model=settings.llm_model)
        total_tokens = prompt_tokens + completion_tokens
        writer_provider_name = "openai"
        writer_model = settings.llm_model
        output_citations = writer_output.citations

    else:
        # Non-streaming fallback (e.g. test providers)
        try:
            writer_result = await provider.generate(prompt)
        except WriterProviderError as exc:
            yield _emit({"type": "error", "code": "writer_failed", "message": str(exc)})
            yield _emit({"type": "done"})
            return

        answer_text = writer_result.output.answer_markdown.strip()
        prompt_tokens = writer_result.usage.prompt_tokens
        completion_tokens = writer_result.usage.completion_tokens or estimate_token_count(
            answer_text, model=settings.llm_model
        )
        total_tokens = writer_result.usage.total_tokens or (prompt_tokens + completion_tokens)
        writer_provider_name = writer_result.provider
        writer_model = writer_result.model
        output_citations = writer_result.output.citations

        stage_timings["generation_ms"] = _ms(t0)

        if first_token_latency_ms is None:
            first_token_latency_ms = stage_timings["retrieval_ms"] + stage_timings["generation_ms"]
        for batch in _token_batches(answer_text):
            yield _emit({"type": "token", "text": batch})

    yield _emit({"type": "graph_node", "node": "writer", "status": "finished"})

    # ---- Citations ----
    citations = [
        block
        for block in evidence_blocks
        if block.citation_key in {c.citation_key for c in output_citations}
    ]
    if not citations and evidence_blocks:
        citations = evidence_blocks[:1]

    for block in citations:
        yield _emit(_citation_event(block))

    # ---- Verification (runs after first tokens reach the client) ----
    t0 = time.perf_counter()
    evidence_span_texts = [block.text for block in evidence_blocks]
    claims = await asyncio.to_thread(extract_claims, answer_text)
    claim_results = []
    debate_turns_data: list[dict] = []
    trust_score = None
    verification_passes = 0

    if claims:
        loop_cap = int(getattr(settings, "critic_max_iterations", 2))
        critic_resp = await asyncio.to_thread(run_critic, claims, evidence_span_texts, loop_iteration=1)
        verification_passes = 1
        for verdict in critic_resp.verdicts:
            if verdict.debate_turn > 0:
                debate_turns_data.append({
                    "turn": verdict.debate_turn,
                    "claim": verdict.claim,
                    "verdict": verdict.verdict,
                    "reasoning": verdict.reasoning,
                })

        if loop_cap >= 2:
            unsupported = [v.claim for v in critic_resp.verdicts if v.verdict == "unsupported"]
            if unsupported:
                critic_resp2 = await asyncio.to_thread(
                    run_critic, unsupported, evidence_span_texts, loop_iteration=2
                )
                verification_passes = 2
                second_map = {v.claim: v for v in critic_resp2.verdicts}
                updated = [second_map.get(v.claim, v) for v in critic_resp.verdicts]
                from services.verification.critic import CriticResponse
                critic_resp = CriticResponse(
                    verdicts=updated,
                    overall_confidence=critic_resp2.overall_confidence,
                )
                for verdict in critic_resp2.verdicts:
                    debate_turns_data.append({
                        "turn": verdict.debate_turn,
                        "claim": verdict.claim,
                        "verdict": verdict.verdict,
                        "reasoning": verdict.reasoning,
                    })

        claim_results = await run_ensemble_async(critic_resp, evidence_span_texts)
        rerank_scores_list = [
            block.rerank_score for block in evidence_blocks if block.rerank_score is not None
        ]
        trust_score = compute_trust(claim_results, rerank_scores_list)

    stage_timings["verification_ms"] = _ms(t0)

    # ---- Emit verification events ----
    for result in claim_results:
        yield _emit(
            {
                "type": "claim",
                "claim": result.claim,
                "verdict": result.ensemble_verdict,
                "criticVerdict": result.critic_verdict,
                "nliLabel": result.nli_label,
                "nliScore": result.nli_score,
                "evidenceSpans": result.evidence_spans,
            }
        )
    for turn in debate_turns_data:
        yield _emit({"type": "debate_turn", **turn})
    if trust_score is not None:
        yield _emit(
            {
                "type": "trust",
                "raw": trust_score.raw,
                "calibrated": trust_score.calibrated,
                "components": trust_score.components,
            }
        )
        if trust_score.should_abstain:
            yield _emit(
                {
                    "type": "abstention",
                    "reason": "Calibrated trust score below threshold",
                    "trustScore": trust_score.calibrated,
                    "threshold": float(getattr(settings, "abstain_threshold", 0.55)),
                }
            )

    # ---- Message event ----
    completed_at = datetime.now(UTC)
    latency_ms = int((completed_at - started_at).total_seconds() * 1000)

    yield _emit(
        _message_event(
            assistant_message_id,
            workspace_id,
            conversation_id,
            answer_text,
            completed_at,
            answer_run_id,
            retrieval_run_id,
            citations,
        )
    )

    # ---- Stage timings event (developer console AI timeline) ----
    stage_timings["total_ms"] = _ms(t_total)
    yield _emit(
        {
            "type": "stage_timings",
            "timings": stage_timings,
            "firstTokenMs": first_token_latency_ms,
        }
    )

    yield _emit({"type": "done"})

    # ---- DB persistence (after client receives done) ----
    _persist_answer_to_db(
        workspace_id=workspace_id,
        conversation_id=conversation_id,
        user_message_id=user_message_id,
        assistant_message_id=assistant_message_id,
        answer_run_id=answer_run_id,
        retrieval_run_id=retrieval_run_id,
        query=query,
        answer_text=answer_text,
        document_ids=document_ids,
        retrieval_response=retrieval_response,
        retrieval_results=retrieval_results,
        evidence_blocks=evidence_blocks,
        citations=citations,
        prompt_payload=prompt_payload,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        latency_ms=latency_ms,
        first_token_latency_ms=first_token_latency_ms,
        verification_passes=verification_passes,
        trust_score=trust_score,
        claim_results=claim_results,
        debate_turns_data=debate_turns_data,
        started_at=started_at,
        completed_at=completed_at,
        request_id=request_id,
        writer_provider_name=writer_provider_name,
        writer_model=writer_model,
        emitted_events=emitted_events,
    )


def _persist_answer_to_db(
    *,
    workspace_id: str,
    conversation_id: str,
    user_message_id: str,
    assistant_message_id: str,
    answer_run_id: str,
    retrieval_run_id: str,
    query: str,
    answer_text: str,
    document_ids: list[str],
    retrieval_response,
    retrieval_results: list[dict],
    evidence_blocks: list[EvidenceBlock],
    citations: list[EvidenceBlock],
    prompt_payload: dict,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    latency_ms: int,
    first_token_latency_ms: int | None,
    verification_passes: int,
    trust_score,
    claim_results: list,
    debate_turns_data: list[dict],
    started_at: datetime,
    completed_at: datetime,
    request_id: str | None,
    writer_provider_name: str,
    writer_model: str,
    emitted_events: list[dict],
) -> None:
    try:
        get_client().table("retrieval_runs").insert(
            {
                "id": retrieval_run_id,
                "workspace_id": workspace_id,
                "conversation_id": conversation_id,
                "user_message_id": user_message_id,
                "query": query,
                "normalized_query": retrieval_response.normalized_query.normalized_query,
                "retrieval_mode": retrieval_response.retrieval_mode,
                "cache_hit": retrieval_response.cache_hit,
                "result_count": len(evidence_blocks),
                "document_ids": document_ids,
                "created_at": _now_iso(),
            }
        ).execute()

        evidence_rows = [
            {
                "workspace_id": workspace_id,
                "retrieval_run_id": retrieval_run_id,
                "citation_key": block.citation_key,
                "document_id": block.document_id,
                "chunk_id": block.chunk_id,
                "chunk_index": block.chunk_index,
                "text": block.text,
                "section_title": block.section_title,
                "clause_number": block.clause_number,
                "page_start": block.page_start,
                "page_end": block.page_end,
                "chunk_kind": retrieval_results[i]["chunkKind"],
                "cross_references": retrieval_results[i]["crossReferences"],
                "retrieval_reason": block.retrieval_reason,
                "retrieval_sources": block.retrieval_sources,
                "vector_score": retrieval_results[i]["vectorScore"],
                "bm25_score": retrieval_results[i]["bm25Score"],
                "rrf_score": retrieval_results[i]["rrfScore"],
                "final_score": retrieval_results[i]["finalScore"],
                "final_rank": retrieval_results[i]["finalRank"],
                "parser_version": retrieval_results[i]["parserVersion"],
                "chunk_version": retrieval_results[i]["chunkVersion"],
                "embedding_version": retrieval_results[i]["embeddingVersion"],
            }
            for i, block in enumerate(evidence_blocks)
        ]
        if evidence_rows:
            get_client().table("retrieval_run_evidence").insert(evidence_rows).execute()

        get_client().table("messages").insert(
            {
                "id": assistant_message_id,
                "workspace_id": workspace_id,
                "conversation_id": conversation_id,
                "role": "assistant",
                "content": answer_text,
                "created_at": _now_iso(),
            }
        ).execute()

        get_client().table("answer_runs").insert(
            {
                "id": answer_run_id,
                "workspace_id": workspace_id,
                "conversation_id": conversation_id,
                "user_message_id": user_message_id,
                "retrieval_run_id": retrieval_run_id,
                "assistant_message_id": assistant_message_id,
                "request_id": request_id,
                "provider": writer_provider_name,
                "model": writer_model,
                "prompt_version": settings.writer_prompt_version,
                "writer_version": settings.writer_version,
                "status": "completed",
                "answer_markdown": answer_text,
                "answer_text": answer_text,
                "prompt_payload": prompt_payload,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens,
                "estimated_cost_usd": _calculate_cost(prompt_tokens, completion_tokens),
                "latency_ms": latency_ms,
                "first_token_latency_ms": first_token_latency_ms,
                "citation_count": len(citations),
                "evidence_chunk_count": len(evidence_blocks),
                "retry_count": 0,
                "verification_passes": verification_passes,
                "trust_confidence": trust_score.calibrated if trust_score else None,
                "confidence_band": (
                    "high" if trust_score and trust_score.calibrated >= 0.80
                    else "medium" if trust_score and trust_score.calibrated >= 0.60
                    else "low" if trust_score else None
                ),
                "created_at": started_at.isoformat(),
                "completed_at": completed_at.isoformat(),
            }
        ).execute()

        get_client().table("message_citations").insert(
            [
                {
                    "workspace_id": workspace_id,
                    "message_id": assistant_message_id,
                    "answer_run_id": answer_run_id,
                    "retrieval_run_id": retrieval_run_id,
                    "citation_key": block.citation_key,
                    "document_id": block.document_id,
                    "chunk_id": block.chunk_id,
                    "section_title": block.section_title,
                    "clause_number": block.clause_number,
                    "page_start": block.page_start,
                    "page_end": block.page_end,
                    "checksum": block.checksum,
                    "source_offsets": block.source_offsets,
                }
                for block in citations
            ]
        ).execute()

        get_client().table("conversations").update(
            {
                "last_message_at": completed_at.isoformat(),
                "title": query[:120],
            }
        ).eq("id", conversation_id).eq("workspace_id", workspace_id).execute()

        get_client().table("usage_events").insert(
            {
                "workspace_id": workspace_id,
                "kind": "query",
                "input_tokens": prompt_tokens,
                "output_tokens": completion_tokens,
                "latency_ms": latency_ms,
                "created_at": completed_at.isoformat(),
            }
        ).execute()

        if claim_results:
            get_client().table("claims").insert(
                [
                    {
                        "workspace_id": workspace_id,
                        "answer_run_id": answer_run_id,
                        "claim_text": r.claim,
                        "critic_verdict": r.critic_verdict,
                        "nli_label": r.nli_label,
                        "nli_score": r.nli_score,
                        "ensemble_verdict": r.ensemble_verdict,
                        "evidence_spans": r.evidence_spans,
                        "debate_turn": r.debate_turn,
                    }
                    for r in claim_results
                ]
            ).execute()

        if debate_turns_data:
            get_client().table("debate_turns").insert(
                [
                    {
                        "workspace_id": workspace_id,
                        "answer_run_id": answer_run_id,
                        "turn_number": t["turn"],
                        "claim_text": t["claim"],
                        "critic_verdict": t["verdict"],
                        "reasoning": t["reasoning"],
                    }
                    for t in debate_turns_data
                ]
            ).execute()

        if trust_score is not None and trust_score.should_abstain:
            get_client().table("abstentions").insert(
                {
                    "workspace_id": workspace_id,
                    "answer_run_id": answer_run_id,
                    "reason": "Calibrated trust score below threshold",
                    "trust_score": trust_score.calibrated,
                    "threshold": float(getattr(settings, "abstain_threshold", 0.55)),
                }
            ).execute()

        _persist_events(workspace_id, answer_run_id, emitted_events)

    except Exception:
        logger.exception(
            "Failed to persist answer answer_run_id=%s workspace_id=%s",
            answer_run_id,
            workspace_id,
        )


async def stream_events(events: list[dict]):
    for sequence, event in enumerate(events, start=1):
        yield _serialize_sse(event, sequence)
        await asyncio.sleep(0)

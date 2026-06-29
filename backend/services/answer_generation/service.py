from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from uuid import uuid4

from agents.nodes.abstain import run_abstain_node
from agents.nodes.calibrate import run_calibrate_node
from agents.nodes.critic import run_critic_node
from agents.state import AgentState, DebateTurnEntry, DraftClaim, Span
from db.client import get_client, tenant_query
from services.answer_generation.claim_extractor import extract_claims
from services.answer_generation.models import (
    AbstentionPayload,
    ClaimRecord,
    EvidenceBlock,
    PreparedAnswerStream,
    TrustMetadata,
)
from services.answer_generation.prompt_builder import (
    build_history_window,
    build_prompt,
    build_revision_prompt,
    estimate_token_count,
)
from services.answer_generation.provider import WriterProviderError, get_writer_provider
from services.retrieval.models import RetrievalRequest
from services.retrieval.service import retrieve_evidence
from config import settings


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


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


def _confidence_band(confidence: float) -> str:
    if confidence >= 0.8:
        return "high"
    if confidence >= 0.6:
        return "medium"
    return "low"


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


def _build_evidence_blocks(results: list[dict], workspace_id: str) -> list[EvidenceBlock]:
    chunk_ids = [row["chunkId"] for row in results]
    offsets = _load_chunk_offsets(workspace_id, chunk_ids)
    checksums = _load_chunk_checksums(workspace_id, chunk_ids)
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
            )
        )
    return blocks


def _build_spans(results: list[dict], evidence: list[EvidenceBlock]) -> list[Span]:
    evidence_by_chunk = {block.chunk_id: block for block in evidence}
    spans: list[Span] = []
    for row in results:
        block = evidence_by_chunk.get(row["chunkId"])
        offsets = block.source_offsets if block else []
        char_start = offsets[0]["char_start"] if offsets and "char_start" in offsets[0] else 0
        char_end = offsets[-1]["char_end"] if offsets and "char_end" in offsets[-1] else len(row["text"])
        spans.append(
            Span(
                chunk_id=row["chunkId"],
                document_id=row["documentId"],
                page=row["pageStart"],
                char_start=char_start,
                char_end=char_end,
                text=row["text"],
                rerank_score=float(row.get("rerankScore") or row.get("finalScore") or 0.0),
            )
        )
    return spans


def _claims_to_state_records(claims: list[ClaimRecord | dict]) -> list[DraftClaim]:
    records: list[DraftClaim] = []
    for claim in claims:
        if isinstance(claim, dict):
            claim_id = str(claim["id"])
            text = claim["text"]
            span_ids = claim.get("span_ids") or claim.get("spanIds") or []
            citation_keys = claim.get("citation_keys") or claim.get("citationKeys") or []
            section = claim.get("section")
            verification_pass = claim.get("verification_pass") or claim.get("verificationPass") or 1
        else:
            claim_id = claim.id
            text = claim.text
            span_ids = claim.span_ids
            citation_keys = claim.citation_keys
            section = claim.section
            verification_pass = claim.verification_pass
        records.append(
            DraftClaim(
            id=claim_id,
            text=text,
            span_ids=span_ids,
            citation_keys=citation_keys,
            section=section,
            verification_pass=verification_pass,
            supported=False,
            uncertain=False,
            critic_status=None,
            critic_note=None,
            corrected_text=None,
            entailment_label=None,
            entailment_score=None,
            support_probability=None,
            contradiction_probability=None,
            confidence=None,
            )
        )
    return records


def _build_claim_persistence_rows(
    *,
    workspace_id: str,
    message_id: str,
    answer_run_id: str,
    claims: list[DraftClaim],
) -> list[dict]:
    return [
        {
            "id": claim["id"],
            "workspace_id": workspace_id,
            "message_id": message_id,
            "answer_run_id": answer_run_id,
            "text": claim["text"],
            "span_ids": claim["span_ids"],
            "citation_keys": claim.get("citation_keys") or [],
            "section": claim.get("section"),
            "claim_index": index,
            "verification_pass": claim.get("verification_pass", 1),
            "supported": claim["supported"],
            "uncertain": claim["uncertain"],
            "critic_status": claim.get("critic_status"),
            "critic_note": claim.get("critic_note"),
            "corrected_text": claim.get("corrected_text"),
            "entailment_label": claim.get("entailment_label"),
            "entailment_score": claim.get("entailment_score"),
            "support_probability": claim.get("support_probability"),
            "contradiction_probability": claim.get("contradiction_probability"),
            "confidence": claim.get("confidence"),
        }
        for index, claim in enumerate(claims)
    ]


def _build_debate_rows(
    *,
    workspace_id: str,
    message_id: str,
    debate: list[DebateTurnEntry],
) -> list[dict]:
    return [
        {
            "workspace_id": workspace_id,
            "message_id": message_id,
            "round": turn["round"],
            "actor": turn["actor"],
            "action": turn["action"],
            "claim_id": turn["claim_id"],
            "note": turn["note"],
        }
        for turn in debate
    ]


def _build_trust(claims: list[DraftClaim], state_trust: dict | None) -> TrustMetadata:
    trust = state_trust or {}
    confidence = float(trust.get("confidence") or 0.0)
    return TrustMetadata(
        faithfulness=float(trust.get("faithfulness") or 0.0),
        relevance=trust.get("relevance"),
        overall=float(trust.get("overall") or confidence),
        confidence=confidence,
        calibrated=bool(trust.get("calibrated", True)),
        confidenceBand=_confidence_band(confidence),
    )


def _build_abstention_message(payload: AbstentionPayload) -> str:
    follow_up = payload.suggested_follow_up or payload.missing_evidence_query
    message = f"I can't verify this from the retrieved evidence.\n\nReason: {payload.reason}"
    if follow_up:
        message += f"\n\nSuggested follow-up: {follow_up}"
    return message


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


async def _run_retrieval_pass(
    *,
    workspace_id: str,
    conversation_id: str,
    user_message_id: str,
    query: str,
    document_ids: list[str],
) -> tuple[str, object, list[EvidenceBlock], list[Span]]:
    retrieval_response, _ = await retrieve_evidence(
        RetrievalRequest(query=query, document_ids=document_ids),
        workspace_id,
    )
    retrieval_results = retrieval_response.model_dump(mode="json", by_alias=True)["results"]
    evidence_blocks = _build_evidence_blocks(retrieval_results, workspace_id)
    spans = _build_spans(retrieval_results, evidence_blocks)

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

    return retrieval_run_id, retrieval_response, evidence_blocks, spans


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
    started_at = datetime.now(UTC)
    provider = get_writer_provider()
    answer_run_id = str(uuid4())
    assistant_message_id = str(uuid4())
    debate: list[DebateTurnEntry] = []
    retry_count = 0
    last_retrieval_run_id = ""
    last_retrieval_response = None
    last_evidence_blocks: list[EvidenceBlock] = []
    last_answer_text = ""
    last_prompt_payload: dict = {}
    writer_result = None
    final_state: AgentState | None = None
    current_query = query

    try:
        for verification_pass in range(1, settings.critic_max_iterations + 1):
            (
                retrieval_run_id,
                retrieval_response,
                evidence_blocks,
                spans,
            ) = await _run_retrieval_pass(
                workspace_id=workspace_id,
                conversation_id=conversation_id,
                user_message_id=user_message_id,
                query=current_query,
                document_ids=document_ids,
            )
            last_retrieval_run_id = retrieval_run_id
            last_retrieval_response = retrieval_response
            last_evidence_blocks = evidence_blocks

            if verification_pass == 1:
                prompt = build_prompt(
                    query=query,
                    evidence=evidence_blocks,
                    history=build_history_window(history_rows[:-1]),
                    prompt_version=settings.writer_prompt_version,
                )
            else:
                critic_feedback = [
                    turn["note"]
                    for turn in debate
                    if turn["actor"] == "critic" and turn["action"] == "flag"
                ]
                prompt = build_revision_prompt(
                    original_query=query,
                    revision_query=current_query,
                    previous_answer=last_answer_text,
                    critic_feedback=critic_feedback,
                    evidence=evidence_blocks,
                    history=build_history_window(history_rows[:-1]),
                    prompt_version=settings.writer_revision_prompt_version,
                )
            last_prompt_payload = prompt.model_dump(mode="json", by_alias=True)
            writer_result = await provider.generate(prompt)
            answer_text = writer_result.output.answer_markdown.strip()
            last_answer_text = answer_text

            citations = [
                block
                for block in evidence_blocks
                if block.citation_key in {citation.citation_key for citation in writer_result.output.citations}
            ]
            if not citations and evidence_blocks:
                citations = evidence_blocks[:1]

            extracted_claims = await extract_claims(
                answer_text=answer_text,
                evidence=citations or evidence_blocks,
                verification_pass=verification_pass,
            )
            claims = _claims_to_state_records(extracted_claims)

            debate.append(
                {
                    "round": verification_pass - 1,
                    "actor": "writer",
                    "action": "draft" if verification_pass == 1 else "revise",
                    "claim_id": None,
                    "note": f"Prepared {len(claims)} claim(s) for verification.",
                }
            )

            state = AgentState(
                workspace_id=workspace_id,
                conversation_id=conversation_id,
                query=current_query,
                document_ids=document_ids,
                route="single_doc_qa",
                history=history_rows,
                spans=spans,
                claims=claims,
                critic_loops=(
                    settings.critic_max_iterations
                    if verification_pass == settings.critic_max_iterations
                    else verification_pass - 1
                ),
                debate=debate,
                conflicts=[],
                trust=None,
                abstained=False,
                abstention_reason=None,
            )
            state = await run_critic_node(state)
            debate = state["debate"]
            final_state = state

            if state["_route"] == "retriever":  # type: ignore[index]
                retry_count += 1
                current_query = state["query"]
                continue

            final_state = run_calibrate_node(state)
            if final_state["_route"] == "abstain":  # type: ignore[index]
                final_state = run_abstain_node(final_state)
            break
        else:
            raise WriterProviderError("Verification runtime exhausted all passes without finalizing.")
    except WriterProviderError as exc:
        get_client().table("answer_runs").insert(
            {
                "id": answer_run_id,
                "workspace_id": workspace_id,
                "conversation_id": conversation_id,
                "user_message_id": user_message_id,
                "retrieval_run_id": last_retrieval_run_id or str(uuid4()),
                "request_id": request_id,
                "provider": "openai",
                "model": settings.llm_model,
                "prompt_version": last_prompt_payload.get("promptVersion", settings.writer_prompt_version),
                "writer_version": settings.verification_runtime_version,
                "status": "failed",
                "prompt_payload": last_prompt_payload or {},
                "error_code": "writer_failed",
                "error_message": str(exc),
                "retry_count": retry_count,
                "created_at": _now_iso(),
                "completed_at": _now_iso(),
            }
        ).execute()
        events = [
            {
                "type": "meta",
                "conversationId": conversation_id,
                "userMessageId": user_message_id,
                "retrievalRunId": last_retrieval_run_id or "",
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
            retrieval_run_id=last_retrieval_run_id or "",
            answer_run_id=answer_run_id,
            events=events,
        )

    assert writer_result is not None
    assert final_state is not None
    assert last_retrieval_response is not None

    trust = _build_trust(final_state["claims"], final_state.get("trust"))
    citations = [
        block
        for block in last_evidence_blocks
        if block.citation_key in {key for claim in final_state["claims"] for key in claim.get("citation_keys") or []}
    ]
    if not citations and last_evidence_blocks:
        citations = last_evidence_blocks[:1]

    abstention_payload: AbstentionPayload | None = None
    if final_state["abstained"]:
        abstention_event = dict(final_state.get("_abstention_event") or {})
        abstention_event["trust"] = _build_trust(
            final_state["claims"],
            abstention_event.get("trust") or final_state.get("trust"),
        ).model_dump(mode="json", by_alias=True)
        abstention_payload = AbstentionPayload.model_validate(abstention_event)
        answer_text = _build_abstention_message(abstention_payload)
    else:
        answer_text = last_answer_text

    completed_at = datetime.now(UTC)
    latency_ms = int((completed_at - started_at).total_seconds() * 1000)
    prompt_tokens = writer_result.usage.prompt_tokens
    completion_tokens = writer_result.usage.completion_tokens or estimate_token_count(
        answer_text,
        model=settings.llm_model,
    )
    total_tokens = writer_result.usage.total_tokens or (prompt_tokens + completion_tokens)

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
            "retrieval_run_id": last_retrieval_run_id,
            "assistant_message_id": assistant_message_id,
            "request_id": request_id,
            "provider": writer_result.provider,
            "model": writer_result.model,
            "prompt_version": last_prompt_payload.get("promptVersion", settings.writer_prompt_version),
            "writer_version": settings.verification_runtime_version,
            "status": "completed",
            "answer_markdown": answer_text,
            "answer_text": answer_text,
            "prompt_payload": last_prompt_payload,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "estimated_cost_usd": _calculate_cost(prompt_tokens, completion_tokens),
            "latency_ms": latency_ms,
            "first_token_latency_ms": latency_ms,
            "citation_count": len(citations),
            "evidence_chunk_count": len(last_evidence_blocks),
            "retry_count": retry_count,
            "trust_faithfulness": round(trust.faithfulness, 2),
            "trust_relevance": round(trust.relevance, 2) if trust.relevance is not None else None,
            "trust_overall": round(trust.overall, 2),
            "trust_confidence": round(trust.confidence, 2),
            "trust_calibrated": trust.calibrated,
            "confidence_band": trust.confidence_band,
            "verification_passes": retry_count + 1,
            "claim_count": len(final_state["claims"]),
            "supported_claim_count": sum(1 for claim in final_state["claims"] if claim["supported"]),
            "abstained": final_state["abstained"],
            "created_at": started_at.isoformat(),
            "completed_at": completed_at.isoformat(),
        }
    ).execute()

    claim_rows = _build_claim_persistence_rows(
        workspace_id=workspace_id,
        message_id=assistant_message_id,
        answer_run_id=answer_run_id,
        claims=final_state["claims"],
    )
    if claim_rows:
        get_client().table("claims").insert(claim_rows).execute()

    debate_rows = _build_debate_rows(
        workspace_id=workspace_id,
        message_id=assistant_message_id,
        debate=final_state["debate"],
    )
    if debate_rows:
        get_client().table("debate_turns").insert(debate_rows).execute()

    if abstention_payload is not None:
        get_client().table("abstentions").insert(
            {
                "workspace_id": workspace_id,
                "message_id": assistant_message_id,
                "reason": abstention_payload.reason,
                "missing_evidence_query": abstention_payload.missing_evidence_query,
                "suggested_follow_up": abstention_payload.suggested_follow_up,
            }
        ).execute()

    get_client().table("message_citations").insert(
        [
            {
                "workspace_id": workspace_id,
                "message_id": assistant_message_id,
                "answer_run_id": answer_run_id,
                "retrieval_run_id": last_retrieval_run_id,
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
            "kind": "answer",
            "input_tokens": prompt_tokens,
            "output_tokens": completion_tokens,
            "latency_ms": latency_ms,
            "created_at": completed_at.isoformat(),
        }
    ).execute()

    tokens = _token_batches(answer_text)
    normalized_payload = last_retrieval_response.normalized_query.model_dump(mode="json", by_alias=True)
    events: list[dict] = [
        {
            "type": "meta",
            "conversationId": conversation_id,
            "userMessageId": user_message_id,
            "assistantMessageId": assistant_message_id,
            "retrievalRunId": last_retrieval_run_id,
            "answerRunId": answer_run_id,
        },
        {"type": "graph_node", "node": "retriever", "status": "started"},
        {
            "type": "graph_node",
            "node": "retriever",
            "status": "finished",
            "summary": f"{len(last_evidence_blocks)} evidence chunk(s)",
        },
        {
            "type": "retrieval",
            "normalizedQuery": normalized_payload,
            "resultCount": len(last_evidence_blocks),
        },
        {"type": "graph_node", "node": "writer", "status": "started"},
    ]
    for turn in final_state["debate"]:
        if turn["actor"] == "writer":
            events.append(
                {
                    "type": "debate_turn",
                    "round": turn["round"],
                    "actor": turn["actor"],
                    "action": turn["action"],
                    "claimId": turn["claim_id"],
                    "note": turn["note"],
                }
            )
    for token in tokens:
        events.append({"type": "token", "text": token})
    events.append({"type": "graph_node", "node": "writer", "status": "finished"})
    for claim in final_state["claims"]:
        events.append(
            {
                "type": "claim",
                "claim": {
                    "id": claim["id"],
                    "text": claim["text"],
                    "spanIds": claim["span_ids"],
                    "citationKeys": claim.get("citation_keys") or [],
                    "section": claim.get("section"),
                    "verificationPass": claim.get("verification_pass", 1),
                    "supported": claim["supported"],
                    "uncertain": claim["uncertain"],
                    "criticStatus": claim.get("critic_status"),
                    "criticNote": claim.get("critic_note"),
                    "correctedText": claim.get("corrected_text"),
                    "entailmentLabel": claim.get("entailment_label"),
                    "entailmentScore": claim.get("entailment_score"),
                    "supportProbability": claim.get("support_probability"),
                    "contradictionProbability": claim.get("contradiction_probability"),
                    "confidence": claim.get("confidence"),
                },
            }
        )
    for turn in final_state["debate"]:
        if turn["actor"] == "critic":
            events.append(
                {
                    "type": "debate_turn",
                    "round": turn["round"],
                    "actor": turn["actor"],
                    "action": turn["action"],
                    "claimId": turn["claim_id"],
                    "note": turn["note"],
                }
            )
    events.append(
        {
            "type": "trust",
            "score": trust.model_dump(mode="json", by_alias=True),
        }
    )
    if abstention_payload is not None:
        events.append(
            {
                "type": "abstention",
                **abstention_payload.model_dump(mode="json", by_alias=True),
            }
        )
    for block in citations:
        events.append(
            {
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
        )
    events.append(
        {
            "type": "message",
            "message": {
                "id": assistant_message_id,
                "workspaceId": workspace_id,
                "conversationId": conversation_id,
                "role": "assistant",
                "content": answer_text,
                "createdAt": completed_at.isoformat(),
                "answerRunId": answer_run_id,
                "retrievalRunId": last_retrieval_run_id,
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
    )
    events.append({"type": "done"})
    _persist_events(workspace_id, answer_run_id, events)

    return PreparedAnswerStream(
        conversation_id=conversation_id,
        user_message_id=user_message_id,
        assistant_message_id=assistant_message_id,
        retrieval_run_id=last_retrieval_run_id,
        answer_run_id=answer_run_id,
        events=events,
    )


async def stream_events(events: list[dict]):
    for sequence, event in enumerate(events, start=1):
        yield _serialize_sse(event, sequence)
        await asyncio.sleep(0)

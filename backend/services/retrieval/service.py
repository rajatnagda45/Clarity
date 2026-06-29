from __future__ import annotations

import asyncio
import hashlib
import json
import time
from dataclasses import dataclass
from typing import Any

from config import settings
from db.client import get_client
from services.indexing.inspector import build_index_namespace
from services.retrieval.bm25 import SparseCorpusRow, score_sparse_candidates
from services.retrieval.cache import get_retrieval_cache
from services.retrieval.models import (
    RetrievalEvidence,
    RetrievalExplorerResponse,
    RetrievalFilters,
    RetrievalRequest,
    RetrievalResponse,
    RetrievalStageEntry,
)
from services.retrieval.normalize import normalize_query, tokenize_text
from services.retrieval.query_embedder import get_query_embedding_provider
from services.retrieval.rrf import fuse_rankings
from services.retrieval.vector_provider import VectorSearchProviderError, get_vector_search_provider
from services.retrieval.rerank import cohere_rerank


def get_reranker():
    """Backward-compat shim — old tests patch this to inject a fake reranker."""
    return None


@dataclass
class ChunkRow:
    row: dict[str, Any]
    embedding_version: str | None


def _now_ms() -> float:
    return time.perf_counter() * 1000


def _count_filters(filters: RetrievalFilters | None, document_ids: list[str]) -> int:
    count = len(document_ids)
    if not filters:
        return count
    return count + sum(
        1
        for value in (
            filters.section_title,
            filters.clause_number,
            filters.page_start,
            filters.page_end,
            filters.chunk_kind,
        )
        if value is not None
    )


def _normalize_clause_reference(value: str) -> str:
    lowered = value.strip().lower()
    for prefix in ("section ", "clause ", "article "):
        if lowered.startswith(prefix):
            return lowered[len(prefix):].strip()
    return lowered


def _matches_filters(row: dict[str, Any], filters: RetrievalFilters | None) -> bool:
    if not filters:
        return True
    if filters.section_title and (row.get("section_title") or "").lower() != filters.section_title.lower():
        return False
    if filters.clause_number and (row.get("clause_number") or "").lower() != filters.clause_number.lower():
        return False
    if filters.chunk_kind and (row.get("chunk_kind") or "").lower() != filters.chunk_kind.lower():
        return False
    if filters.page_start is not None and row.get("page_end", 0) < filters.page_start:
        return False
    if filters.page_end is not None and row.get("page_start", 0) > filters.page_end:
        return False
    return True


def _load_current_documents(workspace_id: str, document_ids: list[str]) -> list[dict[str, Any]]:
    query = (
        get_client()
        .table("documents")
        .select("*")
        .eq("workspace_id", workspace_id)
        .eq("current_index_provider", settings.index_provider)
        .eq("current_index_name", settings.pinecone_index)
        .eq("current_index_namespace", build_index_namespace(workspace_id))
        .eq("status", "indexed")
    )
    if document_ids:
        query = query.in_("id", document_ids)
    result = query.execute()
    return result.data or []


def _load_current_chunks(
    workspace_id: str,
    document_rows: list[dict[str, Any]],
    filters: RetrievalFilters | None,
) -> dict[str, ChunkRow]:
    if not document_rows:
        return {}

    document_map = {str(row["id"]): row for row in document_rows}
    result = (
        get_client()
        .table("chunks")
        .select("*")
        .eq("workspace_id", workspace_id)
        .in_("document_id", list(document_map))
        .order("chunk_index")
        .execute()
    )

    chunks: dict[str, ChunkRow] = {}
    for row in result.data or []:
        document = document_map.get(str(row["document_id"]))
        if not document:
            continue
        if row.get("parser_version") != document.get("current_embedding_parser_version"):
            continue
        if row.get("chunk_version") != document.get("current_embedding_chunk_version"):
            continue
        if not _matches_filters(row, filters):
            continue
        chunks[row["chunk_id"]] = ChunkRow(
            row=row,
            embedding_version=document.get("current_embedding_version"),
        )
    return chunks


def _load_current_index_rows(
    workspace_id: str,
    document_ids: list[str],
) -> list[dict[str, Any]]:
    query = (
        get_client()
        .table("chunk_vector_index_records")
        .select("*")
        .eq("workspace_id", workspace_id)
        .eq("index_provider", settings.index_provider)
        .eq("index_name", settings.pinecone_index)
        .eq("namespace", build_index_namespace(workspace_id))
        .eq("status", "indexed")
    )
    if document_ids:
        query = query.in_("document_id", document_ids)
    return query.execute().data or []


def _build_cache_key(
    workspace_id: str,
    request: RetrievalRequest,
    document_rows: list[dict[str, Any]],
) -> str:
    stamp = sorted(
        (
            str(row["id"]),
            row.get("current_embedding_version"),
            row.get("current_index_provider"),
            row.get("current_index_name"),
            row.get("index_completed_at"),
        )
        for row in document_rows
    )
    payload = {
        "workspace_id": workspace_id,
        "query": request.query,
        "document_ids": sorted(request.document_ids),
        "filters": request.filters.model_dump(mode="json", by_alias=True) if request.filters else None,
        "limit": request.limit,
        "parser_version": settings.parser_version,
        "chunk_version": settings.chunk_version,
        "embedding_version": settings.embedding_version,
        "index_provider": settings.index_provider,
        "stamp": stamp,
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()


def _record_retrieval_event(
    workspace_id: str,
    *,
    normalized_query: str,
    cache_hit: bool,
    failed: bool,
    dense_latency_ms: int,
    sparse_latency_ms: int,
    fusion_latency_ms: int,
    total_latency_ms: int,
    dense_candidate_count: int,
    sparse_candidate_count: int,
    dense_contributed_count: int,
    sparse_contributed_count: int,
    final_result_count: int,
    filter_count: int,
) -> None:
    get_client().table("retrieval_events").insert(
        {
            "workspace_id": workspace_id,
            "query_hash": hashlib.sha256(normalized_query.encode("utf-8")).hexdigest(),
            "normalized_query": normalized_query,
            "cache_hit": cache_hit,
            "failed": failed,
            "dense_latency_ms": dense_latency_ms,
            "sparse_latency_ms": sparse_latency_ms,
            "fusion_latency_ms": fusion_latency_ms,
            "total_latency_ms": total_latency_ms,
            "dense_candidate_count": dense_candidate_count,
            "sparse_candidate_count": sparse_candidate_count,
            "dense_contributed_count": dense_contributed_count,
            "sparse_contributed_count": sparse_contributed_count,
            "final_result_count": final_result_count,
            "filter_count": filter_count,
        }
    ).execute()


def _build_sparse_corpus(chunks: dict[str, ChunkRow]) -> list[SparseCorpusRow]:
    return [
        SparseCorpusRow(
            chunk_id=chunk_id,
            document_id=str(chunk.row["document_id"]),
            tokens=tokenize_text(chunk.row["text"]),
        )
        for chunk_id, chunk in chunks.items()
    ]


def _build_reason(sources: set[str], *, expanded_from: str | None = None) -> str:
    if "cross_reference" in sources and expanded_from:
        return f"Expanded from cross reference to {expanded_from}."
    if sources == {"dense", "sparse"}:
        return "Strong lexical and semantic agreement."
    if sources == {"dense"}:
        return "Semantic vector match."
    if sources == {"sparse"}:
        return "Lexical BM25 match."
    return "Hybrid retrieval match."


def _to_stage_entries(candidates: list[Any], *, stage: str) -> list[RetrievalStageEntry]:
    entries: list[RetrievalStageEntry] = []
    for candidate in candidates:
        entries.append(
            RetrievalStageEntry(
                chunkId=candidate.chunk_id,
                documentId=candidate.document_id,
                rank=candidate.rank,
                score=candidate.score,
                reason=stage,
            )
        )
    return entries


def _expand_cross_references(
    fused_rows: list[dict[str, Any]],
    chunks: dict[str, ChunkRow],
) -> list[dict[str, Any]]:
    clause_map: dict[tuple[str, str], str] = {}
    for chunk_id, chunk in chunks.items():
        clause_number = chunk.row.get("clause_number")
        if clause_number:
            clause_map[(str(chunk.row["document_id"]), clause_number.lower())] = chunk_id

    expanded: list[dict[str, Any]] = []
    added_ids = {row["chunk_id"] for row in fused_rows}
    for base_row in fused_rows[: settings.retrieval_final_top_k]:
        chunk = chunks.get(base_row["chunk_id"])
        if not chunk:
            continue
        expansions = 0
        for reference in chunk.row.get("cross_references") or []:
            reference_key = _normalize_clause_reference(reference)
            target_chunk_id = clause_map.get((str(chunk.row["document_id"]), reference_key))
            if not target_chunk_id or target_chunk_id in added_ids:
                continue
            added_ids.add(target_chunk_id)
            expansions += 1
            expanded.append(
                {
                    "chunk_id": target_chunk_id,
                    "document_id": str(chunk.row["document_id"]),
                    "vector_score": None,
                    "bm25_score": None,
                    "rrf_score": max(base_row["rrf_score"] * 0.35, 0.001),
                    "sources": {"cross_reference"},
                    "expanded_from": reference,
                }
            )
            if expansions >= settings.retrieval_cross_reference_limit:
                break
    return expanded


async def retrieve_evidence(
    request: RetrievalRequest,
    workspace_id: str,
) -> tuple[RetrievalResponse, RetrievalExplorerResponse]:
    started_ms = _now_ms()
    normalized_query = normalize_query(request.query)
    limit = request.limit or settings.retrieval_final_top_k

    document_rows = _load_current_documents(workspace_id, request.document_ids)
    chunks = _load_current_chunks(workspace_id, document_rows, request.filters)
    cache_key = _build_cache_key(workspace_id, request, document_rows)
    cache = get_retrieval_cache()
    cached = cache.get(cache_key)
    if cached is not None:
        _record_retrieval_event(
            workspace_id,
            normalized_query=normalized_query.normalized_query,
            cache_hit=True,
            failed=False,
            dense_latency_ms=cached["dense_latency_ms"],
            sparse_latency_ms=cached["sparse_latency_ms"],
            fusion_latency_ms=cached["fusion_latency_ms"],
            total_latency_ms=int(_now_ms() - started_ms),
            dense_candidate_count=len(cached["dense_candidates"]),
            sparse_candidate_count=len(cached["sparse_candidates"]),
            dense_contributed_count=sum(1 for row in cached["results"] if "dense" in row.retrieval_sources),
            sparse_contributed_count=sum(1 for row in cached["results"] if "sparse" in row.retrieval_sources),
            final_result_count=len(cached["results"]),
            filter_count=_count_filters(request.filters, request.document_ids),
        )
        response = RetrievalResponse(
            normalizedQuery=normalized_query,
            retrievalMode="hybrid",
            cacheHit=True,
            results=cached["results"],
        )
        explorer = RetrievalExplorerResponse(
            normalizedQuery=normalized_query,
            cacheHit=True,
            denseCandidates=cached["dense_stage"],
            sparseCandidates=cached["sparse_stage"],
            fusedCandidates=cached["fused_stage"],
            results=cached["results"],
            denseLatencyMs=cached["dense_latency_ms"],
            sparseLatencyMs=cached["sparse_latency_ms"],
            fusionLatencyMs=cached["fusion_latency_ms"],
            totalLatencyMs=int(_now_ms() - started_ms),
        )
        return response, explorer

    dense_latency_ms = 0
    sparse_latency_ms = 0
    fusion_latency_ms = 0
    dense_candidates = []
    sparse_candidates = []
    try:
        query_embedder = get_query_embedding_provider()
        vector_provider = get_vector_search_provider()

        sparse_corpus = _build_sparse_corpus(chunks)

        async def run_dense() -> tuple[list, int]:
            started = _now_ms()
            query_vector = await query_embedder.embed(normalized_query.normalized_query)
            result = await vector_provider.search(
                workspace_id=workspace_id,
                vector=query_vector,
                top_k=settings.retrieval_dense_top_k,
                document_ids=request.document_ids,
            )
            return result, int(_now_ms() - started)

        async def run_sparse() -> tuple[list, int]:
            started = _now_ms()
            result = score_sparse_candidates(
                sparse_corpus,
                normalized_query.tokens,
                top_k=settings.retrieval_sparse_top_k,
            )
            return result, int(_now_ms() - started)

        dense_result, sparse_result = await asyncio.gather(
            run_dense(),
            run_sparse(),
            return_exceptions=True,
        )

        if isinstance(dense_result, Exception):
            dense_candidates = []
        else:
            dense_latency_ms = dense_result[1]
            dense_candidates = [
                candidate
                for candidate in dense_result[0]
                if candidate.chunk_id in chunks
            ]

        if isinstance(sparse_result, Exception):
            sparse_candidates = []
        else:
            sparse_latency_ms = sparse_result[1]
            sparse_candidates = [
                candidate
                for candidate in sparse_result[0]
                if candidate.chunk_id in chunks
            ]

        if isinstance(dense_result, Exception) and isinstance(sparse_result, Exception):
            raise ValueError("Dense and sparse retrieval both failed for the current request.")

        fusion_started = _now_ms()
        fused_rows = fuse_rankings(
            dense_candidates,
            sparse_candidates,
            rrf_k=settings.retrieval_rrf_k,
        )
        fused_rows.extend(_expand_cross_references(fused_rows, chunks))
        fused_rows = sorted(
            fused_rows,
            key=lambda row: (
                -(row["rrf_score"] + (0.02 if "cross_reference" in row["sources"] else 0.0)),
                row.get("chunk_id", ""),
            ),
        )

        # Cohere rerank over the top-k candidates before building results
        rerank_scores: dict[str, float] = {}
        candidate_rows = fused_rows[:limit]
        reranker = get_reranker()
        if reranker is not None:
            # Use the injected reranker (supports test patching)
            try:
                rerank_results = await reranker.rerank(
                    normalized_query.normalized_query,
                    [{"chunk_id": row["chunk_id"], "document_id": row.get("document_id", ""), "text": chunks[row["chunk_id"]].row["text"]} for row in candidate_rows if row["chunk_id"] in chunks],
                    top_n=limit,
                )
                for result in rerank_results:
                    rerank_scores[result.chunk_id] = result.score
            except Exception:
                pass
        else:
            texts_to_rerank = [
                chunks[row["chunk_id"]].row["text"]
                for row in candidate_rows
                if row["chunk_id"] in chunks
            ]
            if texts_to_rerank:
                try:
                    scores = cohere_rerank(
                        query=normalized_query.normalized_query,
                        documents=texts_to_rerank,
                    )
                    for idx, row in enumerate(candidate_rows):
                        if idx < len(scores):
                            rerank_scores[row["chunk_id"]] = scores[idx]
                except Exception:
                    pass

        # Re-sort by rerank score when available, preserving rrf_score as tiebreaker
        if rerank_scores:
            fused_rows[:len(candidate_rows)] = sorted(
                candidate_rows,
                key=lambda row: -(rerank_scores.get(row["chunk_id"], row["rrf_score"])),
            )
            fused_rows = fused_rows  # tail (cross-refs beyond limit) stays in place

        fusion_latency_ms = int(_now_ms() - fusion_started)

        results: list[RetrievalEvidence] = []
        dense_by_chunk = {candidate.chunk_id: candidate for candidate in dense_candidates}
        sparse_by_chunk = {candidate.chunk_id: candidate for candidate in sparse_candidates}
        for final_rank, fused_row in enumerate(fused_rows[:limit], start=1):
            chunk = chunks.get(fused_row["chunk_id"])
            if not chunk:
                continue
            sources = set(fused_row["sources"])
            bonus = 0.02 if "cross_reference" in sources else 0.0
            results.append(
                RetrievalEvidence(
                    workspaceId=workspace_id,
                    documentId=str(chunk.row["document_id"]),
                    chunkId=fused_row["chunk_id"],
                    chunkIndex=chunk.row["chunk_index"],
                    text=chunk.row["text"],
                    sectionTitle=chunk.row.get("section_title"),
                    clauseNumber=chunk.row.get("clause_number"),
                    pageStart=chunk.row["page_start"],
                    pageEnd=chunk.row["page_end"],
                    chunkKind=chunk.row["chunk_kind"],
                    crossReferences=chunk.row.get("cross_references") or [],
                    vectorScore=(
                        dense_by_chunk[fused_row["chunk_id"]].score
                        if fused_row["chunk_id"] in dense_by_chunk
                        else None
                    ),
                    bm25Score=(
                        sparse_by_chunk[fused_row["chunk_id"]].score
                        if fused_row["chunk_id"] in sparse_by_chunk
                        else None
                    ),
                    rrfScore=fused_row["rrf_score"],
                    rerankScore=rerank_scores.get(fused_row["chunk_id"]),
                    finalScore=rerank_scores.get(fused_row["chunk_id"], fused_row["rrf_score"] + bonus),
                    finalRank=final_rank,
                    retrievalReason=_build_reason(sources, expanded_from=fused_row.get("expanded_from")),
                    retrievalSources=sorted(sources),
                    parserVersion=chunk.row["parser_version"],
                    chunkVersion=chunk.row["chunk_version"],
                    embeddingVersion=chunk.embedding_version,
                )
            )

        total_latency_ms = int(_now_ms() - started_ms)
        dense_stage = _to_stage_entries(dense_candidates, stage="dense")
        sparse_stage = _to_stage_entries(sparse_candidates, stage="sparse")
        fused_stage = [
            RetrievalStageEntry(
                chunkId=row["chunk_id"],
                documentId=row["document_id"],
                rank=index + 1,
                score=row["rrf_score"],
                reason=_build_reason(set(row["sources"]), expanded_from=row.get("expanded_from")),
            )
            for index, row in enumerate(fused_rows[: max(limit, 10)])
        ]

        cache.set(
            cache_key,
            {
                "dense_latency_ms": dense_latency_ms,
                "sparse_latency_ms": sparse_latency_ms,
                "fusion_latency_ms": fusion_latency_ms,
                "dense_candidates": dense_candidates,
                "sparse_candidates": sparse_candidates,
                "dense_stage": dense_stage,
                "sparse_stage": sparse_stage,
                "fused_stage": fused_stage,
                "results": results,
            },
        )
        _record_retrieval_event(
            workspace_id,
            normalized_query=normalized_query.normalized_query,
            cache_hit=False,
            failed=False,
            dense_latency_ms=dense_latency_ms,
            sparse_latency_ms=sparse_latency_ms,
            fusion_latency_ms=fusion_latency_ms,
            total_latency_ms=total_latency_ms,
            dense_candidate_count=len(dense_candidates),
            sparse_candidate_count=len(sparse_candidates),
            dense_contributed_count=sum(1 for row in results if "dense" in row.retrieval_sources),
            sparse_contributed_count=sum(1 for row in results if "sparse" in row.retrieval_sources),
            final_result_count=len(results),
            filter_count=_count_filters(request.filters, request.document_ids),
        )
        response = RetrievalResponse(
            normalizedQuery=normalized_query,
            retrievalMode="hybrid",
            cacheHit=False,
            results=results,
        )
        explorer = RetrievalExplorerResponse(
            normalizedQuery=normalized_query,
            cacheHit=False,
            denseCandidates=dense_stage,
            sparseCandidates=sparse_stage,
            fusedCandidates=fused_stage,
            results=results,
            denseLatencyMs=dense_latency_ms,
            sparseLatencyMs=sparse_latency_ms,
            fusionLatencyMs=fusion_latency_ms,
            totalLatencyMs=total_latency_ms,
        )
        return response, explorer
    except (VectorSearchProviderError, ValueError):
        total_latency_ms = int(_now_ms() - started_ms)
        _record_retrieval_event(
            workspace_id,
            normalized_query=normalized_query.normalized_query,
            cache_hit=False,
            failed=True,
            dense_latency_ms=dense_latency_ms,
            sparse_latency_ms=sparse_latency_ms,
            fusion_latency_ms=fusion_latency_ms,
            total_latency_ms=total_latency_ms,
            dense_candidate_count=len(dense_candidates),
            sparse_candidate_count=len(sparse_candidates),
            dense_contributed_count=0,
            sparse_contributed_count=0,
            final_result_count=0,
            filter_count=_count_filters(request.filters, request.document_ids),
        )
        raise

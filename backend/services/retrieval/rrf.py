from __future__ import annotations

from services.retrieval.models import DenseCandidate, SparseCandidate


def fuse_rankings(
    dense_candidates: list[DenseCandidate],
    sparse_candidates: list[SparseCandidate],
    *,
    rrf_k: int,
) -> list[dict]:
    fused: dict[str, dict] = {}

    for candidate in dense_candidates:
        entry = fused.setdefault(
            candidate.chunk_id,
            {
                "chunk_id": candidate.chunk_id,
                "document_id": candidate.document_id,
                "vector_score": None,
                "bm25_score": None,
                "dense_rank": None,
                "sparse_rank": None,
                "rrf_score": 0.0,
                "sources": set(),
            },
        )
        entry["vector_score"] = candidate.score
        entry["dense_rank"] = candidate.rank
        entry["rrf_score"] += 1 / (rrf_k + candidate.rank)
        entry["sources"].add("dense")

    for candidate in sparse_candidates:
        entry = fused.setdefault(
            candidate.chunk_id,
            {
                "chunk_id": candidate.chunk_id,
                "document_id": candidate.document_id,
                "vector_score": None,
                "bm25_score": None,
                "dense_rank": None,
                "sparse_rank": None,
                "rrf_score": 0.0,
                "sources": set(),
            },
        )
        entry["bm25_score"] = candidate.score
        entry["sparse_rank"] = candidate.rank
        entry["rrf_score"] += 1 / (rrf_k + candidate.rank)
        entry["sources"].add("sparse")

    return sorted(
        fused.values(),
        key=lambda entry: (
            -entry["rrf_score"],
            entry["dense_rank"] if entry["dense_rank"] is not None else 10**9,
            entry["sparse_rank"] if entry["sparse_rank"] is not None else 10**9,
            entry["chunk_id"],
        ),
    )

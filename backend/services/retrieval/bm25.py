from __future__ import annotations

from dataclasses import dataclass

from rank_bm25 import BM25Okapi

from services.retrieval.models import SparseCandidate


@dataclass
class SparseCorpusRow:
    chunk_id: str
    document_id: str
    tokens: list[str]


def score_sparse_candidates(
    rows: list[SparseCorpusRow],
    query_tokens: list[str],
    *,
    top_k: int,
) -> list[SparseCandidate]:
    if not rows or not query_tokens:
        return []

    corpus = [row.tokens for row in rows]
    bm25 = BM25Okapi(corpus)
    scores = bm25.get_scores(query_tokens)
    if not any(float(score) > 0 for score in scores):
        query_token_set = set(query_tokens)
        scores = [
            float(len(query_token_set.intersection(row.tokens))) / max(len(query_token_set), 1)
            for row in rows
        ]

    ranked_indices = sorted(
        range(len(rows)),
        key=lambda index: (-float(scores[index]), rows[index].document_id, rows[index].chunk_id),
    )

    candidates: list[SparseCandidate] = []
    for rank, index in enumerate(ranked_indices[:top_k], start=1):
        score = float(scores[index])
        if score <= 0:
            continue
        row = rows[index]
        candidates.append(
            SparseCandidate(
                chunkId=row.chunk_id,
                documentId=row.document_id,
                score=score,
                rank=rank,
            )
        )
    return candidates

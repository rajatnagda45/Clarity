"""
Cohere rerank — post-fusion relevance refinement.

Called after RRF fusion to re-order the top-k candidates by Cohere's
cross-encoder relevance score.  Returns a score list aligned with the
input documents list (same index, same order).

Falls back gracefully: if COHERE_API_KEY is missing or the call fails,
the caller uses rrf_score as the fallback ordering.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def cohere_rerank(query: str, documents: list[str]) -> list[float]:
    """
    Re-rank `documents` against `query` using the Cohere Rerank API.

    Returns a list of relevance scores aligned to the input document list.
    Scores are in [0, 1] range.  On any failure, returns an empty list so
    the caller keeps its existing ordering.
    """
    if not documents:
        return []

    try:
        import cohere
        from config import settings

        co = cohere.Client(api_key=settings.cohere_api_key)
        response = co.rerank(
            query=query,
            documents=documents,
            model="rerank-english-v3.0",
            top_n=len(documents),
        )
        # response.results is ordered by relevance; map back to original indices
        scores_by_index: dict[int, float] = {
            result.index: result.relevance_score
            for result in response.results
        }
        return [scores_by_index.get(i, 0.0) for i in range(len(documents))]
    except ImportError:
        logger.warning("cohere package not installed — skipping rerank")
        return []
    except Exception as exc:
        logger.warning("Cohere rerank failed (will use RRF ordering): %s", exc)
        return []

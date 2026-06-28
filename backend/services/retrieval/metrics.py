from __future__ import annotations


def build_retrieval_metrics(event_rows: list[dict]) -> dict:
    event_count = len(event_rows)
    if event_count == 0:
        return {
            "retrievalLatencyMs": 0.0,
            "averageRetrievedChunks": 0.0,
            "denseRecall": 0.0,
            "sparseRecall": 0.0,
            "fusionLatencyMs": 0.0,
            "averageFusionScore": 0.0,
            "filterUsage": 0.0,
            "queryVolume": 0,
            "retrievalCacheHits": 0,
            "retrievalFailures": 0,
        }

    dense_recall_total = 0.0
    sparse_recall_total = 0.0
    for row in event_rows:
        dense_candidates = row.get("dense_candidate_count", 0) or 0
        sparse_candidates = row.get("sparse_candidate_count", 0) or 0
        if dense_candidates:
            dense_recall_total += (row.get("dense_contributed_count", 0) or 0) / dense_candidates
        if sparse_candidates:
            sparse_recall_total += (row.get("sparse_contributed_count", 0) or 0) / sparse_candidates

    return {
        "retrievalLatencyMs": sum((row.get("total_latency_ms") or 0) for row in event_rows) / event_count,
        "averageRetrievedChunks": sum((row.get("final_result_count") or 0) for row in event_rows) / event_count,
        "denseRecall": dense_recall_total / event_count,
        "sparseRecall": sparse_recall_total / event_count,
        "fusionLatencyMs": sum((row.get("fusion_latency_ms") or 0) for row in event_rows) / event_count,
        "averageFusionScore": sum(
            ((row.get("dense_contributed_count", 0) or 0) + (row.get("sparse_contributed_count", 0) or 0))
            / max(row.get("final_result_count", 0) or 1, 1)
            for row in event_rows
        ) / event_count,
        "filterUsage": sum(1 for row in event_rows if (row.get("filter_count", 0) or 0) > 0) / event_count,
        "queryVolume": event_count,
        "retrievalCacheHits": sum(1 for row in event_rows if row.get("cache_hit")),
        "retrievalFailures": sum(1 for row in event_rows if row.get("failed")),
    }

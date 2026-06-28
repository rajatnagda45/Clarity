from __future__ import annotations

from services.indexing.inspector import is_current_index_row


def build_index_metrics(documents: list[dict], index_rows: list[dict]) -> dict:
    successful_documents = [document for document in documents if document.get("status") == "indexed"]
    failed_documents = [
        document
        for document in documents
        if document.get("status") == "failed" and document.get("current_embedding_version")
    ]

    document_by_id = {str(document["id"]): document for document in documents}
    current_rows = [
        row
        for row in index_rows
        if is_current_index_row(document_by_id.get(str(row["document_id"]), {}), row)
    ]

    vectors_indexed = len(current_rows)
    average_indexing_latency_ms = (
        sum((row.get("latency_ms") or 0) for row in current_rows) / vectors_indexed
        if vectors_indexed
        else 0.0
    )
    retry_count = sum((row.get("retry_count") or 0) for row in index_rows)
    namespace_counts: dict[str, int] = {}
    for row in current_rows:
        namespace = row.get("namespace", "unknown")
        namespace_counts[namespace] = namespace_counts.get(namespace, 0) + 1

    total_processing_time_ms = 0.0
    total_lag_ms = 0.0
    processing_samples = 0
    lag_samples = 0
    for document in successful_documents:
        started_at = document.get("index_started_at")
        completed_at = document.get("index_completed_at")
        embedded_at = document.get("embedding_completed_at")
        if started_at and completed_at:
            processing_samples += 1
            total_processing_time_ms += (
                _parse_iso(completed_at) - _parse_iso(started_at)
            ).total_seconds() * 1000
        if embedded_at and completed_at:
            lag_samples += 1
            total_lag_ms += (
                _parse_iso(completed_at) - _parse_iso(embedded_at)
            ).total_seconds() * 1000

    coverage_denominator = len(
        [
            document
            for document in documents
            if document.get("current_embedding_version")
            and document.get("status") in {"embedded", "awaiting_index", "indexing", "indexed", "failed"}
        ]
    )
    current_embedding_version_coverage = (
        len(successful_documents) / coverage_denominator if coverage_denominator else 0.0
    )
    total_duration_seconds = total_processing_time_ms / 1000 if total_processing_time_ms else 0.0
    indexed_dimensions = sum(document.get("current_embedding_dimension") or 0 for document in successful_documents)
    index_size_estimate_bytes = int(sum((row.get("embedding_dimension") or 0) * 4 for row in current_rows))

    return {
        "vectorsIndexed": vectors_indexed,
        "averageIndexingLatencyMs": average_indexing_latency_ms,
        "indexThroughput": vectors_indexed / total_duration_seconds if total_duration_seconds else 0.0,
        "failedIndexOperations": len(failed_documents),
        "retryCount": retry_count,
        "namespaceCounts": namespace_counts,
        "indexSizeEstimateBytes": index_size_estimate_bytes,
        "synchronizationLagMs": total_lag_ms / lag_samples if lag_samples else 0.0,
        "currentEmbeddingVersionCoverage": current_embedding_version_coverage,
        "indexedDocuments": len(successful_documents),
        "averageDocumentIndexingTimeMs": (
            total_processing_time_ms / processing_samples if processing_samples else 0.0
        ),
        "indexedDimensions": indexed_dimensions,
    }


def _parse_iso(value: str):
    from datetime import datetime

    return datetime.fromisoformat(value.replace("Z", "+00:00"))

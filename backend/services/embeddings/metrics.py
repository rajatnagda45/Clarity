from __future__ import annotations

from services.embeddings.inspector import is_current_embedding_row


def build_embedding_metrics(documents: list[dict], embedding_rows: list[dict]) -> dict:
    documents_in_pipeline = [
        document
        for document in documents
        if document.get("status") in {"awaiting_embeddings", "embedding", "embedded", "failed"}
    ]
    successful_documents = [document for document in documents if document.get("status") == "embedded"]
    failed_documents = [document for document in documents if document.get("status") == "failed"]

    document_by_id = {str(document["id"]): document for document in documents}
    current_rows = [
        row
        for row in embedding_rows
        if is_current_embedding_row(document_by_id.get(str(row["document_id"]), {}), row)
    ]

    documents_processed = len(successful_documents)
    chunks_processed = len(current_rows)
    average_chunks_per_document = (
        sum(document.get("embedded_chunk_count", 0) for document in successful_documents) / documents_processed
        if documents_processed
        else 0.0
    )
    average_tokens_per_chunk = (
        sum(row.get("token_count", 0) for row in current_rows) / chunks_processed
        if chunks_processed
        else 0.0
    )
    average_embedding_latency_ms = (
        sum((row.get("latency_ms") or 0) for row in current_rows) / chunks_processed
        if chunks_processed
        else 0.0
    )
    pipeline_count = len(documents_in_pipeline)
    processing_success_rate = documents_processed / pipeline_count if pipeline_count else 0.0
    processing_failure_rate = len(failed_documents) / pipeline_count if pipeline_count else 0.0
    retry_count = sum((row.get("retry_count") or 0) for row in embedding_rows)

    total_document_processing_time_ms = 0.0
    total_queue_time_ms = 0.0
    processing_samples = 0
    queue_samples = 0
    for document in successful_documents:
        started_at = document.get("embedding_started_at")
        completed_at = document.get("embedding_completed_at")
        queued_at = document.get("embedding_queued_at")
        if started_at and completed_at:
            processing_samples += 1
            total_document_processing_time_ms += (
                _parse_iso(completed_at) - _parse_iso(started_at)
            ).total_seconds() * 1000
        if queued_at and started_at:
            queue_samples += 1
            total_queue_time_ms += (
                _parse_iso(started_at) - _parse_iso(queued_at)
            ).total_seconds() * 1000

    provider_usage_counts: dict[str, int] = {}
    model_usage_counts: dict[str, int] = {}
    for row in embedding_rows:
        provider = row.get("embedding_provider", "unknown")
        model = row.get("embedding_model", "unknown")
        provider_usage_counts[provider] = provider_usage_counts.get(provider, 0) + 1
        model_usage_counts[model] = model_usage_counts.get(model, 0) + 1

    return {
        "documentsProcessed": documents_processed,
        "chunksProcessed": chunks_processed,
        "averageChunksPerDocument": average_chunks_per_document,
        "averageTokensPerChunk": average_tokens_per_chunk,
        "averageEmbeddingLatencyMs": average_embedding_latency_ms,
        "processingSuccessRate": processing_success_rate,
        "processingFailureRate": processing_failure_rate,
        "retryCount": retry_count,
        "averageDocumentProcessingTimeMs": (
            total_document_processing_time_ms / processing_samples if processing_samples else 0.0
        ),
        "averageEmbeddingQueueTimeMs": total_queue_time_ms / queue_samples if queue_samples else 0.0,
        "estimatedTotalTokens": sum(row.get("token_count", 0) for row in current_rows),
        "estimatedTotalCostUsd": float(sum(row.get("estimated_cost_usd", 0) or 0 for row in current_rows)),
        "providerUsageCounts": provider_usage_counts,
        "modelUsageCounts": model_usage_counts,
    }


def _parse_iso(value: str):
    from datetime import datetime

    return datetime.fromisoformat(value.replace("Z", "+00:00"))

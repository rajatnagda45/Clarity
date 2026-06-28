from __future__ import annotations


def is_current_embedding_row(document: dict, row: dict) -> bool:
    return (
        row.get("embedding_provider") == document.get("current_embedding_provider")
        and row.get("embedding_model") == document.get("current_embedding_model")
        and row.get("embedding_dimension") == document.get("current_embedding_dimension")
        and row.get("embedding_version") == document.get("current_embedding_version")
        and row.get("parser_version") == document.get("current_embedding_parser_version")
        and row.get("chunk_version") == document.get("current_embedding_chunk_version")
    )

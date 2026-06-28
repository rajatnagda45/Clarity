from __future__ import annotations


def build_index_namespace(workspace_id: str) -> str:
    return f"ws_{workspace_id}"


def is_current_index_row(document: dict, row: dict) -> bool:
    return (
        row.get("status") == "indexed"
        and row.get("index_provider") == document.get("current_index_provider")
        and row.get("index_name") == document.get("current_index_name")
        and row.get("namespace") == document.get("current_index_namespace")
        and row.get("embedding_provider") == document.get("current_embedding_provider")
        and row.get("embedding_model") == document.get("current_embedding_model")
        and row.get("embedding_dimension") == document.get("current_embedding_dimension")
        and row.get("embedding_version") == document.get("current_embedding_version")
        and row.get("parser_version") == document.get("current_embedding_parser_version")
        and row.get("chunk_version") == document.get("current_embedding_chunk_version")
    )

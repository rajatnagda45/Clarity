from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from services.prompts.manager import (
    _validate_key,
    create_prompt_version,
    get_active_prompt,
    list_prompt_versions,
)


def _db_chain(data: list) -> MagicMock:
    chain = MagicMock()
    chain.eq.return_value = chain
    chain.order.return_value = chain
    chain.limit.return_value = chain
    chain.select.return_value = chain
    chain.insert.return_value = chain
    chain.update.return_value = chain
    chain.execute.return_value = MagicMock(data=data)
    return chain


def test_validate_key_rejects_unknown():
    with pytest.raises(ValueError, match="prompt_key"):
        _validate_key("unknown_key")


def test_validate_key_accepts_valid():
    for key in ("writer", "critic", "judge"):
        _validate_key(key)  # must not raise


def test_create_prompt_version_calls_insert():
    with (
        patch("services.prompts.manager.get_client") as mock_gc,
        patch("services.prompts.manager.tenant_query"),
    ):
        db = MagicMock()
        db.table.return_value = db
        db.insert.return_value = db
        db.execute.return_value = MagicMock(data=[])
        mock_gc.return_value = db

        prompt_id = create_prompt_version(
            workspace_id="ws-1",
            prompt_key="writer",
            version="b4.writer.v2",
            content="You are a writer...",
            description="Improved writer prompt",
            author="test-user",
        )

    assert isinstance(prompt_id, str)
    db.table.assert_called_with("prompt_versions")
    db.insert.assert_called_once()


def test_create_prompt_version_rejects_invalid_key():
    with pytest.raises(ValueError):
        create_prompt_version("ws", "invalid_key", "v1", "content")


def test_list_prompt_versions_filters_by_key():
    rows = [
        {"id": "p1", "prompt_key": "writer", "version": "v1", "active": True, "retired": False, "content": "...", "workspace_id": "ws-1", "created_at": "2026-01-01"},
    ]
    with (
        patch("services.prompts.manager.get_client"),
        patch("services.prompts.manager.tenant_query") as mock_tq,
    ):
        chain = MagicMock()
        chain.eq.return_value = chain
        chain.order.return_value = chain
        chain.limit.return_value = chain
        chain.execute.return_value = MagicMock(data=rows)
        mock_tq.return_value = chain

        result = list_prompt_versions("ws-1", prompt_key="writer")

    assert len(result) == 1
    assert result[0]["prompt_key"] == "writer"


def test_get_active_prompt_returns_none_when_missing():
    with (
        patch("services.prompts.manager.get_client"),
        patch("services.prompts.manager.tenant_query") as mock_tq,
    ):
        chain = MagicMock()
        chain.eq.return_value = chain
        chain.limit.return_value = chain
        chain.execute.return_value = MagicMock(data=[])
        mock_tq.return_value = chain

        result = get_active_prompt("ws-1", "writer")

    assert result is None

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, call, patch

import pytest

from services.eval.benchmark import _load_cases, _load_dataset, run_benchmark


def _make_chain(data: list) -> MagicMock:
    chain = MagicMock()
    chain.eq.return_value = chain
    chain.order.return_value = chain
    chain.limit.return_value = chain
    chain.execute.return_value = MagicMock(data=data)
    return chain


# ─── _load_dataset ───────────────────────────────────────────────────────────

def test_load_dataset_returns_none_when_missing():
    with patch("services.eval.benchmark.tenant_query") as mock_tq:
        mock_tq.return_value = _make_chain([])
        result = _load_dataset("ws-1", "ds-missing")
    assert result is None


def test_load_dataset_returns_row_when_found():
    row = {"id": "ds-1", "workspace_id": "ws-1", "name": "My Dataset", "dataset_type": "custom"}
    with patch("services.eval.benchmark.tenant_query") as mock_tq:
        mock_tq.return_value = _make_chain([row])
        result = _load_dataset("ws-1", "ds-1")
    assert result == row


# ─── _load_cases ─────────────────────────────────────────────────────────────

def test_load_cases_returns_empty_list_when_no_cases():
    with patch("services.eval.benchmark.tenant_query") as mock_tq:
        chain = MagicMock()
        chain.eq.return_value = chain
        chain.order.return_value = chain
        chain.execute.return_value = MagicMock(data=[])
        mock_tq.return_value = chain
        result = _load_cases("ws-1", "ds-1")
    assert result == []


# ─── run_benchmark ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_run_benchmark_empty_dataset_completes():
    dataset_row = {"id": "ds-1", "workspace_id": "ws-1", "name": "Empty", "dataset_type": "custom"}

    with (
        patch("services.eval.benchmark.tenant_query") as mock_tq,
        patch("services.eval.benchmark.get_client") as mock_gc,
    ):
        call_count = [0]

        def tq_side(table, workspace_id):
            chain = MagicMock()
            chain.eq.return_value = chain
            chain.order.return_value = chain
            chain.limit.return_value = chain
            chain.execute.return_value = MagicMock(data=[dataset_row] if table == "benchmark_datasets" else [])
            return chain

        mock_tq.side_effect = tq_side

        db = MagicMock()
        db.table.return_value = db
        db.insert.return_value = db
        db.update.return_value = db
        db.eq.return_value = db
        db.execute.return_value = MagicMock(data=[])
        mock_gc.return_value = db

        run_id = await run_benchmark("ws-1", "ds-1")

    assert isinstance(run_id, str)


@pytest.mark.asyncio
async def test_run_benchmark_raises_on_missing_dataset():
    with patch("services.eval.benchmark.tenant_query") as mock_tq:
        mock_tq.return_value = _make_chain([])
        with pytest.raises(ValueError, match="not found"):
            await run_benchmark("ws-1", "ds-missing")


@pytest.mark.asyncio
async def test_run_benchmark_processes_cases_sequentially():
    dataset_row = {"id": "ds-1", "workspace_id": "ws-1", "name": "D", "dataset_type": "custom"}
    cases = [
        {"id": "c1", "question": "Q1?", "document_ids": [], "workspace_id": "ws-1"},
        {"id": "c2", "question": "Q2?", "document_ids": [], "workspace_id": "ws-1"},
    ]

    from services.answer_generation.models import PreparedAnswerStream

    prepared = PreparedAnswerStream(
        conversation_id="conv-1",
        user_message_id="um-1",
        assistant_message_id="am-1",
        retrieval_run_id="rr-1",
        answer_run_id="ar-1",
        events=[],
    )

    with (
        patch("services.eval.benchmark.tenant_query") as mock_tq,
        patch("services.eval.benchmark.get_client") as mock_gc,
        patch("services.eval.benchmark.build_answer_stream", new_callable=AsyncMock, return_value=prepared),
        patch("services.eval.benchmark.run_eval_for_answer", new_callable=AsyncMock, return_value="eval-1"),
    ):
        def tq_side(table, workspace_id):
            chain = MagicMock()
            chain.eq.return_value = chain
            chain.order.return_value = chain
            chain.limit.return_value = chain
            if table == "benchmark_datasets":
                chain.execute.return_value = MagicMock(data=[dataset_row])
            elif table == "benchmark_cases":
                chain.execute.return_value = MagicMock(data=cases)
            else:
                chain.execute.return_value = MagicMock(data=[])
            return chain

        mock_tq.side_effect = tq_side

        db = MagicMock()
        db.table.return_value = db
        db.insert.return_value = db
        db.update.return_value = db
        db.eq.return_value = db
        db.select.return_value = db
        db.limit.return_value = db
        db.execute.return_value = MagicMock(data=[{"judge_overall": 80, "overall": 0.8}])
        mock_gc.return_value = db

        run_id = await run_benchmark("ws-1", "ds-1")

    assert isinstance(run_id, str)

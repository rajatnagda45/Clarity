"""
benchmark_execution — execute a benchmark dataset against the live system.

Reuses `services.eval.benchmark::run_benchmark` to iterate the dataset
sequentially. The tool waits for completion; for large datasets the
caller should run this in the background via the standard async path.
"""
from __future__ import annotations

import logging
from typing import Any

from services.agent_runtime.tools.base import ToolContext, ToolError, tool

logger = logging.getLogger(__name__)


@tool(
    "benchmark_execution",
    timeout_s=600.0,   # benchmarks can take minutes
    max_retries=1,
    backoff_base=2.0,
)
async def benchmark_execution(
    ctx: ToolContext,
    dataset_id: str,
) -> dict[str, Any]:
    if not dataset_id:
        raise ToolError("dataset_id is required", kind="fatal")

    from services.eval.benchmark import run_benchmark

    try:
        run_id = await run_benchmark(ctx.workspace_id, dataset_id)
    except Exception as exc:
        raise ToolError(f"benchmark_run_failed:{exc}", kind="retryable")

    if not run_id:
        return {"completed": False, "reason": "benchmark_returned_no_run_id"}

    from db.client import tenant_query
    try:
        rows = (
            tenant_query("benchmark_runs", ctx.workspace_id)
            .select("*")
            .eq("id", run_id)
            .execute()
        ).data or []
    except Exception as exc:
        raise ToolError(f"benchmark_read_failed:{exc}", kind="retryable")

    summary: dict[str, Any] = {"run_id": run_id, "completed": True}
    if rows:
        r = rows[0]
        summary.update({
            "status": r.get("status"),
            "total_cases": r.get("total_cases"),
            "completed_cases": r.get("completed_cases"),
            "failed_cases": r.get("failed_cases"),
            "avg_judge_overall": r.get("avg_judge_overall"),
            "avg_trust_confidence": r.get("avg_trust_confidence"),
            "avg_latency_ms": r.get("avg_latency_ms"),
        })

    ctx.memory.add(
        role="observation",
        content=(
            f"benchmark_execution dataset={dataset_id} run_id={run_id} "
            f"avg_judge={summary.get('avg_judge_overall')}"
        ),
        tool="benchmark_execution",
        metadata={"dataset_id": dataset_id, "run_id": run_id, "summary": summary},
    )

    return summary

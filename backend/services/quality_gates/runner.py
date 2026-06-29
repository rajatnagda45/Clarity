from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import uuid4

from db.client import get_client, tenant_query

logger = logging.getLogger(__name__)

_SUPPORTED_METRICS = {"judge_overall", "hallucination_risk", "trust", "latency_ms"}
_OPERATORS = {"gte", "lte", "gt", "lt"}


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _evaluate_rule(rule: dict, value: float | None) -> tuple[bool, str]:
    """Return (passed, note). Absent metric value counts as a fail."""
    if value is None:
        return False, f"{rule['metric']}: no value available"

    op = rule["operator"]
    threshold = float(rule["threshold"])
    metric = rule["metric"]
    passed = {
        "gte": value >= threshold,
        "lte": value <= threshold,
        "gt": value > threshold,
        "lt": value < threshold,
    }[op]
    symbol = {"gte": "≥", "lte": "≤", "gt": ">", "lt": "<"}[op]
    note = (
        f"{rule['name']}: {metric} {value:.2f} {'PASS' if passed else 'FAIL'} "
        f"(required {symbol} {threshold})"
    )
    return passed, note


def _extract_metric(benchmark_run: dict, metric: str) -> float | None:
    mapping = {
        "judge_overall": benchmark_run.get("avg_judge_overall"),
        "hallucination_risk": None,  # not aggregated at run level; would need a subquery
        "trust": benchmark_run.get("avg_trust_confidence"),
        "latency_ms": benchmark_run.get("avg_latency_ms"),
    }
    val = mapping.get(metric)
    if val is None:
        return None
    return float(val)


def create_rule(
    workspace_id: str,
    name: str,
    metric: str,
    operator: str,
    threshold: float,
) -> str:
    if metric not in _SUPPORTED_METRICS:
        raise ValueError(f"metric must be one of {_SUPPORTED_METRICS}")
    if operator not in _OPERATORS:
        raise ValueError(f"operator must be one of {_OPERATORS}")

    client = get_client()
    rule_id = str(uuid4())
    client.table("quality_gate_rules").insert({
        "id": rule_id,
        "workspace_id": workspace_id,
        "name": name,
        "metric": metric,
        "operator": operator,
        "threshold": threshold,
        "active": True,
        "created_at": _now_iso(),
    }).execute()
    return rule_id


def list_rules(workspace_id: str, active_only: bool = True) -> list[dict]:
    query = tenant_query("quality_gate_rules", workspace_id).order("created_at")
    if active_only:
        query = query.eq("active", True)
    return query.execute().data or []


def delete_rule(workspace_id: str, rule_id: str) -> None:
    get_client().table("quality_gate_rules").update({"active": False}).eq(
        "id", rule_id
    ).eq("workspace_id", workspace_id).execute()


def run_quality_gate(
    workspace_id: str,
    benchmark_run_id: str | None = None,
    experiment_id: str | None = None,
) -> dict:
    """Evaluate active rules against a benchmark run. Returns gate run row dict."""
    rules = list_rules(workspace_id)
    if not rules:
        logger.info("No active quality gate rules for workspace %s", workspace_id)

    benchmark_run: dict = {}
    if benchmark_run_id:
        result = (
            tenant_query("benchmark_runs", workspace_id)
            .eq("id", benchmark_run_id)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        benchmark_run = rows[0] if rows else {}

    details: list[dict] = []
    passed_count = 0
    failed_count = 0

    for rule in rules:
        metric_value = _extract_metric(benchmark_run, rule["metric"])
        passed, note = _evaluate_rule(rule, metric_value)
        details.append({
            "rule_id": rule["id"],
            "rule_name": rule["name"],
            "metric": rule["metric"],
            "passed": passed,
            "note": note,
        })
        if passed:
            passed_count += 1
        else:
            failed_count += 1

    overall_passed = failed_count == 0 and bool(rules)
    gate_run_id = str(uuid4())
    get_client().table("quality_gate_runs").insert({
        "id": gate_run_id,
        "workspace_id": workspace_id,
        "benchmark_run_id": benchmark_run_id,
        "experiment_id": experiment_id,
        "rules_evaluated": len(rules),
        "rules_passed": passed_count,
        "rules_failed": failed_count,
        "passed": overall_passed,
        "details": details,
        "created_at": _now_iso(),
    }).execute()

    return {
        "id": gate_run_id,
        "workspace_id": workspace_id,
        "benchmark_run_id": benchmark_run_id,
        "experiment_id": experiment_id,
        "rules_evaluated": len(rules),
        "rules_passed": passed_count,
        "rules_failed": failed_count,
        "passed": overall_passed,
        "details": details,
        "created_at": _now_iso(),
    }


def list_gate_runs(workspace_id: str, limit: int = 20) -> list[dict]:
    return (
        tenant_query("quality_gate_runs", workspace_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data or []
    )

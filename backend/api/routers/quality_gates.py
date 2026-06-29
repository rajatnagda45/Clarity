from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status

from api.deps import require_workspace_role
from schemas import (
    CreateQualityGateRuleRequest,
    QualityGateRuleResponse,
    QualityGateRunResponse,
    QualityGateRunListResponse,
    RunQualityGateRequest,
)
from services.quality_gates.runner import (
    create_rule,
    delete_rule,
    list_gate_runs,
    list_rules,
    run_quality_gate,
)

router = APIRouter(prefix="/api/quality-gates", tags=["quality-gates"])


def _error(code_: int, code: str, msg: str) -> HTTPException:
    return HTTPException(status_code=code_, detail={"code": code, "message": msg})


@router.get("/rules", response_model=list[QualityGateRuleResponse])
def list_rules_route(
    active_only: bool = True,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> list[QualityGateRuleResponse]:
    workspace_id, _ = membership
    rules = list_rules(workspace_id, active_only=active_only)
    return [_rule_to_response(r) for r in rules]


@router.post("/rules", response_model=QualityGateRuleResponse, status_code=status.HTTP_201_CREATED)
def create_rule_route(
    payload: CreateQualityGateRuleRequest,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> QualityGateRuleResponse:
    workspace_id, _ = membership
    try:
        rule_id = create_rule(
            workspace_id=workspace_id,
            name=payload.name,
            metric=payload.metric,
            operator=payload.operator,
            threshold=payload.threshold,
        )
    except ValueError as exc:
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_rule", str(exc)) from exc

    rules = list_rules(workspace_id, active_only=False)
    row = next((r for r in rules if r["id"] == rule_id), None)
    if not row:
        raise _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "create_failed", "Failed to create rule")
    return _rule_to_response(row)


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rule_route(
    rule_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> Response:
    workspace_id, _ = membership
    delete_rule(workspace_id, rule_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/run", response_model=QualityGateRunResponse, status_code=status.HTTP_202_ACCEPTED)
def run_gate(
    payload: RunQualityGateRequest,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> QualityGateRunResponse:
    workspace_id, _ = membership
    result = run_quality_gate(
        workspace_id=workspace_id,
        benchmark_run_id=payload.benchmark_run_id,
        experiment_id=payload.experiment_id,
    )
    return _run_to_response(result)


@router.get("/runs", response_model=QualityGateRunListResponse)
def list_runs_route(
    limit: int = 20,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> QualityGateRunListResponse:
    workspace_id, _ = membership
    runs = list_gate_runs(workspace_id, limit=limit)
    return QualityGateRunListResponse(
        runs=[_run_to_response(r) for r in runs],
        total=len(runs),
    )


def _rule_to_response(r: dict) -> QualityGateRuleResponse:
    return QualityGateRuleResponse(
        id=r["id"],
        workspace_id=r["workspace_id"],
        name=r["name"],
        metric=r["metric"],
        operator=r["operator"],
        threshold=float(r["threshold"]),
        active=r.get("active", True),
        created_at=r["created_at"],
    )


def _run_to_response(r: dict) -> QualityGateRunResponse:
    return QualityGateRunResponse(
        id=r["id"],
        workspace_id=r["workspace_id"],
        benchmark_run_id=r.get("benchmark_run_id"),
        experiment_id=r.get("experiment_id"),
        rules_evaluated=r.get("rules_evaluated", 0),
        rules_passed=r.get("rules_passed", 0),
        rules_failed=r.get("rules_failed", 0),
        passed=r.get("passed", False),
        details=r.get("details") or [],
        created_at=r["created_at"],
    )

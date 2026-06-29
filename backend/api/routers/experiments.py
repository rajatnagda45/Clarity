from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import require_workspace_role
from schemas import (
    CreateExperimentRequest,
    ExperimentResponse,
    ExperimentListResponse,
    AddCandidateRequest,
    ExperimentCandidateResponse,
)
from services.eval.experiments import (
    add_candidate,
    complete_experiment,
    create_experiment,
    get_experiment,
    list_experiments,
)

router = APIRouter(prefix="/api/experiments", tags=["experiments"])


def _error(code_: int, code: str, msg: str) -> HTTPException:
    return HTTPException(status_code=code_, detail={"code": code, "message": msg})


@router.get("", response_model=ExperimentListResponse)
def list_experiments_route(
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> ExperimentListResponse:
    workspace_id, _ = membership
    exps = list_experiments(workspace_id)
    return ExperimentListResponse(
        experiments=[_exp_to_response(e) for e in exps],
        total=len(exps),
    )


@router.post("", response_model=ExperimentResponse, status_code=status.HTTP_201_CREATED)
def create_experiment_route(
    payload: CreateExperimentRequest,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> ExperimentResponse:
    workspace_id, _ = membership
    exp_id = create_experiment(
        workspace_id=workspace_id,
        name=payload.name,
        description=payload.description,
    )
    exp = get_experiment(workspace_id, exp_id)
    if not exp:
        raise _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "create_failed", "Failed to create experiment")
    return _exp_to_response(exp)


@router.get("/{experiment_id}", response_model=ExperimentResponse)
def get_experiment_route(
    experiment_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> ExperimentResponse:
    workspace_id, _ = membership
    exp = get_experiment(workspace_id, experiment_id)
    if not exp:
        raise _error(status.HTTP_404_NOT_FOUND, "not_found", "Experiment not found")
    return _exp_to_response(exp)


@router.post("/{experiment_id}/candidates", response_model=ExperimentCandidateResponse, status_code=status.HTTP_201_CREATED)
def add_candidate_route(
    experiment_id: str,
    payload: AddCandidateRequest,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> ExperimentCandidateResponse:
    workspace_id, _ = membership
    cand_id = add_candidate(
        workspace_id=workspace_id,
        experiment_id=experiment_id,
        name=payload.name,
        prompt_version=payload.prompt_version,
        model_version=payload.model_version,
        writer_version=payload.writer_version,
    )
    return ExperimentCandidateResponse(
        id=cand_id,
        workspace_id=workspace_id,
        experiment_id=experiment_id,
        name=payload.name,
        prompt_version=payload.prompt_version,
        model_version=payload.model_version,
        writer_version=payload.writer_version,
        avg_judge_overall=None,
        avg_trust_confidence=None,
        eval_count=0,
        created_at="",
    )


@router.post("/{experiment_id}/complete", response_model=ExperimentResponse)
def complete_experiment_route(
    experiment_id: str,
    winner_candidate_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> ExperimentResponse:
    workspace_id, _ = membership
    complete_experiment(workspace_id, experiment_id, winner_candidate_id)
    exp = get_experiment(workspace_id, experiment_id)
    if not exp:
        raise _error(status.HTTP_404_NOT_FOUND, "not_found", "Experiment not found")
    return _exp_to_response(exp)


def _exp_to_response(exp) -> ExperimentResponse:
    from services.eval.models import Experiment
    if isinstance(exp, Experiment):
        return ExperimentResponse(
            id=exp.id,
            workspace_id=exp.workspace_id,
            name=exp.name,
            description=exp.description,
            status=exp.status,
            winner_candidate_id=exp.winner_candidate_id,
            candidates=[
                ExperimentCandidateResponse(
                    id=c.id,
                    workspace_id=c.workspace_id,
                    experiment_id=c.experiment_id,
                    name=c.name,
                    prompt_version=c.prompt_version,
                    model_version=c.model_version,
                    writer_version=c.writer_version,
                    avg_judge_overall=c.avg_judge_overall,
                    avg_trust_confidence=c.avg_trust_confidence,
                    eval_count=c.eval_count,
                    created_at=c.created_at,
                )
                for c in exp.candidates
            ],
            created_at=exp.created_at,
        )
    # dict path
    return ExperimentResponse(
        id=exp["id"],
        workspace_id=exp["workspace_id"],
        name=exp["name"],
        description=exp.get("description"),
        status=exp["status"],
        winner_candidate_id=exp.get("winner_candidate_id"),
        candidates=[],
        created_at=exp["created_at"],
    )

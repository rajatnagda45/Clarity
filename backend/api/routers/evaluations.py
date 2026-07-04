from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import require_workspace_role
from db.client import tenant_query
from schemas import (
    CitationAnalyticsResponse,
    ConversationEvalListResponse,
    ConversationEvalSummary,
    EvalRunListResponse,
    EvalRunResponse,
    QualityDashboardResponse,
    QualityRollupResponse,
    TrustAnalyticsResponse,
    TrustBandBreakdown,
    TrustVerdictBreakdown,
)
from services.eval.metrics import build_quality_trend, compute_quality_rollup

router = APIRouter(prefix="/api/evaluations", tags=["evaluations"])


def _error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


@router.get("", response_model=EvalRunListResponse)
def list_evals(
    limit: int = 20,
    offset: int = 0,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> EvalRunListResponse:
    workspace_id, _ = membership
    result = (
        tenant_query("answer_evals", workspace_id)
        .not_.is_("judge_overall", "null")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .select(
            "id,workspace_id,answer_run_id,judge_provider,judge_model,"
            "judge_prompt_version,judge_latency_ms,judge_faithfulness,"
            "judge_grounding,judge_completeness,judge_correctness,"
            "judge_clarity,judge_citation_quality,judge_hallucination_risk,"
            "judge_overall,judge_reasoning,created_at"
        )
        .execute()
    )
    rows = result.data or []
    evals = [_row_to_response(r) for r in rows]
    return EvalRunListResponse(evaluations=evals, total=len(evals))


@router.get("/{eval_id}", response_model=EvalRunResponse)
def get_eval(
    eval_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> EvalRunResponse:
    workspace_id, _ = membership
    result = (
        tenant_query("answer_evals", workspace_id)
        .eq("id", eval_id)
        .limit(1)
        .execute()
    )
    row = (result.data or [None])[0]
    if not row:
        raise _error(status.HTTP_404_NOT_FOUND, "eval_not_found", "Eval record not found.")
    return _row_to_response(row)


@router.get("/quality/dashboard", response_model=QualityDashboardResponse)
def quality_dashboard(
    days: int = 30,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> QualityDashboardResponse:
    workspace_id, _ = membership
    trend = build_quality_trend(workspace_id, days=days)
    rollups = [
        QualityRollupResponse(
            id=r.id,
            workspace_id=r.workspace_id,
            day=r.day,
            avg_faithfulness=r.avg_faithfulness,
            abstention_rate=r.abstention_rate,
            n=r.n,
            avg_judge_overall=r.avg_judge_overall,
            avg_hallucination_risk=r.avg_hallucination_risk,
            avg_confidence_score=r.avg_confidence_score,
            abstention_count=r.abstention_count,
            verification_pass_count=r.verification_pass_count,
            total_answers=r.total_answers,
        )
        for r in trend
    ]
    return QualityDashboardResponse(rollups=rollups, days=days)


@router.post("/quality/rollup", response_model=QualityRollupResponse)
def trigger_rollup(
    day: str | None = None,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> QualityRollupResponse:
    """Manually trigger a quality rollup computation for a given day (YYYY-MM-DD)."""
    workspace_id, _ = membership
    rollup = compute_quality_rollup(workspace_id, day=day)
    return QualityRollupResponse(
        id=rollup.id,
        workspace_id=rollup.workspace_id,
        day=rollup.day,
        avg_faithfulness=rollup.avg_faithfulness,
        abstention_rate=rollup.abstention_rate,
        n=rollup.n,
        avg_judge_overall=rollup.avg_judge_overall,
        avg_hallucination_risk=rollup.avg_hallucination_risk,
        avg_confidence_score=rollup.avg_confidence_score,
        abstention_count=rollup.abstention_count,
        verification_pass_count=rollup.verification_pass_count,
        total_answers=rollup.total_answers,
    )


@router.get("/analytics/citations", response_model=CitationAnalyticsResponse)
def citation_analytics(
    days: int = 30,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> CitationAnalyticsResponse:
    workspace_id, _ = membership

    citation_rows = (
        tenant_query("message_citations", workspace_id)
        .execute()
    ).data or []

    run_rows = (
        tenant_query("answer_runs", workspace_id)
        .not_.is_("answer_markdown", "null")
        .select("id,citation_count")
        .execute()
    ).data or []

    eval_rows = (
        tenant_query("answer_evals", workspace_id)
        .not_.is_("judge_citation_quality", "null")
        .select("judge_citation_quality")
        .execute()
    ).data or []

    total_citations = len(citation_rows)
    total_answers = len(run_rows)

    run_citation_counts: dict[str, int] = {}
    for c in citation_rows:
        run_id = str(c.get("answer_run_id", ""))
        run_citation_counts[run_id] = run_citation_counts.get(run_id, 0) + 1

    answers_with = sum(1 for r in run_rows if run_citation_counts.get(str(r["id"]), 0) > 0)
    answers_without = total_answers - answers_with
    avg_per_answer = (total_citations / total_answers) if total_answers > 0 else 0.0

    cq_scores = [float(r["judge_citation_quality"]) for r in eval_rows if r.get("judge_citation_quality") is not None]
    avg_cq = round(sum(cq_scores) / len(cq_scores), 2) if cq_scores else None

    buckets: dict[str, int] = {"1-3": 0, "4-6": 0, "7-8": 0, "9-10": 0}
    for s in cq_scores:
        if s <= 3:
            buckets["1-3"] += 1
        elif s <= 6:
            buckets["4-6"] += 1
        elif s <= 8:
            buckets["7-8"] += 1
        else:
            buckets["9-10"] += 1
    cq_distribution = [{"range": k, "count": v} for k, v in buckets.items()]

    doc_counts: dict[str, int] = {}
    for c in citation_rows:
        did = str(c.get("document_id", ""))
        if did:
            doc_counts[did] = doc_counts.get(did, 0) + 1
    top_docs = sorted(
        [{"documentId": k, "citationCount": v} for k, v in doc_counts.items()],
        key=lambda x: x["citationCount"],
        reverse=True,
    )[:10]

    return CitationAnalyticsResponse(
        total_citations=total_citations,
        answers_with_citations=answers_with,
        answers_without_citations=answers_without,
        avg_citations_per_answer=round(avg_per_answer, 2),
        avg_citation_quality_score=avg_cq,
        citation_quality_distribution=cq_distribution,
        top_cited_documents=top_docs,
    )


@router.get("/analytics/trust", response_model=TrustAnalyticsResponse)
def trust_analytics(
    days: int = 30,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> TrustAnalyticsResponse:
    workspace_id, _ = membership

    run_rows = (
        tenant_query("answer_runs", workspace_id)
        .not_.is_("answer_markdown", "null")
        .select("id,trust_overall,trust_faithfulness,trust_confidence,trust_confidence_band")
        .execute()
    ).data or []

    claim_rows = (
        tenant_query("claims", workspace_id)
        .select("ensemble_verdict")
        .execute()
    ).data or []

    abstention_rows = (
        tenant_query("abstentions", workspace_id)
        .select("id")
        .execute()
    ).data or []

    total = len(run_rows)
    abstention_count = len(abstention_rows)

    trust_vals = [float(r["trust_overall"]) for r in run_rows if r.get("trust_overall") is not None]
    faith_vals = [float(r["trust_faithfulness"]) for r in run_rows if r.get("trust_faithfulness") is not None]
    conf_vals = [float(r["trust_confidence"]) for r in run_rows if r.get("trust_confidence") is not None]

    def _avg(vals: list[float]) -> float | None:
        return round(sum(vals) / len(vals), 3) if vals else None

    verdicts = {"supported": 0, "unsupported": 0, "contradicted": 0, "unknown": 0}
    for c in claim_rows:
        v = (c.get("ensemble_verdict") or "unknown").lower()
        if v in verdicts:
            verdicts[v] += 1
        else:
            verdicts["unknown"] += 1

    bands: dict[str, int] = {"high": 0, "medium": 0, "low": 0}
    for r in run_rows:
        b = (r.get("trust_confidence_band") or "low").lower()
        if b in bands:
            bands[b] += 1

    bucket_size = 0.1
    hist_buckets: dict[str, int] = {}
    for v in trust_vals:
        b = f"{(int(v / bucket_size) * bucket_size):.1f}"
        hist_buckets[b] = hist_buckets.get(b, 0) + 1
    histogram = [{"bucket": k, "count": v} for k, v in sorted(hist_buckets.items())]

    return TrustAnalyticsResponse(
        total_answers=total,
        avg_trust_overall=_avg(trust_vals),
        avg_trust_faithfulness=_avg(faith_vals),
        avg_trust_confidence=_avg(conf_vals),
        abstention_count=abstention_count,
        abstention_rate=round(abstention_count / total, 3) if total > 0 else 0.0,
        verdict_breakdown=TrustVerdictBreakdown(**verdicts),
        confidence_band_breakdown=TrustBandBreakdown(**bands),
        trust_histogram=histogram,
    )


@router.get("/analytics/conversations", response_model=ConversationEvalListResponse)
def conversation_evals(
    limit: int = 20,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> ConversationEvalListResponse:
    workspace_id, _ = membership

    conv_rows = (
        tenant_query("conversations", workspace_id)
        .order("created_at", desc=True)
        .limit(limit)
        .select("id,created_at")
        .execute()
    ).data or []

    msg_rows = (
        tenant_query("messages", workspace_id)
        .eq("role", "assistant")
        .select("id,conversation_id")
        .execute()
    ).data or []

    run_rows = (
        tenant_query("answer_runs", workspace_id)
        .select("id,message_id,trust_overall,judge_overall,trust_faithfulness")
        .execute()
    ).data or []

    eval_rows = (
        tenant_query("answer_evals", workspace_id)
        .not_.is_("judge_overall", "null")
        .select("answer_run_id,judge_overall,judge_hallucination_risk,judge_citation_quality")
        .execute()
    ).data or []

    abstention_rows = (
        tenant_query("abstentions", workspace_id)
        .select("answer_run_id")
        .execute()
    ).data or []

    msg_to_conv: dict[str, str] = {str(m["id"]): str(m["conversation_id"]) for m in msg_rows}
    eval_map: dict[str, dict] = {str(e["answer_run_id"]): e for e in eval_rows}
    abstention_run_ids = {str(a["answer_run_id"]) for a in abstention_rows}

    conv_stats: dict[str, dict] = {}
    for run in run_rows:
        run_id = str(run["id"])
        msg_id = str(run.get("message_id") or "")
        conv_id = msg_to_conv.get(msg_id)
        if not conv_id:
            continue
        if conv_id not in conv_stats:
            conv_stats[conv_id] = {"trust": [], "judge": [], "halluc": [], "cq": [], "abstentions": 0}
        s = conv_stats[conv_id]
        if run.get("trust_overall") is not None:
            s["trust"].append(float(run["trust_overall"]))
        if run_id in abstention_run_ids:
            s["abstentions"] += 1
        ev = eval_map.get(run_id)
        if ev:
            if ev.get("judge_overall") is not None:
                s["judge"].append(float(ev["judge_overall"]))
            if ev.get("judge_hallucination_risk") is not None:
                s["halluc"].append(float(ev["judge_hallucination_risk"]))
            if ev.get("judge_citation_quality") is not None:
                s["cq"].append(float(ev["judge_citation_quality"]))

    def _avg_or_none(vals: list[float]) -> float | None:
        return round(sum(vals) / len(vals), 2) if vals else None

    msg_count_per_conv: dict[str, int] = {}
    for m in msg_rows:
        cid = str(m["conversation_id"])
        msg_count_per_conv[cid] = msg_count_per_conv.get(cid, 0) + 1

    summaries = []
    for conv in conv_rows:
        conv_id = str(conv["id"])
        s = conv_stats.get(conv_id, {"trust": [], "judge": [], "halluc": [], "cq": [], "abstentions": 0})
        summaries.append(ConversationEvalSummary(
            conversation_id=conv_id,
            message_count=msg_count_per_conv.get(conv_id, 0),
            avg_judge_overall=_avg_or_none(s["judge"]),
            avg_trust_overall=_avg_or_none(s["trust"]),
            avg_hallucination_risk=_avg_or_none(s["halluc"]),
            avg_citation_quality=_avg_or_none(s["cq"]),
            abstention_count=s["abstentions"],
            created_at=conv["created_at"],
        ))

    return ConversationEvalListResponse(conversations=summaries, total=len(summaries))


def _row_to_response(r: dict) -> EvalRunResponse:
    scores = None
    if r.get("judge_overall") is not None:
        from schemas import JudgeScoresResponse
        scores = JudgeScoresResponse(
            faithfulness=r.get("judge_faithfulness"),
            grounding=r.get("judge_grounding"),
            completeness=r.get("judge_completeness"),
            correctness=r.get("judge_correctness"),
            clarity=r.get("judge_clarity"),
            citation_quality=r.get("judge_citation_quality"),
            hallucination_risk=r.get("judge_hallucination_risk"),
            overall=r["judge_overall"],
            reasoning=r.get("judge_reasoning"),
        )
    return EvalRunResponse(
        id=r["id"],
        workspace_id=r["workspace_id"],
        answer_run_id=r.get("answer_run_id"),
        judge_provider=r.get("judge_provider"),
        judge_model=r.get("judge_model"),
        judge_prompt_version=r.get("judge_prompt_version"),
        judge_latency_ms=r.get("judge_latency_ms"),
        scores=scores,
        created_at=r["created_at"],
    )

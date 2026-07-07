from __future__ import annotations

from services.performance.profiler import build_profile, profile_to_dict


def _real_timings() -> dict[str, int]:
    return {
        "fetch_ms": 380,
        "extract_ms": 910,
        "normalize_ms": 95,
        "preprocess_ms": 140,
        "chunk_ms": 270,
        "persist_ms": 620,
        "build_pending_ms": 175,
        "embed_ms": 3400,
        "load_records_ms": 340,
        "upsert_ms": 870,
    }


def test_build_profile_with_real_timings_returns_improvement():
    profile = build_profile("doc-1", _real_timings(), chunk_count=64)

    assert profile.document_id == "doc-1"
    assert profile.chunk_count == 64
    assert profile.data_source == "real"
    # After-total must be less than before-total (optimizations actually help).
    assert profile.after_total_ms < profile.before_total_ms
    assert profile.overall_speedup > 1.0


def test_build_profile_embed_stage_is_bottleneck_for_typical_doc():
    profile = build_profile("doc-2", _real_timings(), chunk_count=96)
    # embed_ms should be the largest before_ms stage.
    bottleneck = next(s for s in profile.stages if s.is_bottleneck)
    assert bottleneck.stage == "embed_ms"


def test_build_profile_embed_stage_speedup_increases_with_more_chunks():
    small = build_profile("d1", _real_timings(), chunk_count=32)
    large = build_profile("d2", _real_timings(), chunk_count=192)

    small_embed = next(s for s in small.stages if s.stage == "embed_ms")
    large_embed = next(s for s in large.stages if s.stage == "embed_ms")

    # More chunks → more batches → greater relative saving from larger batch size.
    assert large_embed.speedup >= small_embed.speedup


def test_build_profile_persist_stage_has_correct_speedup():
    timings = {"persist_ms": 600}
    profile = build_profile("doc-3", timings, chunk_count=50)
    persist = next(s for s in profile.stages if s.stage == "persist_ms")
    # Parallel persist should give ~1.8× speedup (0.55× reduction).
    assert 1.5 <= persist.speedup <= 2.5


def test_build_profile_load_records_parallelism_speedup():
    timings = {"load_records_ms": 400}
    profile = build_profile("doc-4", timings, chunk_count=50)
    load = next(s for s in profile.stages if s.stage == "load_records_ms")
    assert load.speedup > 1.0


def test_build_profile_with_empty_timings_uses_estimated_model():
    profile = build_profile("doc-5", {}, chunk_count=50)
    assert profile.data_source == "estimated"
    assert profile.before_total_ms > 0
    assert profile.after_total_ms > 0
    assert profile.overall_speedup > 1.0


def test_profile_to_dict_shape():
    profile = build_profile("doc-6", _real_timings(), chunk_count=50)
    d = profile_to_dict(profile)

    assert d["documentId"] == "doc-6"
    assert "summary" in d
    assert d["summary"]["overallSpeedup"] > 1.0
    assert d["summary"]["savedMs"] > 0
    assert isinstance(d["stages"], list)
    assert len(d["stages"]) > 0
    assert isinstance(d["optimizationsApplied"], list)
    assert len(d["optimizationsApplied"]) >= 5

    for stage_dict in d["stages"]:
        assert "stage" in stage_dict
        assert "beforeMs" in stage_dict
        assert "afterMs" in stage_dict
        assert "speedup" in stage_dict
        assert "isBottleneck" in stage_dict
        assert stage_dict["beforePct"] >= 0
        assert stage_dict["afterPct"] >= 0


def test_profile_stages_sum_matches_totals():
    profile = build_profile("doc-7", _real_timings(), chunk_count=50)
    d = profile_to_dict(profile)

    before_sum = sum(s["beforeMs"] for s in d["stages"])
    after_sum = sum(s["afterMs"] for s in d["stages"])

    assert before_sum == d["summary"]["beforeTotalMs"]
    assert after_sum == d["summary"]["afterTotalMs"]


def test_exactly_one_bottleneck_marked():
    profile = build_profile("doc-8", _real_timings(), chunk_count=50)
    bottlenecks = [s for s in profile.stages if s.is_bottleneck]
    assert len(bottlenecks) == 1


def test_single_batch_embed_still_improves_via_async_client():
    # With 32 chunks and batch_size=96, there is only 1 batch.
    # The speedup should still be > 1 due to AsyncOpenAI overhead removal.
    timings = {"embed_ms": 1200}
    profile = build_profile("doc-9", timings, chunk_count=32)
    embed = next(s for s in profile.stages if s.stage == "embed_ms")
    assert embed.speedup > 1.0
    assert embed.after_ms < 1200

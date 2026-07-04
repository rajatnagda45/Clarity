from __future__ import annotations

import json
import pickle
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest


# ---------------------------------------------------------------------------
# Confidence blending
# ---------------------------------------------------------------------------

def test_blend_confidence_returns_float_in_unit_interval():
    from services.verification.confidence import blend_confidence

    claims = [
        {
            "id": "c1",
            "text": "Renewal is annual.",
            "span_ids": ["chk-1"],
            "supported": True,
            "uncertain": False,
            "entailment_label": "entail",
            "entailment_score": 0.92,
            "confidence": None,
        }
    ]
    spans = [
        {
            "chunk_id": "chk-1",
            "document_id": "doc-1",
            "page": 1,
            "char_start": 0,
            "char_end": 50,
            "text": "The agreement renews annually.",
            "rerank_score": 0.85,
        }
    ]
    with patch("services.verification.confidence.calibrator_module.calibrate", side_effect=lambda x: x):
        score = blend_confidence(claims, spans)

    assert 0.0 <= score <= 1.0


def test_blend_confidence_unsupported_claim_lowers_score():
    from services.verification.confidence import blend_confidence

    supported_claims = [
        {
            "id": "c1",
            "text": "A.",
            "span_ids": ["chk-1"],
            "supported": True,
            "uncertain": False,
            "entailment_label": "entail",
            "entailment_score": 0.92,
            "confidence": None,
        }
    ]
    unsupported_claims = [
        {
            "id": "c1",
            "text": "A.",
            "span_ids": ["chk-1"],
            "supported": False,
            "uncertain": True,
            "entailment_label": "contradict",
            "entailment_score": 0.20,
            "confidence": None,
        }
    ]
    spans = [
        {
            "chunk_id": "chk-1",
            "document_id": "doc-1",
            "page": 1,
            "char_start": 0,
            "char_end": 50,
            "text": "Text.",
            "rerank_score": 0.80,
        }
    ]
    with patch("services.verification.confidence.calibrator_module.calibrate", side_effect=lambda x: x):
        high = blend_confidence(supported_claims, spans)
        low = blend_confidence(unsupported_claims, spans)

    assert high > low


# ---------------------------------------------------------------------------
# Calibrator loading
# ---------------------------------------------------------------------------

def test_calibrator_passthrough_when_no_pkl():
    import services.verification.calibrator as cal_module

    with patch.object(cal_module, "_PKL_PATH", Path("/nonexistent/calibrator.pkl")):
        cal_module._calibrator = None
        cal_module.load_calibrator()
        result = cal_module.calibrate(0.75)

    assert result == 0.75


def test_calibrator_loads_and_transforms():
    """Fit a trivial isotonic calibrator, save it, load it, verify transform works."""
    pytest.importorskip("sklearn")
    from sklearn.isotonic import IsotonicRegression  # type: ignore[import]
    import services.verification.calibrator as cal_module

    ir = IsotonicRegression(out_of_bounds="clip")
    ir.fit([0.0, 0.5, 1.0], [0.0, 0.5, 1.0])

    with tempfile.NamedTemporaryFile(suffix=".pkl", delete=False) as f:
        pickle.dump(ir, f)
        pkl_path = Path(f.name)

    with patch.object(cal_module, "_PKL_PATH", pkl_path):
        cal_module._calibrator = None
        cal_module.load_calibrator()
        result = cal_module.calibrate(0.90)

    assert 0.0 <= result <= 1.0
    pkl_path.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Calibrator fitting script (smoke test)
# ---------------------------------------------------------------------------

def test_fit_calibrator_script_runs_on_fixture_cases():
    pytest.importorskip("sklearn")
    from scripts.fit_calibrator import fit

    cases = [
        {"raw_score": i / 10, "is_correct": i >= 5}
        for i in range(10)
    ]
    with tempfile.TemporaryDirectory() as cases_dir, tempfile.TemporaryDirectory() as out_dir:
        cases_path = Path(cases_dir)
        out_path = Path(out_dir) / "calibrator.pkl"
        for idx, case in enumerate(cases):
            (cases_path / f"case_{idx:03d}.json").write_text(json.dumps(case))
        fit(cases_path, out_path)
        assert out_path.exists()
        with out_path.open("rb") as f:
            loaded = pickle.load(f)  # noqa: S301
        assert hasattr(loaded, "transform")
        result = loaded.transform([0.9])
        assert 0.0 <= float(result[0]) <= 1.0


def test_committed_calibrator_pkl_is_present_and_functional():
    """
    Verifies that the fitted calibrator.pkl is committed to the repo and loads
    correctly. If this test fails it means either the pkl was not committed or
    was deleted — run scripts/fit_calibrator.py to regenerate it.
    """
    pytest.importorskip("sklearn")
    import services.verification.calibrator as cal_module

    canonical_pkl = Path(__file__).parent.parent / "services/verification/calibrator.pkl"
    assert canonical_pkl.exists(), (
        f"calibrator.pkl not found at {canonical_pkl}. "
        "Run: python -m scripts.fit_calibrator "
        "--cases backend/services/eval/golden/cases "
        "--out backend/services/verification/calibrator.pkl"
    )

    with patch.object(cal_module, "_PKL_PATH", canonical_pkl):
        cal_module._calibrator = None
        cal_module.load_calibrator()

        # A raw score of 0.95 (all claims supported, strong entailment) should
        # calibrate to high confidence.
        high = cal_module.calibrate(0.95)
        # A raw score of 0.08 (all claims unsupported, contradicted) should
        # calibrate to near zero.
        low = cal_module.calibrate(0.08)

    assert 0.0 <= low <= high <= 1.0
    assert high > 0.5, "High-confidence raw score should calibrate above 0.5"
    assert low < 0.5, "Low-confidence raw score should calibrate below 0.5"

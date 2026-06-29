"""
Offline calibrator fitting script.

Usage:
    python -m scripts.fit_calibrator --cases backend/services/eval/golden/cases \
                                     --out backend/services/verification/calibrator.pkl

Reads golden cases (JSON files with fields: raw_score, is_correct).
Splits 70/30 train/test.
Fits sklearn IsotonicRegression on the training split.
Reports ECE on the test split.
Saves the fitted calibrator to --out.

Run once after authoring the golden set, then commit calibrator.pkl.
"""
from __future__ import annotations

import argparse
import json
import logging
import math
import pickle
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _load_cases(cases_dir: Path) -> list[dict]:
    cases: list[dict] = []
    for path in sorted(cases_dir.glob("*.json")):
        with path.open() as f:
            case = json.load(f)
        if "raw_score" in case and "is_correct" in case:
            cases.append(case)
    return cases


def _compute_ece(raw_scores: list[float], is_correct: list[bool], n_bins: int = 10) -> float:
    n = len(raw_scores)
    if n == 0:
        return 0.0
    bin_size = 1.0 / n_bins
    ece = 0.0
    for b in range(n_bins):
        lo = b * bin_size
        hi = lo + bin_size
        in_bin = [(s, c) for s, c in zip(raw_scores, is_correct) if lo <= s < hi]
        if not in_bin:
            continue
        avg_conf = sum(s for s, _ in in_bin) / len(in_bin)
        avg_acc = sum(1 for _, c in in_bin if c) / len(in_bin)
        ece += (len(in_bin) / n) * abs(avg_conf - avg_acc)
    return ece


def fit(cases_dir: Path, out_path: Path) -> None:
    try:
        from sklearn.isotonic import IsotonicRegression  # type: ignore[import]
    except ImportError:
        raise SystemExit("sklearn required: pip install scikit-learn")

    cases = _load_cases(cases_dir)
    if len(cases) < 10:
        raise SystemExit(
            f"Need at least 10 calibration cases; found {len(cases)} in {cases_dir}. "
            "Author more golden cases before fitting."
        )

    raw_scores = [float(c["raw_score"]) for c in cases]
    is_correct = [bool(c["is_correct"]) for c in cases]

    split = math.ceil(len(cases) * 0.70)
    train_x, train_y = raw_scores[:split], is_correct[:split]
    test_x, test_y = raw_scores[split:], is_correct[split:]

    calibrator = IsotonicRegression(out_of_bounds="clip")
    calibrator.fit(train_x, [float(y) for y in train_y])

    ece_before = _compute_ece(test_x, test_y)
    calibrated_scores = list(calibrator.transform(test_x))
    ece_after = _compute_ece(calibrated_scores, test_y)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("wb") as f:
        pickle.dump(calibrator, f)

    logger.info("Calibrator fitted on %d cases (%d train, %d test)", len(cases), split, len(test_x))
    logger.info("ECE before calibration: %.4f", ece_before)
    logger.info("ECE after calibration:  %.4f", ece_after)
    logger.info("Saved to %s", out_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Fit isotonic calibrator from golden cases.")
    parser.add_argument("--cases", type=Path, required=True, help="Path to golden cases directory")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("backend/services/verification/calibrator.pkl"),
        help="Output path for calibrator.pkl",
    )
    args = parser.parse_args()
    fit(args.cases, args.out)


if __name__ == "__main__":
    main()

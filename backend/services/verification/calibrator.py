"""
Isotonic regression calibrator for trust scores.

Loaded once at module import from `calibrator.pkl` (relative to this file's
parent or the path in CALIBRATOR_PATH env var).  If the file is missing the
module logs a warning and returns raw scores unchanged — the pipeline never
crashes due to a missing calibrator.
"""
from __future__ import annotations

import logging
import os
import pickle
from pathlib import Path

logger = logging.getLogger(__name__)

_calibrator = None
_calibrator_loaded = False

# Public path reference used by tests and the fit_calibrator script
_PKL_PATH = Path(__file__).parent / "calibrator.pkl"


def load_calibrator() -> None:
    """Public alias for _load_calibrator() — used by tests that patch _PKL_PATH."""
    global _calibrator, _calibrator_loaded
    _calibrator_loaded = False  # force reload
    _load_calibrator()


def _load_calibrator():
    global _calibrator, _calibrator_loaded
    if _calibrator_loaded:
        return

    path_override = os.getenv("CALIBRATOR_PATH", "")
    candidates = (
        [Path(path_override)]
        if path_override
        else [
            _PKL_PATH,  # respects test patches to _PKL_PATH
            Path(__file__).parent.parent.parent / "calibrator.pkl",
        ]
    )

    for path in candidates:
        if path.exists():
            try:
                with open(path, "rb") as f:
                    _calibrator = pickle.load(f)
                logger.info("Calibrator loaded from %s", path)
                break
            except Exception as exc:
                logger.warning("Failed to load calibrator at %s: %s", path, exc)

    if _calibrator is None:
        logger.warning(
            "calibrator.pkl not found — trust scores are uncalibrated. "
            "Run the calibration script to generate it."
        )

    _calibrator_loaded = True


def calibrate(raw_score: float) -> float:
    """
    Map a raw [0, 1] trust score to a calibrated probability.
    Falls through to the identity function if no calibrator is available.
    """
    _load_calibrator()
    if _calibrator is None:
        return max(0.0, min(1.0, raw_score))
    try:
        result = _calibrator.predict([[raw_score]])[0]
        return float(max(0.0, min(1.0, result)))
    except Exception as exc:
        logger.warning("Calibrator predict() failed: %s", exc)
        return max(0.0, min(1.0, raw_score))

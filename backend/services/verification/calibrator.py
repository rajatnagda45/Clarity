from __future__ import annotations

import logging
import os
import pickle
from pathlib import Path
from typing import Protocol

logger = logging.getLogger(__name__)

_PKL_PATH = Path(__file__).parent / "calibrator.pkl"


class _Calibrator(Protocol):
    def transform(self, X: list[float]) -> list[float]: ...


class _PassthroughCalibrator:
    """Used when no fitted calibrator.pkl exists."""

    def transform(self, X: list[float]) -> list[float]:
        return X


_calibrator: _Calibrator | None = None


def load_calibrator() -> None:
    """Call once from FastAPI lifespan; loads calibrator.pkl if present."""
    global _calibrator
    if _PKL_PATH.exists():
        with _PKL_PATH.open("rb") as f:
            _calibrator = pickle.load(f)  # noqa: S301
        logger.info("Loaded isotonic calibrator from %s", _PKL_PATH)
    else:
        logger.warning(
            "calibrator.pkl not found at %s — using pass-through. "
            "Run scripts/fit_calibrator.py after authoring the golden set.",
            _PKL_PATH,
        )
        _calibrator = _PassthroughCalibrator()


def calibrate(raw_score: float) -> float:
    """Map a raw blended score to a calibrated confidence."""
    if _calibrator is None:
        load_calibrator()
    result = _calibrator.transform([raw_score])  # type: ignore[union-attr]
    return float(result[0])

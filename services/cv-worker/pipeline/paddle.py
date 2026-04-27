# services/cv-worker/pipeline/paddle.py
# PaddleOCR wrapper — produces text-line candidates from a decoded RGB image.
# Lazy-instantiates the OCR engine; the model load is several seconds, so we
# cache one instance per process.

from __future__ import annotations

import logging
import threading
from typing import Any, List

import numpy as np

from schemas import TextLineCandidate

logger = logging.getLogger(__name__)

_OCR_LOCK = threading.Lock()
_OCR_INSTANCE: Any = None


def _get_ocr() -> Any:
    """Return a process-wide PaddleOCR instance, loading it on first call."""
    global _OCR_INSTANCE
    with _OCR_LOCK:
        if _OCR_INSTANCE is None:
            try:
                # Imported lazily so unit tests that stub `detect_text_lines`
                # don't need PaddleOCR + its 200 MB model cache installed.
                from paddleocr import PaddleOCR  # type: ignore[import-not-found]
            except ImportError as exc:  # pragma: no cover — production-only path
                raise RuntimeError(
                    "paddleocr is not installed; install via requirements.txt"
                ) from exc
            logger.info("loading PaddleOCR model (first request only)")
            _OCR_INSTANCE = PaddleOCR(
                use_angle_cls=False,
                lang="en",
                show_log=False,
                # Determinism: PaddleOCR uses deterministic CPU inference by
                # default. No `use_gpu`, no random augmentation.
            )
    return _OCR_INSTANCE


def detect_text_lines(image_rgb: np.ndarray) -> List[TextLineCandidate]:
    """
    Run PaddleOCR detection + recognition on the given RGB image.

    Returns a list of TextLineCandidate sorted deterministically by
    (polygon top-left y, top-left x) so identical input → identical output.
    """
    ocr = _get_ocr()
    raw = ocr.ocr(image_rgb, cls=False)
    if not raw or raw[0] is None:
        return []

    candidates: List[TextLineCandidate] = []
    for line in raw[0]:
        # PaddleOCR returns [[polygon], (text, confidence)] per line.
        if not line or len(line) < 2:
            continue
        polygon, recognition = line
        if not recognition or len(recognition) < 2:
            continue
        text, confidence = recognition[0], recognition[1]
        polygon_px = [[int(round(p[0])), int(round(p[1]))] for p in polygon]
        candidates.append(
            TextLineCandidate(
                polygonPx=polygon_px,
                text=str(text),
                confidence=float(confidence),
            )
        )

    candidates.sort(key=lambda c: (c["polygonPx"][0][1], c["polygonPx"][0][0]))
    return candidates

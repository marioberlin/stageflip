# services/cv-worker/pipeline/sam2.py
# SAM 2 wrapper — gated by ENABLE_SAM2 env var. v1 ships PaddleOCR + OpenCV
# only; SAM 2 lands as a follow-on commit when the deterministic-matching
# false-negative rate justifies the +2 GB image size. The HTTP response's
# `masks` field stays optional, so flipping the env var doesn't break clients.

from __future__ import annotations

import logging
import os
import threading
from typing import Any, List

import numpy as np

from schemas import MaskCandidate

logger = logging.getLogger(__name__)

_SAM_LOCK = threading.Lock()
_SAM_INSTANCE: Any = None


def is_enabled() -> bool:
    """Return True iff ENABLE_SAM2 is set to a truthy value."""
    raw = os.environ.get("ENABLE_SAM2", "false").strip().lower()
    return raw in ("1", "true", "yes", "on")


def _get_sam() -> Any:
    """Return a process-wide SAM 2 predictor, loading it on first call."""
    global _SAM_INSTANCE
    with _SAM_LOCK:
        if _SAM_INSTANCE is None:
            try:
                from sam2.build_sam import build_sam2  # type: ignore[import-not-found]
                from sam2.sam2_image_predictor import SAM2ImagePredictor  # type: ignore[import-not-found]
            except ImportError as exc:  # pragma: no cover — opt-in path
                raise RuntimeError(
                    "sam2 is not installed; ENABLE_SAM2=true requires the optional "
                    "dependency block (rebuild image with --build-arg ENABLE_SAM2=true)"
                ) from exc
            checkpoint = os.environ.get("SAM2_CHECKPOINT", "/opt/sam2/sam2_hiera_small.pt")
            config = os.environ.get("SAM2_CONFIG", "sam2_hiera_s.yaml")
            logger.info("loading SAM 2 model (first request only)")
            model = build_sam2(config, checkpoint, device="cpu")
            _SAM_INSTANCE = SAM2ImagePredictor(model)
    return _SAM_INSTANCE


def detect_masks(image_rgb: np.ndarray) -> List[MaskCandidate]:
    """
    Run SAM 2 automatic-mask generation on the given RGB image.

    Returns a list of MaskCandidate sorted deterministically by
    (bboxPx.y, bboxPx.x). When ENABLE_SAM2 is false, callers should NOT
    invoke this function — the orchestrator gates on `is_enabled()` and
    omits the `masks` field entirely from the response.
    """
    if not is_enabled():
        # Defensive — orchestrator should have gated already.
        return []

    predictor = _get_sam()
    predictor.set_image(image_rgb)
    # Auto-mask: returns N masks with bboxes. SAM 2's auto-mask generator is
    # deterministic on CPU with fixed input; no random sampling.
    masks = predictor.generate(image_rgb)  # API surface placeholder

    candidates: List[MaskCandidate] = []
    for mask in masks:
        bbox = mask.get("bbox")
        if not bbox or len(bbox) != 4:
            continue
        x, y, w, h = (int(v) for v in bbox)
        rle = mask.get("segmentation_rle")
        candidate: MaskCandidate = {
            "bboxPx": {"x": x, "y": y, "width": w, "height": h},
            "confidence": float(mask.get("predicted_iou", 0.0)),
        }
        if isinstance(rle, str):
            candidate["rle"] = rle
        candidates.append(candidate)

    candidates.sort(key=lambda c: (c["bboxPx"]["y"], c["bboxPx"]["x"]))
    return candidates

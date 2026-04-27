# services/cv-worker/pipeline/compose.py
# Pipeline orchestrator — runs PaddleOCR + OpenCV (+ SAM 2 if enabled) over a
# decoded slide image and returns the CvCandidates JSON shape.
#
# PaddleOCR + OpenCV release the GIL during inference, so we run them in a
# ThreadPoolExecutor for parallelism. Determinism is preserved because each
# stage is independently deterministic on a fixed input — concurrency just
# changes wall-clock, not output bytes.

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

import numpy as np

from schemas import CvCandidates

from . import opencv, paddle, sam2

logger = logging.getLogger(__name__)


def detect_candidates(
    image_rgba: np.ndarray,
    *,
    executor: Optional[ThreadPoolExecutor] = None,
) -> CvCandidates:
    """
    Run the full CV pipeline on a decoded RGBA slide image.

    Args:
      image_rgba: HxWx4 numpy array, uint8.
      executor: optional shared thread pool. If None, a new pool is created
                per request (acceptable for low QPS).

    Returns:
      CvCandidates dict matching the TS-side Zod validator. The `masks` key
      is OMITTED (not set to []) when SAM 2 is disabled.
    """
    if image_rgba.ndim != 3 or image_rgba.shape[2] != 4:
        raise ValueError("image_rgba must be HxWx4 uint8")

    image_rgb = image_rgba[..., :3]
    sam_enabled = sam2.is_enabled()

    own_executor = executor is None
    pool = executor or ThreadPoolExecutor(max_workers=3)
    try:
        text_future = pool.submit(paddle.detect_text_lines, image_rgb)
        contour_future = pool.submit(opencv.detect_contours, image_rgba)
        mask_future = pool.submit(sam2.detect_masks, image_rgb) if sam_enabled else None

        text_lines = text_future.result()
        contours = contour_future.result()
        masks = mask_future.result() if mask_future is not None else None
    finally:
        if own_executor:
            pool.shutdown(wait=True)

    result: CvCandidates = {
        "textLines": text_lines,
        "contours": contours,
    }
    if sam_enabled:
        result["masks"] = masks or []
    return result

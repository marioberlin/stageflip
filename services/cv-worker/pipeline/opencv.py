# services/cv-worker/pipeline/opencv.py
# OpenCV wrapper — produces shape (contour) candidates by combining
# connected-components and contour approximation.

from __future__ import annotations

import logging
from typing import List, Tuple

import cv2
import numpy as np

from schemas import ContourCandidate, ShapeKind

logger = logging.getLogger(__name__)

# Minimum contour area in pixels — below this we treat the region as noise.
# A 5x5 box is the smallest meaningful slide element.
MIN_CONTOUR_AREA_PX = 25

# approxPolyDP epsilon factor — 2% of perimeter is the standard rule of thumb
# for shape classification on rasterized vector primitives.
APPROX_EPSILON_FACTOR = 0.02


def _classify_shape(contour: np.ndarray, bbox: Tuple[int, int, int, int]) -> ShapeKind:
    """Classify a contour into rect / rounded-rect / ellipse / polygon."""
    perimeter = cv2.arcLength(contour, closed=True)
    if perimeter == 0:
        return "polygon"
    epsilon = APPROX_EPSILON_FACTOR * perimeter
    approx = cv2.approxPolyDP(contour, epsilon, closed=True)
    vertices = len(approx)
    x, y, w, h = bbox
    if w == 0 or h == 0:
        return "polygon"
    contour_area = cv2.contourArea(contour)
    bbox_area = float(w * h)
    fill_ratio = contour_area / bbox_area if bbox_area > 0 else 0.0

    if vertices == 4:
        # 4-sided polygon: rect if its corners are right angles. Approximate
        # via fill_ratio — a true rect fills its bbox fully.
        if fill_ratio > 0.92:
            return "rect"
        return "rounded-rect"
    if vertices > 6 and fill_ratio > 0.65:
        return "ellipse"
    return "polygon"


def _sample_fill(image_rgba: np.ndarray, bbox: Tuple[int, int, int, int]) -> List[int]:
    """Sample the median RGBA color from the bbox interior."""
    x, y, w, h = bbox
    h_img, w_img = image_rgba.shape[:2]
    # Sample a small window at the bbox center to avoid edge antialiasing.
    cx = max(0, min(w_img - 1, x + w // 2))
    cy = max(0, min(h_img - 1, y + h // 2))
    half = max(1, min(w, h) // 8)
    x0 = max(0, cx - half)
    x1 = min(w_img, cx + half + 1)
    y0 = max(0, cy - half)
    y1 = min(h_img, cy + half + 1)
    region = image_rgba[y0:y1, x0:x1]
    if region.size == 0:
        return [0, 0, 0, 255]
    median = np.median(region.reshape(-1, region.shape[-1]), axis=0)
    return [int(round(c)) for c in median.tolist()]


def detect_contours(image_rgba: np.ndarray) -> List[ContourCandidate]:
    """
    Detect shape candidates via Canny + findContours.

    Returns a list of ContourCandidate sorted deterministically by
    (bboxPx.y, bboxPx.x) for byte-stable JSON output.
    """
    if image_rgba.ndim != 3 or image_rgba.shape[2] not in (3, 4):
        raise ValueError("image must be HxWx3 or HxWx4")

    if image_rgba.shape[2] == 3:
        rgba = np.dstack(
            [image_rgba, np.full(image_rgba.shape[:2], 255, dtype=image_rgba.dtype)]
        )
    else:
        rgba = image_rgba

    gray = cv2.cvtColor(rgba, cv2.COLOR_RGBA2GRAY)
    # Bilateral filter denoises while preserving edges — deterministic kernel.
    smoothed = cv2.bilateralFilter(gray, d=5, sigmaColor=50, sigmaSpace=50)
    edges = cv2.Canny(smoothed, threshold1=50, threshold2=150)
    # Dilate so close edges form a single contour.
    kernel = np.ones((3, 3), dtype=np.uint8)
    dilated = cv2.dilate(edges, kernel, iterations=1)
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    candidates: List[ContourCandidate] = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < MIN_CONTOUR_AREA_PX:
            continue
        x, y, w, h = cv2.boundingRect(contour)
        bbox = (int(x), int(y), int(w), int(h))
        shape_kind = _classify_shape(contour, bbox)
        fill_sample = _sample_fill(rgba, bbox)
        candidates.append(
            ContourCandidate(
                bboxPx={"x": int(x), "y": int(y), "width": int(w), "height": int(h)},
                shapeKind=shape_kind,
                fillSample=fill_sample,
                confidence=float(min(1.0, area / max(rgba.shape[0] * rgba.shape[1] * 0.25, 1.0) + 0.5)),
            )
        )

    candidates.sort(key=lambda c: (c["bboxPx"]["y"], c["bboxPx"]["x"]))
    return candidates

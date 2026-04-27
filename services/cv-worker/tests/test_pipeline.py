# services/cv-worker/tests/test_pipeline.py
# AC #6-#11: pipeline-stage unit tests. PaddleOCR + SAM 2 are heavy and not
# guaranteed installed in every CI environment; we test:
#   * the OpenCV stage (lightweight, deterministic)
#   * the orchestrator with both upstream stages stubbed
#   * the SAM 2 gate (env-var-driven, no model loaded)
# PaddleOCR-on-real-text is exercised via an integration harness invoked when
# `PADDLEOCR_INSTALLED=1` is set in the environment — see
# test_pipeline_paddleocr_optional below.

from __future__ import annotations

import os
from typing import Any, List

import numpy as np
import pytest
from PIL import Image, ImageDraw

from pipeline import compose, opencv as opencv_stage, sam2 as sam2_stage
from schemas import ContourCandidate, CvCandidates, MaskCandidate, TextLineCandidate


# ---------------------------------------------------------------------------
# OpenCV stage
# ---------------------------------------------------------------------------


def _rect_image() -> np.ndarray:
    img = Image.new("RGBA", (320, 180), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle((40, 30, 200, 120), fill=(64, 128, 240, 255))
    return np.asarray(img, dtype=np.uint8)


def _circle_image() -> np.ndarray:
    img = Image.new("RGBA", (320, 180), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.ellipse((80, 30, 240, 150), fill=(40, 200, 90, 255))
    return np.asarray(img, dtype=np.uint8)


def test_opencv_detects_rectangle() -> None:
    """AC #9: a single solid rectangle produces a rect contour at the expected bbox."""
    contours = opencv_stage.detect_contours(_rect_image())
    assert len(contours) >= 1
    rect = next((c for c in contours if c["shapeKind"] == "rect"), None)
    assert rect is not None, f"expected rect, got shapeKinds {[c['shapeKind'] for c in contours]}"
    bbox = rect["bboxPx"]
    # Tolerance: ±5 px (per spec) for the bbox; Canny edges may walk by 1-2 px.
    assert 35 <= bbox["x"] <= 45
    assert 25 <= bbox["y"] <= 35
    assert 155 <= bbox["width"] <= 165
    assert 85 <= bbox["height"] <= 95


def test_opencv_detects_ellipse() -> None:
    """AC #10: a circle produces a contour with shapeKind 'ellipse'."""
    contours = opencv_stage.detect_contours(_circle_image())
    assert any(c["shapeKind"] == "ellipse" for c in contours), (
        f"expected ellipse, got {[c['shapeKind'] for c in contours]}"
    )


def test_opencv_fill_sample_matches_source() -> None:
    """AC #11: fillSample matches source pixel color within ±5 RGBA components."""
    contours = opencv_stage.detect_contours(_rect_image())
    rect = next(c for c in contours if c["shapeKind"] == "rect")
    r, g, b, a = rect["fillSample"]
    # Source rectangle was (64, 128, 240, 255).
    assert abs(r - 64) <= 5
    assert abs(g - 128) <= 5
    assert abs(b - 240) <= 5
    assert abs(a - 255) <= 5


def test_opencv_deterministic() -> None:
    """Determinism: same input -> identical contour output across runs."""
    image = _rect_image()
    a = opencv_stage.detect_contours(image)
    b = opencv_stage.detect_contours(image)
    assert a == b


# ---------------------------------------------------------------------------
# SAM 2 gate
# ---------------------------------------------------------------------------


def test_sam2_disabled_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """AC #15 prerequisite: ENABLE_SAM2 unset -> is_enabled() == False."""
    monkeypatch.delenv("ENABLE_SAM2", raising=False)
    assert sam2_stage.is_enabled() is False


@pytest.mark.parametrize("value", ["true", "1", "TRUE", "yes", "on"])
def test_sam2_truthy_values(monkeypatch: pytest.MonkeyPatch, value: str) -> None:
    """AC #14 prerequisite: ENABLE_SAM2 truthy -> is_enabled() == True."""
    monkeypatch.setenv("ENABLE_SAM2", value)
    assert sam2_stage.is_enabled() is True


@pytest.mark.parametrize("value", ["false", "0", "no", "off", ""])
def test_sam2_falsy_values(monkeypatch: pytest.MonkeyPatch, value: str) -> None:
    """Defensive: explicit falsy values keep SAM 2 disabled."""
    monkeypatch.setenv("ENABLE_SAM2", value)
    assert sam2_stage.is_enabled() is False


# ---------------------------------------------------------------------------
# Compose orchestrator
# ---------------------------------------------------------------------------


def _stub_text_lines(_img: np.ndarray) -> List[TextLineCandidate]:
    return [
        {
            "polygonPx": [[10, 20], [120, 20], [120, 50], [10, 50]],
            "text": "Quarterly Revenue",
            "confidence": 0.96,
        }
    ]


def _stub_contours(_img: np.ndarray) -> List[ContourCandidate]:
    return [
        {
            "bboxPx": {"x": 5, "y": 15, "width": 130, "height": 40},
            "shapeKind": "rect",
            "fillSample": [255, 255, 255, 255],
            "confidence": 0.7,
        }
    ]


def _stub_masks(_img: np.ndarray) -> List[MaskCandidate]:
    return [{"bboxPx": {"x": 0, "y": 0, "width": 320, "height": 180}, "confidence": 0.5}]


def test_compose_omits_masks_when_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    """AC #15: ENABLE_SAM2 disabled -> response omits masks key entirely."""
    monkeypatch.setattr(compose.paddle, "detect_text_lines", _stub_text_lines)
    monkeypatch.setattr(compose.opencv, "detect_contours", _stub_contours)
    monkeypatch.setenv("ENABLE_SAM2", "false")

    result: CvCandidates = compose.detect_candidates(np.zeros((180, 320, 4), dtype=np.uint8))
    assert "masks" not in result
    assert len(result["textLines"]) == 1
    assert len(result["contours"]) == 1


def test_compose_includes_masks_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    """AC #14: ENABLE_SAM2 enabled -> response includes masks (possibly empty)."""
    monkeypatch.setattr(compose.paddle, "detect_text_lines", _stub_text_lines)
    monkeypatch.setattr(compose.opencv, "detect_contours", _stub_contours)
    monkeypatch.setattr(compose.sam2, "detect_masks", _stub_masks)
    monkeypatch.setenv("ENABLE_SAM2", "true")

    result: Any = compose.detect_candidates(np.zeros((180, 320, 4), dtype=np.uint8))
    assert "masks" in result
    assert len(result["masks"]) == 1


def test_compose_rejects_non_rgba() -> None:
    """Defensive: non-RGBA input raises a clear ValueError."""
    with pytest.raises(ValueError):
        compose.detect_candidates(np.zeros((180, 320), dtype=np.uint8))


# ---------------------------------------------------------------------------
# Optional: real PaddleOCR when installed.
# ---------------------------------------------------------------------------


@pytest.mark.skipif(
    os.environ.get("PADDLEOCR_INSTALLED") != "1",
    reason="PaddleOCR not installed in this environment",
)
def test_paddleocr_recognizes_text() -> None:  # pragma: no cover — integration only
    """AC #6: a fixture image with 'Quarterly Revenue' produces a single text line."""
    from pipeline import paddle as paddle_stage

    img = Image.new("RGB", (640, 180), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((40, 60), "Quarterly Revenue", fill=(0, 0, 0))
    arr = np.asarray(img, dtype=np.uint8)
    lines = paddle_stage.detect_text_lines(arr)
    assert len(lines) >= 1
    assert "Quarterly" in lines[0]["text"]

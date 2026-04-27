# services/cv-worker/tests/test_response_shape.py
# AC #12, #13: response JSON parses cleanly against the Python TypedDicts that
# mirror T-244's TS CvCandidates interface; coordinates are integer pixels.

from __future__ import annotations

from typing import Any, Dict, List

from schemas import (
    BboxPx,
    ContourCandidate,
    CvCandidates,
    MaskCandidate,
    TextLineCandidate,
)


def _is_bbox(value: Any) -> bool:
    return (
        isinstance(value, dict)
        and {"x", "y", "width", "height"}.issubset(value.keys())
        and all(isinstance(value[k], int) for k in ("x", "y", "width", "height"))
    )


def assert_candidates_shape(payload: Dict[str, Any]) -> None:
    """Validate a /detect response body against the CvCandidates schema."""
    assert isinstance(payload, dict)
    assert "textLines" in payload, "missing textLines"
    assert "contours" in payload, "missing contours"
    assert isinstance(payload["textLines"], list)
    assert isinstance(payload["contours"], list)

    for line in payload["textLines"]:
        assert isinstance(line, dict)
        assert isinstance(line["text"], str)
        assert isinstance(line["confidence"], (int, float))
        assert isinstance(line["polygonPx"], list)
        for point in line["polygonPx"]:
            assert isinstance(point, list) and len(point) == 2
            assert all(isinstance(c, int) for c in point), (
                f"polygonPx must be integer pixels, got {point!r}"
            )

    for contour in payload["contours"]:
        assert isinstance(contour, dict)
        assert _is_bbox(contour["bboxPx"])
        assert contour["shapeKind"] in {"rect", "rounded-rect", "ellipse", "polygon"}
        assert isinstance(contour["fillSample"], list) and len(contour["fillSample"]) == 4
        for c in contour["fillSample"]:
            assert isinstance(c, int) and 0 <= c <= 255
        assert isinstance(contour["confidence"], (int, float))

    if "masks" in payload:
        assert isinstance(payload["masks"], list)
        for mask in payload["masks"]:
            assert _is_bbox(mask["bboxPx"])
            assert isinstance(mask["confidence"], (int, float))
            if "rle" in mask:
                assert isinstance(mask["rle"], str)


def test_typeddicts_accept_minimal_response() -> None:
    """AC #12: a minimal response satisfies the TypedDicts."""
    line: TextLineCandidate = {
        "polygonPx": [[10, 20], [50, 20], [50, 30], [10, 30]],
        "text": "Hi",
        "confidence": 0.9,
    }
    bbox: BboxPx = {"x": 5, "y": 6, "width": 7, "height": 8}
    contour: ContourCandidate = {
        "bboxPx": bbox,
        "shapeKind": "rect",
        "fillSample": [255, 128, 64, 255],
        "confidence": 0.85,
    }
    payload: CvCandidates = {"textLines": [line], "contours": [contour]}
    assert_candidates_shape(dict(payload))


def test_typeddicts_accept_optional_masks() -> None:
    """AC #14: with masks present, the shape still validates."""
    bbox: BboxPx = {"x": 0, "y": 0, "width": 10, "height": 10}
    mask: MaskCandidate = {"bboxPx": bbox, "confidence": 0.7, "rle": "abc"}
    payload: CvCandidates = {"textLines": [], "contours": [], "masks": [mask]}
    assert_candidates_shape(dict(payload))


def test_assert_rejects_float_polygon() -> None:
    """AC #13 negative case: float coords are rejected by the validator."""
    payload: Dict[str, List[Any]] = {
        "textLines": [
            {"polygonPx": [[1.5, 2.0], [3, 4]], "text": "x", "confidence": 0.9}
        ],
        "contours": [],
    }
    try:
        assert_candidates_shape(payload)
    except AssertionError:
        return
    raise AssertionError("expected float polygon to fail validation")

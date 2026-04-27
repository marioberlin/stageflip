# services/cv-worker/schemas.py
# Python TypedDicts mirroring T-244's CvCandidates / CvDetectOptions wire format.
# The TS-side Zod validator at packages/import-google-slides/src/cv/types.ts is
# the contract: any divergence here will break the HttpCvProvider response
# parse. Keep this file in lockstep with that schema.

from __future__ import annotations

from typing import List, Literal, Optional, Tuple, TypedDict


class BboxPx(TypedDict):
    """Pixel-space bounding box."""

    x: int
    y: int
    width: int
    height: int


# RGBA tuple in 0..255 range. The TS validator pins this to a length-4 tuple.
RgbaTuple = Tuple[int, int, int, int]


# A 2-component point [x, y]. The TS validator accepts both tuples and length-2
# arrays; we always emit the array form since JSON has no tuple type.
PolygonPoint = Tuple[int, int]


class TextLineCandidate(TypedDict):
    polygonPx: List[List[int]]
    text: str
    confidence: float


ShapeKind = Literal["rect", "rounded-rect", "ellipse", "polygon"]


class ContourCandidate(TypedDict):
    bboxPx: BboxPx
    shapeKind: ShapeKind
    fillSample: List[int]  # length-4 RGBA, JSON-array-encoded
    confidence: float


class MaskCandidate(TypedDict, total=False):
    bboxPx: BboxPx
    rle: str  # optional COCO RLE
    confidence: float


class CvCandidates(TypedDict, total=False):
    """
    Response shape returned from POST /detect.

    `masks` is OMITTED entirely (not set to []) when ENABLE_SAM2 is false —
    the TS validator declares it `.optional()` so absence is the contract.
    """

    textLines: List[TextLineCandidate]
    contours: List[ContourCandidate]
    masks: List[MaskCandidate]


class CvDetectOptions(TypedDict, total=False):
    """Per-call options posted by the TS-side HttpCvProvider as JSON."""

    renderWidth: float
    renderHeight: float
    fixtureKey: str


class HealthResponse(TypedDict):
    status: Literal["ok"]


class ErrorResponse(TypedDict):
    code: str
    message: str

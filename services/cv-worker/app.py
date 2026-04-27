# services/cv-worker/app.py
# FastAPI entrypoint — wires the CvCandidateProvider HTTP contract called by
# packages/import-google-slides/src/cv/http.ts. Implements:
#   POST /detect   — multipart {image, options} -> CvCandidates JSON
#   GET  /healthz  — liveness probe for Cloud Run
#
# The TS-side HttpCvProvider posts:
#   image:   PNG bytes (Blob, image/png)
#   options: JSON string with {renderWidth, renderHeight, fixtureKey?}
# It expects the strict CvCandidates shape (Zod-validated at the boundary).
# Any divergence will fail the TS-side parse — keep response shape locked.

from __future__ import annotations

import io
import json
import logging
import os
from typing import Any, Dict

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image

from pipeline import detect_candidates
from schemas import CvCandidates, ErrorResponse, HealthResponse

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("cv-worker")

DEFAULT_MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"

app = FastAPI(
    title="StageFlip CV Worker",
    version="0.1.0",
    description=(
        "Python sidecar implementing the CvCandidateProvider HTTP contract for "
        "@stageflip/import-google-slides. Wraps PaddleOCR + OpenCV (+ optional "
        "SAM 2) behind POST /detect."
    ),
)


def _max_image_size() -> int:
    raw = os.environ.get("MAX_IMAGE_SIZE_BYTES")
    if not raw:
        return DEFAULT_MAX_IMAGE_SIZE_BYTES
    try:
        return int(raw)
    except ValueError:
        logger.warning("invalid MAX_IMAGE_SIZE_BYTES=%r — using default", raw)
        return DEFAULT_MAX_IMAGE_SIZE_BYTES


def _error(code: str, message: str, status_code: int) -> JSONResponse:
    body: ErrorResponse = {"code": code, "message": message}
    return JSONResponse(status_code=status_code, content=dict(body))


@app.get("/healthz", response_model=None)
def healthz() -> Dict[str, str]:
    """Liveness probe — Cloud Run uses this to determine instance health."""
    payload: HealthResponse = {"status": "ok"}
    return dict(payload)


@app.post("/detect", response_model=None)
async def detect(
    image: UploadFile = File(...),
    options: str = Form(...),
) -> Any:
    """
    Run the CV pipeline on a slide thumbnail PNG.

    Request: multipart/form-data
      image:   PNG bytes
      options: JSON string matching CvDetectOptions

    Response: CvCandidates JSON (200) or ErrorResponse (400/413/500).
    """
    # 1. Read + size-check.
    raw = await image.read()
    if not raw:
        return _error("EMPTY_IMAGE", "image field is empty", 400)
    max_size = _max_image_size()
    if len(raw) > max_size:
        return _error(
            "PAYLOAD_TOO_LARGE",
            f"image is {len(raw)} bytes; limit is {max_size} bytes",
            413,
        )

    # 2. PNG signature check — fail fast on non-PNG before invoking PIL.
    if not raw.startswith(PNG_SIGNATURE):
        return _error("INVALID_PNG", "image is not a PNG (signature mismatch)", 400)

    # 3. Parse options JSON.
    try:
        parsed_options = json.loads(options)
    except json.JSONDecodeError as exc:
        return _error("INVALID_OPTIONS", f"options is not valid JSON: {exc}", 400)
    if not isinstance(parsed_options, dict):
        return _error("INVALID_OPTIONS", "options must be a JSON object", 400)

    # 4. Decode PNG -> RGBA numpy array.
    try:
        with Image.open(io.BytesIO(raw)) as pil_image:
            pil_image.load()
            rgba = pil_image.convert("RGBA")
            arr = np.asarray(rgba, dtype=np.uint8)
    except Exception as exc:
        logger.exception("PIL decode failed")
        return _error("INVALID_PNG", f"could not decode PNG: {exc}", 400)

    if arr.ndim != 3 or arr.shape[2] != 4:
        return _error("INVALID_PNG", "decoded image is not RGBA", 400)

    # 5. Run pipeline.
    try:
        candidates: CvCandidates = detect_candidates(arr)
    except Exception as exc:
        logger.exception("pipeline failed")
        return _error("PIPELINE_FAILED", str(exc), 500)

    return JSONResponse(status_code=200, content=dict(candidates))


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Any, exc: HTTPException) -> JSONResponse:
    """Render HTTPException in the standard ErrorResponse shape."""
    body: ErrorResponse = {"code": "HTTP_ERROR", "message": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content=dict(body))

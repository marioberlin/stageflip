# services/cv-worker/tests/test_http_surface.py
# AC #1-#5, #15, #17 — HTTP surface contract. Tests stub out the heavy CV
# pipeline so they exercise only validation + response shape (the fast,
# deterministic path the TS-side HttpCvProvider depends on).

from __future__ import annotations

import io
from typing import Any, Dict

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

import app as app_module
from schemas import CvCandidates


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """Build a TestClient with the CV pipeline stubbed to a canned response."""

    def fake_detect(_image: np.ndarray) -> CvCandidates:
        return {
            "textLines": [
                {
                    "polygonPx": [[10, 20], [60, 20], [60, 40], [10, 40]],
                    "text": "Quarterly Revenue",
                    "confidence": 0.97,
                }
            ],
            "contours": [
                {
                    "bboxPx": {"x": 8, "y": 18, "width": 64, "height": 26},
                    "shapeKind": "rect",
                    "fillSample": [240, 240, 240, 255],
                    "confidence": 0.81,
                }
            ],
        }

    monkeypatch.setattr(app_module, "detect_candidates", fake_detect)
    return TestClient(app_module.app)


def _png_bytes(size: tuple[int, int] = (320, 180)) -> bytes:
    img = Image.new("RGBA", size, (255, 255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_healthz_returns_ok(client: TestClient) -> None:
    """AC #17: GET /healthz returns 200 + {'status': 'ok'}."""
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_detect_returns_candidates_shape(client: TestClient) -> None:
    """AC #1: a valid PNG returns 200 + the CvCandidates JSON shape."""
    res = client.post(
        "/detect",
        files={"image": ("slide.png", _png_bytes(), "image/png")},
        data={"options": '{"renderWidth": 320, "renderHeight": 180}'},
    )
    assert res.status_code == 200
    body: Dict[str, Any] = res.json()
    assert isinstance(body["textLines"], list) and len(body["textLines"]) == 1
    assert isinstance(body["contours"], list) and len(body["contours"]) == 1
    # AC #15: when ENABLE_SAM2 is false (test default), `masks` is omitted.
    assert "masks" not in body


def test_detect_rejects_non_png(client: TestClient) -> None:
    """AC #2: non-PNG bytes return 400."""
    res = client.post(
        "/detect",
        files={"image": ("slide.png", b"not-a-png-payload", "image/png")},
        data={"options": "{}"},
    )
    assert res.status_code == 400
    assert res.json()["code"] == "INVALID_PNG"


def test_detect_rejects_oversized_payload(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """AC #3: PNG > limit returns 413."""
    monkeypatch.setenv("MAX_IMAGE_SIZE_BYTES", "1024")  # 1 KB
    res = client.post(
        "/detect",
        files={"image": ("slide.png", _png_bytes((1024, 1024)), "image/png")},
        data={"options": "{}"},
    )
    assert res.status_code == 413
    assert res.json()["code"] == "PAYLOAD_TOO_LARGE"


def test_detect_requires_image_field(client: TestClient) -> None:
    """AC #4: missing image field returns 4xx."""
    res = client.post("/detect", data={"options": "{}"})
    # FastAPI emits 422 when a required Form/File field is missing; 4xx is
    # what the spec asks for. Pin both ways through.
    assert 400 <= res.status_code < 500


def test_detect_rejects_malformed_options(client: TestClient) -> None:
    """AC #5: malformed options JSON returns 400."""
    res = client.post(
        "/detect",
        files={"image": ("slide.png", _png_bytes(), "image/png")},
        data={"options": "not-json{"},
    )
    assert res.status_code == 400
    assert res.json()["code"] == "INVALID_OPTIONS"


def test_detect_rejects_non_object_options(client: TestClient) -> None:
    """Defensive: options must be a JSON object (not array, not number)."""
    res = client.post(
        "/detect",
        files={"image": ("slide.png", _png_bytes(), "image/png")},
        data={"options": "[1, 2, 3]"},
    )
    assert res.status_code == 400
    assert res.json()["code"] == "INVALID_OPTIONS"


def test_detect_omits_masks_when_sam2_disabled(client: TestClient) -> None:
    """AC #15: ENABLE_SAM2=false -> masks key omitted entirely."""
    res = client.post(
        "/detect",
        files={"image": ("slide.png", _png_bytes(), "image/png")},
        data={"options": '{"renderWidth": 320, "renderHeight": 180}'},
    )
    assert res.status_code == 200
    assert "masks" not in res.json()

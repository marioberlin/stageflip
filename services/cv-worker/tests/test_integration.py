# services/cv-worker/tests/test_integration.py
# AC #17: end-to-end test — the FastAPI app boots, the health probe responds,
# and a /detect call against a synthetic PNG returns a well-formed CvCandidates
# response. The CV pipeline is patched to a deterministic stub so the
# integration test doesn't require PaddleOCR's 200 MB model cache.

from __future__ import annotations

import io
import json

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

import app as app_module
from schemas import CvCandidates
from tests.test_response_shape import assert_candidates_shape


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    def fake_detect(image: np.ndarray) -> CvCandidates:
        # Synthesize plausible candidates from the input dims so different
        # inputs produce different (but deterministic) outputs.
        h, w = image.shape[:2]
        return {
            "textLines": [
                {
                    "polygonPx": [
                        [w // 8, h // 4],
                        [w // 2, h // 4],
                        [w // 2, h // 4 + 24],
                        [w // 8, h // 4 + 24],
                    ],
                    "text": "Hello World",
                    "confidence": 0.92,
                }
            ],
            "contours": [
                {
                    "bboxPx": {"x": 10, "y": 10, "width": w - 20, "height": h - 20},
                    "shapeKind": "rect",
                    "fillSample": [200, 220, 255, 255],
                    "confidence": 0.66,
                }
            ],
        }

    monkeypatch.setattr(app_module, "detect_candidates", fake_detect)
    return TestClient(app_module.app)


def _png(size: tuple[int, int]) -> bytes:
    img = Image.new("RGBA", size, (255, 255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_end_to_end_detect(client: TestClient) -> None:
    """AC #1 + #12: /detect returns a 200 response that validates against the schema."""
    res = client.post(
        "/detect",
        files={"image": ("slide.png", _png((640, 360)), "image/png")},
        data={"options": json.dumps({"renderWidth": 640, "renderHeight": 360})},
    )
    assert res.status_code == 200
    payload = res.json()
    assert_candidates_shape(payload)


def test_health_then_detect(client: TestClient) -> None:
    """AC #17: health probe + detect both succeed in the same TestClient session."""
    health = client.get("/healthz")
    assert health.status_code == 200

    detect = client.post(
        "/detect",
        files={"image": ("slide.png", _png((320, 180)), "image/png")},
        data={"options": "{}"},
    )
    assert detect.status_code == 200


def test_detect_with_fixture_key_passthrough(client: TestClient) -> None:
    """The fixtureKey option (used by StubCvProvider) is accepted without error."""
    res = client.post(
        "/detect",
        files={"image": ("slide.png", _png((320, 180)), "image/png")},
        data={
            "options": json.dumps(
                {"renderWidth": 320, "renderHeight": 180, "fixtureKey": "simple-deck/slide-1"}
            )
        },
    )
    assert res.status_code == 200

# services/blender-worker/scripts/render_test.py
# pytest-style tests for the pure helpers in render.py. The Blender-bound
# `_render_template_to_dir` and `main()` paths require `bpy` and are exercised
# by the nightly integration test (STAGEFLIP_BLENDER_INTEGRATION=1).
#
# Run with: `pytest services/blender-worker/scripts/render_test.py`

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from render import (
    SUPPORTED_TEMPLATES,
    frame_count,
    parse_params,
    template_blend_path,
)


def test_supported_templates():
    assert "fluid-sim" in SUPPORTED_TEMPLATES
    assert "product-render" in SUPPORTED_TEMPLATES
    assert "particle-burst" in SUPPORTED_TEMPLATES


def test_frame_count_rounds_up():
    assert frame_count(1000, 30) == 30
    assert frame_count(1001, 30) == 31
    assert frame_count(2000, 30) == 60
    assert frame_count(33, 30) == 1


def test_parse_params_accepts_valid():
    raw = json.dumps(
        {
            "template": "fluid-sim",
            "params": {"viscosity": 0.5},
            "durationMs": 1000,
            "fps": 30,
            "device": "GPU",
            "outputDir": "/tmp/out",
        }
    )
    parsed = parse_params(raw)
    assert parsed["template"] == "fluid-sim"
    assert parsed["fps"] == 30


def test_parse_params_rejects_unknown_template():
    raw = json.dumps(
        {
            "template": "unknown",
            "params": {},
            "durationMs": 1000,
            "fps": 30,
            "device": "GPU",
            "outputDir": "/tmp/out",
        }
    )
    with pytest.raises(ValueError, match="not in supported set"):
        parse_params(raw)


def test_parse_params_rejects_missing_field():
    raw = json.dumps({"template": "fluid-sim"})
    with pytest.raises(ValueError, match="missing required field"):
        parse_params(raw)


def test_parse_params_rejects_bad_device():
    raw = json.dumps(
        {
            "template": "fluid-sim",
            "params": {},
            "durationMs": 1000,
            "fps": 30,
            "device": "TPU",
            "outputDir": "/tmp/out",
        }
    )
    with pytest.raises(ValueError, match="device must be"):
        parse_params(raw)


def test_parse_params_rejects_zero_duration():
    raw = json.dumps(
        {
            "template": "fluid-sim",
            "params": {},
            "durationMs": 0,
            "fps": 30,
            "device": "GPU",
            "outputDir": "/tmp/out",
        }
    )
    with pytest.raises(ValueError, match="durationMs"):
        parse_params(raw)


def test_template_blend_path():
    base = Path("/srv/blender-worker")
    p = template_blend_path("fluid-sim", base)
    assert p == base / "templates" / "fluid-sim" / "template.blend"


def test_template_blend_path_rejects_unknown():
    with pytest.raises(ValueError):
        template_blend_path("unknown", Path("/x"))

# services/blender-worker/scripts/render_test.py
# pytest-style tests for the pure helpers in render.py. The Blender-bound
# `_render_template_to_dir` and `main()` paths require `bpy` and are exercised
# by the nightly integration test (STAGEFLIP_BLENDER_INTEGRATION=1).
#
# Run with: `pytest services/blender-worker/scripts/render_test.py`

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from render import (
    SUPPORTED_TEMPLATES,
    _render_template_to_dir,
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


# ---------------------------------------------------------------------------
# M2 — graceful template-missing runtime check.
# Pinned via a fake-bpy harness so we exercise _render_template_to_dir without
# launching Blender.
# ---------------------------------------------------------------------------


def test_render_template_to_dir_raises_clear_error_when_template_missing(tmp_path: Path) -> None:
    """M2: a missing .blend yields an actionable error, not opaque Blender output.

    The check fires before any `bpy` use, so a sentinel `bpy` argument is
    sufficient — the function must raise before touching it.
    """
    sentinel_bpy = object()
    output_dir = tmp_path / "out"
    output_dir.mkdir()
    # templates_root has no `templates/fluid-sim/template.blend` under it.
    with pytest.raises(ValueError, match="not yet provisioned"):
        _render_template_to_dir(
            sentinel_bpy,
            "fluid-sim",
            {},
            1000,
            30,
            "CPU",
            output_dir,
            tmp_path,
        )


# ---------------------------------------------------------------------------
# M1 / AC #25 — output determinism integration test.
# Gated on STAGEFLIP_BLENDER_INTEGRATION=1 (nightly job). Skips cleanly when
# the .blend template binary is not present so it activates automatically the
# moment templates land via Git LFS.
# ---------------------------------------------------------------------------


@pytest.mark.skipif(
    os.environ.get("STAGEFLIP_BLENDER_INTEGRATION") != "1",
    reason="set STAGEFLIP_BLENDER_INTEGRATION=1 to run the bake integration test",
)
def test_two_bakes_produce_identical_output_when_inputs_match(tmp_path: Path) -> None:
    """AC #25: same inputsHash → same frameCount + identical per-frame byte-lengths.

    Skip-on-missing-template: if the fluid-sim template .blend has not yet
    been provisioned (follow-up Git LFS task), this test skips with a clear
    message. The skip activates automatically once templates land.
    """
    templates_root = Path(__file__).resolve().parent.parent
    blend_path = template_blend_path("fluid-sim", templates_root)
    if not blend_path.exists():
        pytest.skip(
            "template binary not yet provisioned; gating on follow-up Git LFS task"
            f" ({blend_path})"
        )

    try:
        import bpy  # type: ignore[import-not-found]  # noqa: PLC0415  available only inside Blender
    except ImportError:
        pytest.skip("bpy unavailable — must run inside Blender for this test")

    params: Dict[str, Any] = {"viscosity": 0.5}
    duration_ms = 1000
    fps = 30

    out_a = tmp_path / "bake-a"
    out_b = tmp_path / "bake-b"
    out_a.mkdir()
    out_b.mkdir()

    n_a = _render_template_to_dir(
        bpy,
        "fluid-sim",
        params,
        duration_ms,
        fps,
        "CPU",
        out_a,
        templates_root,
    )
    n_b = _render_template_to_dir(
        bpy,
        "fluid-sim",
        params,
        duration_ms,
        fps,
        "CPU",
        out_b,
        templates_root,
    )

    assert n_a == n_b, f"frame_count drift: {n_a} vs {n_b}"

    def _frame_sizes(d: Path) -> List[int]:
        return [p.stat().st_size for p in sorted(d.glob("frame-*.png"))]

    sizes_a = _frame_sizes(out_a)
    sizes_b = _frame_sizes(out_b)
    assert sizes_a == sizes_b, (
        "per-frame byte-length differed across two bakes with identical inputs "
        f"(a={sizes_a}, b={sizes_b})"
    )

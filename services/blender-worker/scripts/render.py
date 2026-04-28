# services/blender-worker/scripts/render.py
# Blender Python script invoked by the worker (T-265 D-T265-6, AC #21).
#
# Reads a JSON parameter blob from stdin:
#   {
#     "template": "fluid-sim" | "product-render" | "particle-burst",
#     "params":   { ... template-specific },
#     "durationMs": int,
#     "fps":      int,
#     "device":   "GPU" | "CPU",
#     "outputDir": "/tmp/...",
#   }
# Renders frames into `outputDir/frame-{N}.png`.
#
# Determinism (T-265 D-T265-8):
#   - `bpy.context.scene.cycles.use_persistent_data = True`
#   - `bpy.context.scene.cycles.seed = 0`
#   - Disable wireframe denoising autotuning so seed is honoured.
#   - Pin sample count + tile size so render output is reproducible.
#
# This script is run inside a Blender Python interpreter (4.2 LTS); the
# `bpy` module is only available there. We isolate logic into pure helpers
# so unit tests (render.test.py) can exercise template + parameter parsing
# without launching Blender.

from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path
from typing import Any, Dict


# ---------------------------------------------------------------------------
# Pure helpers — testable without bpy.
# ---------------------------------------------------------------------------


SUPPORTED_TEMPLATES = ("fluid-sim", "product-render", "particle-burst")


def parse_params(raw: str) -> Dict[str, Any]:
    """Parse the stdin parameter JSON, validating required fields."""
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("render.py: stdin must be a JSON object")
    for key in ("template", "params", "durationMs", "fps", "device", "outputDir"):
        if key not in data:
            raise ValueError(f"render.py: missing required field '{key}'")
    template = data["template"]
    if template not in SUPPORTED_TEMPLATES:
        raise ValueError(
            f"render.py: template '{template}' not in supported set "
            f"{SUPPORTED_TEMPLATES}"
        )
    if data["device"] not in ("GPU", "CPU"):
        raise ValueError("render.py: device must be 'GPU' or 'CPU'")
    if not isinstance(data["durationMs"], int) or data["durationMs"] <= 0:
        raise ValueError("render.py: durationMs must be a positive integer")
    if not isinstance(data["fps"], int) or data["fps"] <= 0:
        raise ValueError("render.py: fps must be a positive integer")
    return data


def frame_count(duration_ms: int, fps: int) -> int:
    """Mirror of TS-side `expectedFrameCount`. Round up to capture trailing edge."""
    return math.ceil((duration_ms / 1000.0) * fps)


def template_blend_path(template: str, base_dir: Path) -> Path:
    """Resolve the .blend path for a built-in template, relative to base_dir."""
    if template not in SUPPORTED_TEMPLATES:
        raise ValueError(f"render.py: unknown template '{template}'")
    return base_dir / "templates" / template / "template.blend"


# ---------------------------------------------------------------------------
# Blender invocation — only callable when `bpy` is importable.
# ---------------------------------------------------------------------------


def _set_deterministic_render(scene: Any, device: str) -> None:
    """Apply T-265 D-T265-8 deterministic Cycles settings."""
    scene.render.engine = "CYCLES"
    scene.cycles.use_persistent_data = True
    scene.cycles.seed = 0
    scene.cycles.use_denoising = False
    scene.cycles.samples = 64  # pinned; output determinism > image quality for v1
    if device == "GPU":
        scene.cycles.device = "GPU"
    else:
        scene.cycles.device = "CPU"


def _render_template_to_dir(
    bpy: Any,
    template: str,
    params: Dict[str, Any],
    duration_ms: int,
    fps: int,
    device: str,
    output_dir: Path,
    templates_root: Path,
) -> int:
    """Open the template, apply params, render N frames. Returns frame count."""
    blend_path = template_blend_path(template, templates_root)
    if not blend_path.exists():
        # Surface a self-explanatory error rather than the opaque Blender
        # "RNA_PointerCreate: ... not found" failure the CLI emits when
        # open_mainfile points at a missing file. Template binaries are
        # tracked via a follow-up Git LFS task.
        raise ValueError(
            f"render.py: template '{template}' is not yet provisioned "
            f"(.blend missing at {blend_path}). "
            f"Follow-up: ship template binaries via Git LFS."
        )
    bpy.ops.wm.open_mainfile(filepath=str(blend_path))
    scene = bpy.context.scene

    # Apply template-specific params. The contract is intentionally simple in
    # v1: we expose a shallow `params` map; templates pull whatever they need.
    # See `services/blender-worker/templates/<name>/params.schema.json`.
    scene["stageflip_params"] = json.dumps(params)
    scene.render.fps = fps

    _set_deterministic_render(scene, device)

    n = frame_count(duration_ms, fps)
    scene.frame_start = 0
    scene.frame_end = max(0, n - 1)
    scene.render.filepath = str(output_dir / "frame-")
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    bpy.ops.render.render(animation=True, write_still=False)
    return n


def main() -> int:
    raw = sys.stdin.read()
    try:
        data = parse_params(raw)
    except (ValueError, json.JSONDecodeError) as err:
        sys.stderr.write(f"render.py: invalid params: {err}\n")
        return 2

    output_dir = Path(data["outputDir"])
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        import bpy  # type: ignore[import-not-found]  # noqa: PLC0415  available only inside Blender
    except ImportError:
        sys.stderr.write("render.py: bpy unavailable — must run inside Blender\n")
        return 3

    templates_root = Path(__file__).resolve().parent.parent
    try:
        _render_template_to_dir(
            bpy,
            data["template"],
            data["params"],
            data["durationMs"],
            data["fps"],
            data["device"],
            output_dir,
            templates_root,
        )
    except Exception as err:  # noqa: BLE001 — surface Blender errors verbatim
        sys.stderr.write(f"render.py: render failed: {err}\n")
        return 4

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# services/cv-worker/tests/fixtures/build_fixtures.py
# Generate the small PNG fixtures used by the test suite. We produce them
# programmatically (rather than checking in opaque PNG bytes) so reviewers can
# audit exactly what the pipeline is run against.

from __future__ import annotations

import io
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FIXTURE_DIR = Path(__file__).resolve().parent


def _save(name: str, image: Image.Image) -> Path:
    target = FIXTURE_DIR / name
    image.save(target, format="PNG", optimize=True)
    return target


def build_blank() -> Path:
    img = Image.new("RGBA", (320, 180), (255, 255, 255, 255))
    return _save("blank-slide.png", img)


def build_single_rect() -> Path:
    img = Image.new("RGBA", (320, 180), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle((40, 30, 200, 120), fill=(64, 128, 240, 255))
    return _save("single-rect.png", img)


def build_circle() -> Path:
    img = Image.new("RGBA", (320, 180), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.ellipse((80, 30, 240, 150), fill=(40, 200, 90, 255))
    return _save("single-circle.png", img)


def build_text_only() -> Path:
    img = Image.new("RGBA", (640, 180), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 32)
    except OSError:
        font = ImageFont.load_default()
    draw.text((40, 60), "Quarterly Revenue", fill=(0, 0, 0, 255), font=font)
    return _save("text-only.png", img)


def build_too_large() -> Path:
    # ~6 MB target for the 413 test. Random-ish but deterministic content via
    # PIL's noise pattern is fine — we only need the size to exceed 5 MB.
    width, height = 2400, 2400
    img = Image.new("RGBA", (width, height), (255, 255, 255, 255))
    target = FIXTURE_DIR / "too-large.png"
    # Force compression off to inflate the file.
    img.save(target, format="PNG", optimize=False, compress_level=0)
    return target


if __name__ == "__main__":
    for fn in (build_blank, build_single_rect, build_circle, build_text_only):
        path = fn()
        print(f"wrote {path} ({path.stat().st_size} bytes)")

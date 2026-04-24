---
"@stageflip/editor-shell": minor
---

T-201: multi-size banner preview grid for StageFlip.Display.

Sibling of T-182's `AspectRatioGrid` — the aspect grid lays out
ratio-only boxes; this one lays out **fixed-dimension** banner cells
(300×250, 728×90, 160×600 — the `DISPLAY_CANONICAL_SIZES` set from
T-200).

- **`layoutBannerSizes(sizes, container, options)`** (pure math) —
  computes a single uniform scale factor such that the row of cells
  fits both `container.width` (widths + gaps) and `container.height`
  (tallest cell). Clamps to `[minScale, maxScale]` (defaults 0.1 / 1)
  so over-large containers don't enlarge banners beyond 1×.
- **`<BannerSizePreview>`** — one scaled cell; clips host content
  with `overflow: hidden`. Exposes `--sf-banner-scale`,
  `--sf-banner-width`, `--sf-banner-height` CSS custom props so host
  chrome (rulers, badges) can stay in sync.
- **`<BannerSizeGrid>`** — renders one preview per supplied size;
  threads `currentFrame` into the grid + every `renderPreview`
  callback so scrubbing updates all sizes in lockstep. Defaults
  `currentFrame` to 0.

Preserves inter-cell proportions — a 300×250 and 728×90 stay at the
right relative size no matter the container. Uses `BoxSize` from the
existing `aspect-ratio/math` barrel so consumers keep a single shared
geometry type.

24 new tests (13 math + 11 component), 100% coverage on the new
files. Zero new runtime deps.

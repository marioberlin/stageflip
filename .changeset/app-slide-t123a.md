---
"@stageflip/app-slide": minor
---

T-123a: `<SlideCanvas>` viewport + `<ElementView>` read-only renderer.

Replaces the walking-skeleton blank SVG with a real scale-to-fit
canvas:

- **`<SlideCanvas>`** — resolves the active slide via
  `activeSlideIdAtom` + `slideByIdAtom` (T-121b), applies a CSS
  `transform: scale(min(width/1920, height/1080))` so canvas-space
  coordinates (1920×1080) keep working as the viewport resizes.
  ResizeObserver-backed; a `viewportSizeForTest` prop bypasses it for
  unit tests.
- **`<ElementView>`** — positions each element at its `transform.x/y`
  with rotation/opacity applied. Per-type renderers: text → styled
  span, shape → SVG (rect / ellipse / custom-path), image + video →
  labelled placeholder that exposes the `asset:…` ref as a data
  attribute (real resolver arrives with T-084a), group → recursive
  render, chart/table/clip/embed/code → kind-labelled placeholder.
- **`editor-app-client.tsx`** — seeds two text elements on the initial
  slide and hydrates `activeSlideIdAtom` on mount so the first paint
  shows the canvas populated. Header + layout unchanged.
- **Walking-skeleton e2e** — now asserts the canvas renders with the
  seeded `element-seed-title` + `element-seed-subtitle` nodes visible.

Tests: 18 new vitest cases (11 for ElementView, 7 for SlideCanvas),
plus the extended e2e. Interactions (selection, drag, text edit,
animated playback) arrive with T-123b/c/d.

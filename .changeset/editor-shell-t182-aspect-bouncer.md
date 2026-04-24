---
"@stageflip/editor-shell": minor
---

T-182: multi-aspect preview bouncer primitives (9:16 / 1:1 / 16:9
simultaneously).

Adds a pure layout math module plus two headless components so the video
app (T-187) can render the same composition against several aspect
ratios side-by-side for operator review:

- **`AspectRatio` + `COMMON_ASPECTS`** — `{ w, h, label? }`; canonical
  set ships 16:9 / 1:1 / 9:16.
- **`fitAspect(aspect, bounds)`** — largest ratio-preserving rectangle
  that fits a bounding box.
- **`layoutAspectPreviews(aspects, container, { gapPx?, maxHeightPx? })`**
  — row layout returning per-preview `{ widthPx, heightPx }`. All
  previews share a common height; total widths + gaps ≤ container
  width. Defaults: `gapPx=12`, `maxHeightPx=container.height`.
- **`<AspectRatioPreview>`** — fixed-size frame at the given aspect,
  `overflow: hidden`, publishes `data-aspect-w/-h/-label` + CSS
  variables.
- **`<AspectRatioGrid>`** — flex row wrapper that runs
  `layoutAspectPreviews` and renders an `<AspectRatioPreview>` per
  aspect. Host supplies content via the `renderPreview(placement)`
  render-prop; falls back to the aspect label.

Tests: +23 (14 math + 9 components). Editor-shell 333/333 green. Zero
opinionated CSS — hosts style via `className` / `style` / `data-*` /
CSS custom properties.

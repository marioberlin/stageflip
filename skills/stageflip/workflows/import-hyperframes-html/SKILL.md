---
title: Workflow — Import / Export Hyperframes HTML
id: skills/stageflip/workflows/import-hyperframes-html
tier: workflow
status: substantive
last_updated: 2026-04-26
owner_task: T-247
related:
  - skills/stageflip/concepts/loss-flags
  - skills/stageflip/reference/import-hyperframes-html
---

# Workflow — Import / Export Hyperframes HTML

`@stageflip/import-hyperframes-html` ships **bidirectional** parser + writer
for the Hyperframes producer-side HTML format. Output of `parseHyperframes`
is a canonical `Document` with `content.mode === 'video'`. `exportHyperframes`
walks the inverse path, producing master HTML + per-composition files
matching the inbound shape.

The Hyperframes producer (vendored read-only at `reference/hyperframes/`,
Apache-2.0) emits a multi-file HTML deck:

- A master page with `<div id="master-root" data-composition-id="master"
  data-width data-height data-duration>`.
- Sibling composition files referenced by `data-composition-src`, each
  wrapping a `<template id="..."><div data-composition-id="...">` body.
- Inline `<script>` blocks for GSAP timelines (animations) and inline
  transcript JSON arrays (captions).

T-247 is **fresh-write** per CLAUDE.md §7 — does not import or share code
with `packages/renderer-cdp/vendor/`'s vendored Hyperframes engine.

## Bidirectional contract

```ts
import { parseHyperframes, exportHyperframes } from '@stageflip/import-hyperframes-html';

const { document, lossFlags } = await parseHyperframes(masterHtml, {
  fetchCompositionSrc: async (rel) => readFile(rel),
});

const { masterHtml: out, compositions, lossFlags: emitFlags } =
  await exportHyperframes(document, { outputMode: 'multi-file' });
```

`parseHyperframes` is async because the caller injects the composition-src
fetcher (filesystem / ZIP / HTTP, depending on input shape). The parser
itself is pure: same HTML in + same fetcher = same Document out + same loss
flags. AC #33 pins this via a source-level grep test.

`exportHyperframes` is also async (the optional `AssetReader` could be I/O)
but the writer body is pure and deterministic — two consecutive calls
produce string-identical output (AC #30).

## Output shape

`Document.content` is always `videoContent`:

- `aspectRatio`: derived from `master-root.data-width / data-height`.
  Standard ratios (16:9, 9:16, 1:1, 4:5, 21:9) match exactly; everything
  else lands as `{ kind: 'custom', w, h }`.
- `durationMs`: `data-duration` (seconds) × 1000.
- `tracks[]`: one entry per top-level composition. Order comes from
  `data-track-index` (stable sort; missing index falls back to source
  position).
- `captions?`: a `CaptionTrack` populated only when an inline `TRANSCRIPT`
  matched the recognized shape.

## Track-kind heuristics (T-247 §3)

Hyperframes compositions don't carry a `track.kind` enum. The classifier
applies the rules in this order:

1. `data-composition-id` matches `^caption` or `^subtitle` → `'caption'`.
2. `data-composition-id` matches `^main` AND `data-track-index === 0` →
   `'visual'`.
3. Composition contains only `<audio>` children (no visual elements) →
   `'audio'`.
4. Otherwise → `'overlay'`.

Future producers can target this contract deterministically by naming
compositions `main-*`, `captions`, `subtitles`, or by emitting only audio
elements.

## Lossy paths (v1)

| Path | Loss flag code | Severity |
|---|---|---|
| CSS-class typography (font-size / color / weight) | `LF-HYPERFRAMES-HTML-CLASS-STYLE-LOST` | warn |
| GSAP timeline animations | `LF-HYPERFRAMES-HTML-ANIMATIONS-DROPPED` | info |
| Unrecognized transcript shape | `LF-HYPERFRAMES-HTML-CAPTIONS-UNRECOGNIZED` | warn |
| Unsupported tags (canvas / iframe / object) | `LF-HYPERFRAMES-HTML-UNSUPPORTED-ELEMENT` | warn |
| Missing width / height | `LF-HYPERFRAMES-HTML-DIMENSION-INFERRED` | info |
| Asset bytes can't be retrieved | `LF-HYPERFRAMES-HTML-ASSET-MISSING` | error |

All flags carry `source: 'hyperframes-html'`. The wrapper in
`packages/import-hyperframes-html/src/loss-flags.ts` mirrors the PPTX +
GSLIDES wrappers — same auto-fill + per-code defaults pattern.

## Captions extraction (T-247 §6)

Hyperframes encodes captions on **two surfaces simultaneously**:

- An inline `<script>` block containing `const TRANSCRIPT = [{text, start,
  end}, ...]` (the timed text data).
- A composition layer with `data-composition-id="captions"` (the styled
  visual overlay).

The importer emits **both** when both are present, on different schema
surfaces:

| Source | Canonical destination |
|---|---|
| Inline `TRANSCRIPT` JSON | `videoContent.captions: CaptionTrack` |
| `data-composition-id="captions"` layer | `Track` of kind `'caption'` |

Both populate together when both are present — they're complementary, not
redundant: the data drives downstream rendering, the visual track preserves
the producer's styled appearance.

The transcript JSON pattern is matched by a conservative regex on
`<script>` source: `(const|let|var) TRANSCRIPT = [...]` or
`window.__transcript = [...]`. Each entry must be exactly
`{text: string, start: number, end: number}` — extra fields per entry
**skip that entry**; missing required fields fail the entire array
(`LF-HYPERFRAMES-HTML-CAPTIONS-UNRECOGNIZED` and `videoContent.captions` is
omitted).

## Transform conversion (T-247 §4 / AC #19/#20)

The canonical schema's `transformSchema` carries only `{x, y, width,
height, rotation, opacity}` — there is **no** `anchor` field and **no**
`scale` field. The parser converts CSS shorthand into the canonical surface:

- `style="left: <X>; top: <Y>; transform: translate(-50%, -50%)"` (CSS
  center-anchor) →
  `transform.x = X - width/2`, `transform.y = Y - height/2`.
- `style="transform: scale(<n>)"` with `n != 1` → drop the scale; emit
  `LF-HYPERFRAMES-HTML-ANIMATIONS-DROPPED` (a non-identity scale on a static
  element is virtually always a GSAP initial state).
- `style="transform: rotate(<θ>deg)"` → `transform.rotation = θ`.
- `style="opacity: 0"` with sibling GSAP context → normalize to 1 + emit
  `LF-HYPERFRAMES-HTML-ANIMATIONS-DROPPED`.

`matrix(...)` and other compound 2D transforms are an **escalation
trigger** (T-247 §6) — v1 doesn't decompose them.

## Round-trip contract (T-247 §9)

The round-trip suite (`roundtrip.test.ts`) parses every fixture, exports
the result, and re-parses the export. Predicate exclusions:

- **Animations**: dropped on the first pass; the second pass has nothing
  to drop. Animations are one-way (the `LF-HYPERFRAMES-HTML-ANIMATIONS-
  DROPPED` flag may not recur on the second pass — the export emits no
  GSAP timelines).
- **Class styling**: the export preserves `class` (via the schema's `name`
  field), so the second parse re-emits the same loss flags.
- **Asset bytes**: separate concern (handled by the future
  `resolveAssets` pass); the round-trip predicate excludes
  `ParsedAssetRef`.
- **Captions-unrecognized**: one-way (the export doesn't write back
  unrecognized scripts).

Track ordering is positional; element ordering within a track is positional;
loss flags are compared as a **multiset** sorted by `code` +
`location.slideId` + `location.elementId`.

## Out of scope (v1)

- **CSS-class style resolution**. v1 reads inline `style` declarations
  only. A future T-247-css rider could add real CSS-rule resolution.
- **GSAP timeline parsing**. Animations are dropped with one flag per
  composition.
- **Multi-page slide-mode mapping**. Hyperframes is a video timeline;
  v1 always emits `content.mode === 'video'`.
- **Reverse-direction animation emission**. Round-trip preserves layout,
  not animation.
- **Vendored Hyperframes engine integration**. T-247 is fresh-write per
  CLAUDE.md §7.

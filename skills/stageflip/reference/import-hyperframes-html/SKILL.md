---
title: Reference — @stageflip/import-hyperframes-html
id: skills/stageflip/reference/import-hyperframes-html
tier: reference
status: substantive
last_updated: 2026-04-26
owner_task: T-247
related:
  - skills/stageflip/workflows/import-hyperframes-html
  - skills/stageflip/concepts/loss-flags
---

# Reference — `@stageflip/import-hyperframes-html`

Bidirectional Hyperframes HTML ↔ canonical `Document` (video mode) shipped
by T-247. Output of `parseHyperframes` is a `Document` with
`content.mode === 'video'`; `exportHyperframes` walks the inverse path.

## Public surface

```ts
import {
  parseHyperframes,
  exportHyperframes,
  emitLossFlag,
  CODE_DEFAULTS,
  classifyTrackKind,
  extractTranscript,
  emitTranscriptScript,
  parseInlineStyle,
  serializeInlineStyle,
  parsePxLength,
  parseTransform,
} from '@stageflip/import-hyperframes-html';

import type {
  AssetReader,
  ExportHyperframesOptions,
  ExportHyperframesResult,
  ExportOutputMode,
  HfhtmlLossFlagCode,
  ParseHyperframesOptions,
  ParseHyperframesResult,
  ParsedAssetRef,
  ParsedAudioElement,
  ParsedImageElement,
  ParsedVideoElement,
  ParsedTransform,
  TranscriptExtraction,
  ClassifyInput,
  EmitLossFlagInput,
  LossFlag,
} from '@stageflip/import-hyperframes-html';
```

## Entry points

### `parseHyperframes(masterHtml, opts)`

```ts
function parseHyperframes(
  masterHtml: string,
  opts: { fetchCompositionSrc: (relPath: string) => Promise<string> },
): Promise<{ document: Document; lossFlags: LossFlag[] }>;
```

Parses a Hyperframes master HTML document, fetching every composition via
the caller-supplied `fetchCompositionSrc`. The function is pure: same
master HTML + same fetcher = same Document + same loss flag set. Throws if
the master lacks a `#master-root` element or the required `data-width`
/ `data-height` / `data-duration` attributes.

### `exportHyperframes(doc, opts?)`

```ts
function exportHyperframes(
  doc: Document,
  opts?: { assets?: AssetReader; outputMode?: 'multi-file' | 'inlined' },
): Promise<{ masterHtml: string; compositions: Record<string, string>; lossFlags: LossFlag[] }>;
```

Reverse direction. Throws if `doc.content.mode !== 'video'`. Two output
modes:

- `'multi-file'` (default): returns master HTML + per-composition files in
  `compositions: { 'compositions/<id>.html': '...' }`.
- `'inlined'`: returns a single `masterHtml` containing inlined
  `<template>` blocks; `compositions` is empty.

Determinism: two consecutive calls produce string-identical output (AC #30).

## Loss flag codes

`HfhtmlLossFlagCode` is the closed union of every code emitted by this
package. All flags carry `source: 'hyperframes-html'` (long form, matching
PPTX/GSLIDES precedent — NOT the short `'hfhtml'` form).

```ts
type HfhtmlLossFlagCode =
  | 'LF-HYPERFRAMES-HTML-CLASS-STYLE-LOST'
  | 'LF-HYPERFRAMES-HTML-ANIMATIONS-DROPPED'
  | 'LF-HYPERFRAMES-HTML-CAPTIONS-UNRECOGNIZED'
  | 'LF-HYPERFRAMES-HTML-UNSUPPORTED-ELEMENT'
  | 'LF-HYPERFRAMES-HTML-DIMENSION-INFERRED'
  | 'LF-HYPERFRAMES-HTML-ASSET-MISSING';
```

`CODE_DEFAULTS` exposes per-code default `severity` + `category`. The
wrapper `emitLossFlag` auto-fills `source` and looks up the defaults:

```ts
emitLossFlag({
  code: 'LF-HYPERFRAMES-HTML-CLASS-STYLE-LOST',
  message: 'styled element',
  location: { slideId: 'track_1', elementId: 'el_1' },
});
```

## Track-kind classifier

`classifyTrackKind(input)` is the deterministic heuristic for converting a
Hyperframes composition into one of the four canonical track kinds. See
the workflow skill for the rule order.

## Inline-style helpers

- `parseInlineStyle(raw)` — `style="prop: value; ..."` → `Record<prop, value>`.
- `serializeInlineStyle(record)` — reverse direction.
- `parsePxLength(value)` — `"540px"` → `540`. Returns `undefined` for
  non-px lengths.
- `parseTransform(value)` — parses `translate(...)`, `scale(...)`,
  `rotate(...)` shorthand into a typed `ParsedTransform` record (no
  matrix decomposition).

## Captions helpers

- `extractTranscript(scriptText)` — runs the conservative regex on a
  `<script>` source string. Returns one of three discriminated variants:
  `{kind: 'none'}` (no marker), `{kind: 'captions', captions}` (recognized
  shape), or `{kind: 'unrecognized', reason}` (regex matched but JSON or
  shape failed).
- `emitTranscriptScript(captions)` — reverse direction. Emits a JSON-
  compatible array literal (quoted keys, no trailing commas) so
  `extractTranscript` round-trips byte-exactly through both directions.

## Out of scope (v1)

See the workflow skill for the OOS catalogue. v1 does not handle CSS-class
resolution, GSAP timeline parsing, slide-mode mapping, or
animation-emission on the export side.

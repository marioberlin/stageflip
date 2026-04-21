---
"@stageflip/renderer-cdp": minor
---

Export dispatcher + preflight + frame sink (T-084).

Top-level orchestrator that ties preflight, the T-083 live-tier
adapter, and a pluggable output sink together. The dispatcher owns
the capture loop:

```ts
const result = await exportDocument(document, { session, sink });
```

Steps:

1. `preflight(document)` — pure analysis. Aggregates font
   requirements, tier-splits resolved clips into live / bake, and
   surfaces any reason to refuse the export. Blockers today:
   `unresolved-clips`, `bake-not-implemented` (T-089 is
   interfaces-only), `empty-fps`, `empty-duration`. Placeholder
   `assetRefs` field — T-084a populates.
2. `LiveTierAdapter.mount(document)` — via the existing T-083
   surface.
3. Per-frame loop over `[start, end)` — `adapter.renderFrame` →
   `sink.onFrame`. Defaults to the full document.
4. `finally` — `adapter.close` + `sink.close`. Both fire exactly
   once even if the capture loop throws.

Fails loud: preflight blockers raise `PreflightBlockedError` before
the session is opened. Invalid frame ranges raise `RangeError`.

New public surface (all under `packages/renderer-cdp/src/`):

- `frame-sink.ts` — `FrameSink` interface + `InMemoryFrameSink`
  (test / inspection; production wiring = disk / FFmpeg-pipe in
  T-085+).
- `preflight.ts` — `preflight(document) → PreflightReport`.
- `export-dispatcher.ts` — `exportDocument(...)` +
  `PreflightBlockedError`.

Tests: 19 new cases across 3 files. Total test surface in
`@stageflip/renderer-cdp`: 55 across 7 files.

Package deps added: `@stageflip/fonts` (for
`aggregateFontRequirements` in preflight).

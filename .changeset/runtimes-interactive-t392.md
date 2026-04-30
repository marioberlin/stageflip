---
'@stageflip/runtimes-interactive': minor
'@stageflip/schema': minor
---

T-392 — `LiveDataClip` `staticFallback` (cached-snapshot generator).

- Adds optional `cachedSnapshot: { capturedAt, status, body }` field on `liveDataClipPropsSchema` (D-T392-1). Backward-compatible — T-391 fixtures without the field validate unchanged.
- New `defaultLiveDataStaticFallback` generator emits a header TextElement (endpoint · status · capturedAt) plus a body TextElement (`JSON.stringify(body, null, 2)`) — both clamped to canvas bounds with T-390-style overflow guard. Placeholder TextElement when `cachedSnapshot` is absent.
- New `liveDataStaticFallbackGenerator` wrapper registers against `staticFallbackGeneratorRegistry` for `family: 'live-data'` at subpath import time. Harness-routing matches T-388a's contract — authored fallback wins for rendering but the generator is still invoked with `reason: 'authored'` for telemetry.
- Telemetry privacy posture: `hasSnapshot` boolean + `bodyByteLength` integer only — the response body NEVER in attributes (D-T392-4 / AC #13). Same posture as T-390 / T-391.
- Determinism: pure transformation; no `Math.random` / `Date.now` / `performance.now`. `safeStringify` wraps `JSON.stringify` in try/catch defensively against circular bodies.

Closes out `family: 'live-data'` (modulo chart rendering, deferred to T-406's landing per ADR-005 §D1 footnote `^liveData-v1`).

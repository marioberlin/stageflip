---
'@stageflip/runtimes-interactive': minor
'@stageflip/schema': minor
---

T-391 — `LiveDataClip` `liveMount` (third γ-live family).

- New `liveDataClipPropsSchema` on `@stageflip/schema` for `family: 'live-data'` props (`endpoint`, `method`, `headers`, `body`, `parseMode`, `refreshTrigger`, `posterFrame`).
- New `liveDataClipFactory` + `LiveDataProvider` seam on `@stageflip/runtimes-interactive`. The clip wraps a host-injected `Fetcher` (no `globalThis.fetch` inside `clips/**`); two implementations ship — `HostFetcherProvider` and `InMemoryLiveDataProvider`.
- One-shot at mount + manual `refresh()` only (no polling in v1; the determinism floor rules wall-clock cadences out).
- Telemetry privacy posture: response body NEVER in attributes; `bodyByteLength` integer only. Same posture as T-389 / T-390.
- `check-preset-integrity` gains invariant 12 for `family: 'live-data'`.
- Skill expansion: `skills/stageflip/runtimes/live-data/SKILL.md` is now substantive; `concepts/runtimes/SKILL.md` records the `ProviderSeam<T>` ruling (no extraction at the third application); `concepts/clip-elements/SKILL.md` adds the `live-data` row.

Pairs with T-392 (cached snapshot staticFallback). Chart-aware rendering for both halves is a follow-up gated on T-406's landing per ADR-005 §D1 footnote `^liveData-v1`.

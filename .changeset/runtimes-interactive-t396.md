---
'@stageflip/runtimes-interactive': minor
'@stageflip/schema': minor
---

T-396 — `AiGenerativeClip` `staticFallback` (curated-example generator).

- Adds optional `curatedExample: { src, contentType? }` field on `aiGenerativeClipPropsSchema`. v1 accepts ONLY `data:` URLs (refine enforces this); `http(s):` URLs deferred per the out-of-scope deferral. Same posture as T-394's `posterImage` (the F-2 fix from spec PR #289 review). Backward-compat — T-395 fixtures without the field validate unchanged.
- New `defaultAiGenerativeStaticFallback` generator emits a single `ImageElement` filling the canvas with `src = curatedExample.src` (data URL cast as `ImageElement['src']` — same posture as `defaultVoiceStaticFallback` / `defaultWebEmbedStaticFallback`). Placeholder `TextElement` when `curatedExample` is absent.
- New `aiGenerativeStaticFallbackGenerator` wrapper registers against `staticFallbackGeneratorRegistry` for `family: 'ai-generative'` at subpath import time. Harness routing matches T-388a's contract — authored fallback wins for rendering but the generator is still invoked with `reason: 'authored'` for telemetry.
- Telemetry privacy posture: `hasExample` boolean + `exampleSrcLength` integer only — the URL string itself NEVER in attributes. Same posture as T-390 / T-392 / T-394.
- Determinism: pure transformation; no `Math.random` / `Date.now` / `performance.now` / fetch.

**Closes out `family: 'ai-generative'` structurally and Phase 13 γ-live coverage closes at five family pairs**: shader · three-scene · voice · ai-chat · live-data · web-embed · ai-generative. Future asset-generation families ship under Phase 14 / ADR-006.

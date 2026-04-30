---
'@stageflip/runtimes-interactive': minor
'@stageflip/schema': minor
---

T-394 — `WebEmbedClip` `staticFallback` (poster-screenshot generator).

- Adds optional `posterImage: { src, contentType? }` field on `webEmbedClipPropsSchema`. v1 accepts ONLY `data:` URLs (the refine enforces this); `http(s):` URLs deferred per the out-of-scope deferral. Backward-compatible — T-393 fixtures without the field validate unchanged.
- New `defaultWebEmbedStaticFallback` generator emits a single `ImageElement` filling the canvas with `src = posterImage.src` (data URL cast as `ImageElement['src']` — same posture as `defaultVoiceStaticFallback`). Placeholder `TextElement` when `posterImage` is absent.
- New `webEmbedStaticFallbackGenerator` wrapper registers against `staticFallbackGeneratorRegistry` for `family: 'web-embed'` at subpath import time. Harness routing matches T-388a's contract — authored fallback wins for rendering but the generator is still invoked with `reason: 'authored'` for telemetry.
- Telemetry privacy posture: `hasPoster` boolean + `posterSrcLength` integer only — the URL string itself NEVER in attributes (a 50KB inline data URL would balloon every event). Same posture as T-390 / T-391 / T-392 / T-393.
- Determinism: pure transformation; no `Math.random` / `Date.now` / `performance.now` / fetch.

Closes out `family: 'web-embed'` structurally. Final γ-live family pair pending: T-395/T-396 AiGenerativeClip (no specs yet).

---
'@stageflip/runtimes-interactive': minor
'@stageflip/schema': minor
---

T-395 — `AiGenerativeClip` `liveMount` (fifth and final γ-live family).

- New `aiGenerativeClipPropsSchema` on `@stageflip/schema` for `family: 'ai-generative'` props (`prompt`, `provider`, `model`, `negativePrompt?`, `seed?`, `width?`, `height?`, `posterFrame`). v1 is image-only; no `modality` field (adding one when audio/video lands is non-breaking).
- New `aiGenerativeClipFactory` + `AiGenerativeProvider` seam on `@stageflip/runtimes-interactive`. Host injects a `Generator` callable that returns `Promise<{ blob: Blob; contentType: string }>`; clip never references `globalThis.fetch` directly. Two implementations ship: `HostInjectedAiGenerativeProvider` and `InMemoryAiGenerativeProvider`.
- Mount renders the resolved blob into a single `<img>` element via `URL.createObjectURL`. Mount-time generation deferred via `queueMicrotask` so callers can subscribe `onResult`/`onError` first.
- **Blob-URL discipline**: `dispose()` MUST `URL.revokeObjectURL` the active blob URL — `createObjectURL` is a hidden GC root not handled by ordinary DOM teardown. Pinned in tests with spies on both `createObjectURL` and `revokeObjectURL`.
- Telemetry privacy posture: `promptLength` + `blobByteLength` integers only; prompt body, negativePrompt body, and generated blob bytes NEVER in attributes. Same posture as T-389 / T-391 / T-393.
- `check-preset-integrity` gains invariant 14 for `family: 'ai-generative'`.
- Pattern-eval reaffirmation at FIVE families (D-T395-10): NO `ProviderSeam<T>` extraction. Five shapes — Transcription / LLMChat / LiveData (text) / no-seam-WebEmbed / AiGenerative (binary Blob) — cannot share a generic abstraction.
- Skill expansion: `skills/stageflip/runtimes/ai-generative/SKILL.md` placeholder → substantive; `concepts/runtimes/SKILL.md` adds fifth-family entry + reaffirms `ProviderSeam<T>` ruling at five shapes; `concepts/clip-elements/SKILL.md` adds the `ai-generative` row + invariant 14 numbering note (Phase 13's seven frontier families now all ship a discriminator).

Pairs with T-396 (curated-example staticFallback). After T-396 lands, `family: 'ai-generative'` is structurally complete and **all five γ-live family pairs ship** — Phase 13 γ-live coverage closes.

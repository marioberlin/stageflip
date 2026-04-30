---
"@stageflip/runtimes-interactive": patch
---

T-388a: replace the family-hardcoded `if (clip.family !== 'voice')` branch
in `mount-harness.resolveStaticFallbackElements` (T-388 / PR #280) with a
per-family `StaticFallbackGeneratorRegistry` parallel to
`interactiveClipRegistry`.

`@stageflip/runtimes-interactive`:

- New module-level singleton `staticFallbackGeneratorRegistry` and class
  `StaticFallbackGeneratorRegistry` exported from the package root.
  Same `register` / `resolve` / `list` / `unregister` / `clear` shape as
  `InteractiveClipRegistry`. Throws
  `StaticFallbackGeneratorAlreadyRegisteredError` on duplicate
  registration. Browser-safe; `Map`-only.
- New `StaticFallbackGenerator` type and `StaticFallbackGeneratorContext`
  surface. Generators receive `{ clip, reason, emitTelemetry }`; their
  return value is consumed only when the clip's authored
  `staticFallback` is empty. Per D-T388a-3, the harness still INVOKES
  the generator with `reason: 'authored'` when authored fallbacks are
  used, so per-family telemetry continues to fire on that path.
- `InteractiveMountHarnessOptions` gains an optional
  `staticFallbackGeneratorRegistry` for test injection (mirrors the
  existing `registry` option).
- `clips/voice` (subpath) now registers a generator via
  `staticFallbackGeneratorRegistry.register('voice', ...)` at module-load
  time, parallel to the existing factory registration. The shared
  generator wrapper is exported as `voiceStaticFallbackGenerator` from
  the voice subpath and the package root.
- `mount-harness.resolveStaticFallbackElements` is now family-agnostic.
  The literal `clip.family !== 'voice'` no longer appears in
  `mount-harness.ts` (T-388a AC #11).

No behavioural change to existing T-388 consumers: the
`voice-clip.static-fallback.rendered` telemetry shape (`family`,
`reason`, `width`, `height`, `posterTextLength`) is unchanged, the
`defaultVoiceStaticFallback` signature is unchanged, authored fallbacks
still pass through verbatim. T-388 ACs #12 / #13 / #14 remain green.

Unblocks T-389 (`AiChatClip`) and the rest of the γ-live family work
(T-391 / T-393 / T-395) — each registers its own generator (or none)
without modifying the harness.

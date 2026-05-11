---
'@stageflip/sfx-stable-audio': minor
---

T-434 — `@stageflip/sfx-stable-audio`: Stable Audio Open SFX adapter
(Apache 2.0; short-form one-shot SFX + ambient loops; <=30s @
44100Hz mono PCM; in-process posture). Ninth and FINAL reference
adapter in the Phase 14 β sequence (CLOSES the reference-adapter
sequence 9 of 9; T-435 — Phase 14 β regression test suite — is the
β closer). First + only `sfx` modality adapter. Ships in stub mode
(deterministic silent-WAV `data:` URI; `isLoopable` mirrors
`call.loop`); production wire-up to a real Stable Audio Open
checkpoint is deferred to T-434a pending the ecosystem audit.
`pnpm check-asset-licenses` reports 9 adapters inspected; Stable
Audio Open verdict `allowed` (apache-2.0 ∈ sfx whitelist).

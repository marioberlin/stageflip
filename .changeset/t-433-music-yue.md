---
'@stageflip/music-yue': minor
---

T-433 — `@stageflip/music-yue`: YuE music adapter (Apache 2.0;
attribution-required; full-song generation up to 300s @ 44100Hz;
monetizable). Eighth reference adapter in the Phase 14 β sequence;
second `music-gen` modality adapter; first Apache-2.0-licensed music
adapter; first adapter to exercise the `attribution-required`
output-license disposition shipped in T-419. Provider emits
`attribution: "Generated with YuE (Apache 2.0)"` in every
`MusicGenResult`, which the T-423 handler bundle propagates into
`MediaProvenance.attribution` for the exporter / UI to surface. Ships
in stub mode (deterministic silent-WAV `data:` URI); production
wire-up to a real YuE ONNX checkpoint is deferred to T-433a pending
the ecosystem audit. `pnpm check-asset-licenses` reports 8 adapters
inspected; YuE verdict `allowed` (apache-2.0 ∈ music-gen whitelist).

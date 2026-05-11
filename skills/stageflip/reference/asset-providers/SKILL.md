---
title: Reference — Asset Providers
id: skills/stageflip/reference/asset-providers
tier: reference
status: auto-generated
last_updated: 2026-05-11
owner_task: T-424
related:
  - skills/stageflip/concepts/provider-seam
  - skills/stageflip/tools/asset-generation
---

# Reference — Asset Providers

**Auto-generated from `@stageflip/adapters-core`'s `AdapterRegistry`.**
Do NOT edit by hand — run `pnpm skills-sync` after registering or
removing an adapter; `pnpm skills-sync:check` fails in CI if the
committed file drifts.

5 adapters registered (vendor-neutral; per-tenant license-posture filtering happens in the routing engine, T-425).

The catalog is the **vendor-neutral** view: every adapter that ships
an `AdapterDescriptor` (ADR-007 §D1) appears here. Per-tenant
license-posture filtering (ADR-007 §D3 / ADR-008 §D13) happens in
the capability-routing engine (T-425), not here.

## Catalog

| Adapter ID | Modality | Capability summary | License | Cost tier | Latency tier | `requiresResearchProvider` |
|---|---|---|---|---|---|---|
| `meshy` | three-d | glb, 30000 poly | proprietary-byo | enterprise | batch < 5min | no |
| `tripo` | three-d | glb, 50000 poly | proprietary-byo | enterprise | batch < 5min | no |
| `fish-speech` | tts | 8 voices, 22050Hz | apache-2.0 | free | fast < 10s | no |
| `kokoro` | tts | 10 voices, 24000Hz | apache-2.0 | free | interactive < 1s | no |
| `seedance` | video-gen | 16:9/9:16/1:1, max 15s | proprietary-byo | enterprise | batch < 5min | no |

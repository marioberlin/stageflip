---
'@stageflip/adapters-core': minor
---

T-418 — `@stageflip/adapters-core` ships the runtime substrate for ADR-007
(Provider Seam Pattern). First substantive Phase 14 α code package.

Surface:

- `AdapterDescriptor` type + `adapterDescriptorSchema` Zod schema verbatim
  from ADR-007 §D1. Covers all 14 modality kinds (5 Phase 14 β + 7 source-
  grounded + research-session + audience-backend + bundle), 6 license
  postures, 4 sandbox kinds, optional cost / latency / sourceGrounded /
  requiresResearchProvider.
- `AdapterRegistry` — in-memory map keyed by `(modality.kind, id)`;
  `register` / `unregister` / `lookup` / `list` / `byCapability` /
  `clear` / `size`.
- `CapabilityDescriptorParser` — pluggable per-modality validator dispatch
  shell. Returns `'unvalidated'` when no validator is registered for a
  modality. T-419 ships the first concrete validators.
- `LicenseGate` interface + `defaultLicenseGate` impl matching ADR-007 §D3
  + THIRD_PARTY.md whitelist. `gpl-incompatible` refused unconditionally;
  `proprietary-byo` returns `requires-consent` when tenant credentials
  absent.
- `FallbackChainExecutor` — sequential adapter chain with one telemetry
  event per failure. Deterministic-by-construction (no `Date.now()` /
  `performance.now()` / RNG in the executor body); caller-supplied `clock`
  forwards a timestamp into telemetry attributes when needed.

Strict scope — registry + dispatch + license-gate + fallback-executor
ONLY. Modality-specific contracts are T-419 (`@stageflip/asset-gen-contract`).
Concrete adapters are T-426..T-434. Capability-routing engine is T-425.

NOT a structural extension per CLAUDE.md §13 — adds a new package
implementing the existing ADR-007 contract. Render verification N/A.

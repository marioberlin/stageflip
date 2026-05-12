---
'@stageflip/schema': patch
---

T-460 — adds the canonical schema-side `AudienceProvenance` declaration
in `@stageflip/schema` (new module
`packages/schema/src/elements/audience-provenance.ts`). Mirrors the T-452
preview shipped in `@stageflip/audience-contract` verbatim — same
fields, same Zod constraints, same `.strict()` posture, same inlined
`aggregation` discriminator. The contract package remains the single
source of truth for the discriminator + per-kind payload shapes; this
module imports `aggregationValueSchema`, `AUDIENCE_SNAPSHOT_POLICIES`,
and `AUDIENCE_CLIP_KINDS` from the contract and composes the
element-side schema.

Public surface adds: `audienceProvenanceSchema`, `AudienceProvenance`,
plus re-exports of `AUDIENCE_SNAPSHOT_POLICIES`, `AudienceSnapshotPolicy`,
`AUDIENCE_CLIP_KINDS`, and `AudienceClipKind` from `@stageflip/schema` so
the audience-clip element schemas (T-461..T-471) can depend on the
schema package only — single import surface, mirroring the
`MediaProvenance` precedent.

Additive non-breaking change — additive optional slot type; no element
variant references it yet (T-461..T-471 land the per-clip
`provenance?: AudienceProvenance` wiring), so every existing fixture /
preset / parity-golden continues to parse + render identically.

§13 structural extension per CLAUDE.md §13: deferral via option 3 —
render verification deferred to consumers — T-461..T-471 (per-clip
integration tests driving each element variant through the renderer
via T-454's `StaticFallbackRenderer`) + T-476 (Cluster I parity
fixtures + PO ratification). The roundtrip test in this PR
(`audience-provenance.test.ts`) verifies the SCHEMA layer is
non-breaking + matches the T-452 contract preview, plus a type-level
drift assertion that the schema-side and contract-side
`AudienceProvenance` types remain assignment-compatible in BOTH
directions.

---
'@stageflip/schema': minor
---

T-421 — adds two optional schema slots per ADR-008 §D2 / §D3:

- **`MediaProvenance`** (new module
  `packages/schema/src/elements/media-provenance.ts`) — strict, optional
  `provenance?` slot on `audioElementSchema`, `imageElementSchema`, and
  `videoElementSchema`. Records pipeline kind, provider, model, prompt,
  cache key (matching `@stageflip/asset-cache#cacheKeyString`), seed,
  voice metadata, cloned-voice consent reference, and source-grounded
  research session id + per-source citation ids.
- **`ResearchSessionRef`** (new module
  `packages/schema/src/research-session.ts`) — optional `research?`
  slot on `documentSchema`. Binds the document to a research-session-
  scoped source corpus (provider + sessionId + sources[] + createdAt).

Public surface adds: `mediaProvenanceSchema`,
`tenantVoiceConsentRefSchema`, `MEDIA_PROVENANCE_KINDS`,
`MediaProvenance`, `MediaProvenanceKind`, `TenantVoiceConsentRef`,
`researchSessionRefSchema`, `researchSourceSchema`,
`RESEARCH_SOURCE_KINDS`, `ResearchSessionRef`, `ResearchSource`,
`ResearchSourceKind`.

Additive non-breaking change — every existing fixture / preset /
parity-golden continues to parse + render identically. No
`SchemaVersion` bump required (per ADR-008 §D14).

§13 structural extension per CLAUDE.md §13: deferral via option 3 —
provenance / research are metadata; pixel-level verification is
gated on downstream consumer tasks (T-426..T-434 reference adapters,
T-436 TTS↔captions, T-438 placeholder UX, T-439..T-441 export
auto-marker). §13 evidence here is unit-test roundtrip + non-breaking-
change verification (full-repo `pnpm test` green).

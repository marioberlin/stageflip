---
---

T-415 — ADR-007 Provider Seam Pattern (meta) — Phase 14 α hard-gate
docs ADR.

Defines the `AdapterDescriptor` shape (id / modality / capability /
license / sandbox + `sourceGrounded` + `requiresResearchProvider`
flags), the `ResearchSessionProvider` meta-interface (NotebookLM
canonical), the seven per-modality source-grounded provider classes
preserved as ADR-008 downstream consumer scope, license-aware
routing rules, sandbox model, plugin contribution model, and the four
`LF-ADAPTER-*` loss-flag codes.

Folds in `docs/proposals/source-grounded-providers.md` Sections 2.1,
2.2, 2.4 + design decisions D1-D9 verbatim per plan v1.24 §"Required
reading" callout. ADR-008 absorption (Section 2.3 schema additions +
Section 2.4 per-modality interface bodies + Section 5 loss-flag
inventory) pending T-416.

Cross-references existing seam instances (`RuntimeContract`,
`TranscriptionProvider`, `StorageAdapter` / `TenantSettingsStore`)
as canonical examples per plan v1.22 directive.

Renumbered from plan-stated ADR-006 to resolve collision with
existing `docs/decisions/ADR-006-collab-crdt-transport.md` (T-260,
ratified 2026-04-27). Forward shift cascades: T-416 → ADR-008,
T-450 → ADR-009, T-451 → ADR-010, T-490 → ADR-012, T-491 → ADR-013,
T-492 → ADR-014. Plan v1.26 records the renumber.

No code, package, fixture, parity-golden, or skill changes — pure
docs. No publishable package version bumps.

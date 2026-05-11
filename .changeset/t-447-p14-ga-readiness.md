---
---

T-447 — Phase 14 GA readiness criteria.

Extends `scripts/check-ga-readiness.ts` (T-410) with **Category 8 —
Phase 14 GA readiness** (11 criteria covering ADR-007/008 ratification,
the 9 reference adapter packages + their `SecurityManifest` sidecars,
the `AdapterRegistry` wire-up, the three Phase 14 CI gates
(check-asset-licenses / check-adapter-regression / check-data-flow-security),
the `adapter-sandbox` + `usage-telemetry` packages, and the P14
documentation pass + closeout handover deliverables). Regenerates
`docs/ga-readiness-report.md` as the inaugural Phase 14 GA punch list.

Audit-only change. No publishable-package code touched; pure script
extension. NOT a CI gate per T-410 seal.

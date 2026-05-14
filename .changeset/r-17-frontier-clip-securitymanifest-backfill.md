---
'@stageflip/runtimes-interactive': minor
---

Close T-403 residual risk R-17: SecurityManifest backfill for the 5 Phase 13 frontier-clip provider seams (Voice / AiChat / LiveData / WebEmbed / AiGenerative). Each clip ships a sidecar security.json matching @stageflip/adapters-core's SecurityManifest schema. check-data-flow-security extended to discover + validate frontier-clip seams alongside Phase 14 adapters. Auditability now scales to third-party provider plug-ins. PO decision (2026-05-15) via Codex security review.

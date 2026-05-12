---
'@stageflip/pack-format': minor
---

T-494 — `@stageflip/pack-format` ships the Zod manifest schema per ADR-012
§D2 (discriminated `LicenseClaim` union: open / paid-per-tenant / enterprise;
`PackContributions` enum with 8 contribution kinds; strict-everywhere), Ed25519
detached-signature utilities per ADR-012 §D3 (Node's built-in `node:crypto`
Ed25519 primitives — no external dep), and the 5 `LF-LICENSE-*` / `LF-PACK-*`
loss flag codes per ADR-012 §D10.

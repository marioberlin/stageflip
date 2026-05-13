---
'@stageflip/marketplace-npm': minor
'@stageflip/pack-format': minor
---

T-539 — Marketplace: npm-based path — auth token management +
license-claim verification (P16 δ fourth task). Lands
`@stageflip/marketplace-npm` — the client-side library for the
marketplace's npm-based distribution fallback path per ADR-014 §D2 +
§D4. Exposes:

- `NpmTokenStore` interface with `InMemoryNpmTokenStore` (tests /
  transient sessions) + `FileBackedNpmTokenStore` (persistent
  `~/.stageflip/npm-tokens.json`, atomic-write protocol via
  tempfile + `rename(2)`).
- `verifyLicenseClaim(input, tokens)` — license-claim gate. Open
  packs always pass; paid / enterprise packs require BOTH a
  publisher-scope-bound npm token AND an `active` entitlement.
  Failure modes map to existing pack-format LF codes:
  `LF-NPM-TOKEN-MISSING` (new) / `LF-LICENSE-PACK-DENIED` /
  `LF-LICENSE-CLIP-REVOKED`.
- `createSidecarClient(deps)` — thin HTTP client for the
  marketplace's entitlement verification sidecar. POSTs
  `{ sku, tenantToken }`; 401 → `revoked`, 404 → `pending`, 5xx
  retries once. Malformed bodies throw.

Also adds the `LF-NPM-TOKEN-MISSING` code (severity `error`) to
`PACK_FORMAT_LF_CODES` / `PACK_FORMAT_LF_SPECS` in
`@stageflip/pack-format` (now 8 codes: 5 ADR-012 §D10 + 2 T-505
trial + 1 T-539 npm-path).

No external npm deps added; uses `node:fs/promises` / `node:path`
in the file-backed store and the platform `fetch` (with shim
override for tests) in the sidecar client. Concept skill
`skills/stageflip/concepts/marketplace-npm/SKILL.md` describes the
surface + the gate semantics. Determinism perimeter: outside
(`packages/marketplace-npm/**` is host / CLI side per CLAUDE.md §3).

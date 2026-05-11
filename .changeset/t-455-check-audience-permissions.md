---
'@stageflip/runtimes-audience': patch
---

T-455 — `check-audience-permissions` CI gate + `AudienceClipManifest`
type.

Extends `@stageflip/runtimes-audience` with a co-located manifest type
(`AudienceClipManifest`) shipped alongside every Live Audience clip
module under `packages/runtimes/audience/src/clips/<kind>/`. The
`permissions` field is typed as the literal tuple
`readonly ['audience-network']` per ADR-009 §D13 / ADR-010 §D6 — type-
level enforcement rejects extra or wider permissions at the call site
before the CI scan runs.

The companion CI gate (`scripts/check-audience-permissions.ts`,
runnable via `pnpm check-audience-permissions`) statically scans each
clip directory's `manifest.ts` (or `index.ts` fallback), locates the
`MANIFEST` export, and asserts `permissions` is the literal
`['audience-network']`. Failure modes: MISSING-MANIFEST, MISSING-
PERMISSIONS-KEY, WRONG-PERMISSIONS, EXTRA-PERMISSIONS, NON-LITERAL.

Inaugural state on `main` is empty (T-461..T-471 are downstream); the
gate exits 0 with "0 audience clips registered; audience-network
whitelist not yet exercised" mirroring `check-asset-licenses` (T-422).

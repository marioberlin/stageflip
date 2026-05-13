---
title: Marketplace npm-based path
id: skills/stageflip/concepts/marketplace-npm
tier: concept
status: substantive
last_updated: 2026-05-13
owner_task: T-539
related:
  - skills/stageflip/concepts/marketplace-registry/SKILL.md
  - skills/stageflip/concepts/licensing/SKILL.md
  - skills/stageflip/concepts/loss-flags/SKILL.md
---

# Marketplace npm-based path

`@stageflip/marketplace-npm` is the client-side library backing the
**npm-based distribution fallback path** per ADR-014 §D2 + §D4.

ADR-014 names two distribution paths for the marketplace:

1. **Dedicated registry** (`marketplace.stageflip.dev`) — the primary
   path, served by `@stageflip/marketplace-registry` (T-536) + the
   Stripe integration (T-537) + the browsing UI (T-538).
2. **npm-based path** — the fallback for tenants who prefer scoped
   npm packages over the dedicated registry. Standard npm tooling
   handles distribution; THIS package adds the auth-token store +
   license-claim verifier the dedicated registry implicitly provides.

T-539 ships the npm-based path.

## Surface

- **`NpmTokenStore`** — per-scope npm auth-token cache.
  - `InMemoryNpmTokenStore` — tests / transient sessions.
  - `FileBackedNpmTokenStore` — persistent, single-JSON-file
    backing. Atomic writes via tempfile + `rename(2)`. Production
    wiring points at `~/.stageflip/npm-tokens.json`.
- **`verifyLicenseClaim(input, tokens)`** — the install-time gate.
  Takes a `LicenseClaim` (from the pack manifest), the publisher's
  npm scope, and an optional `entitlementStatus`; returns
  `{ ok, reason?, detail? }`. Reasons map to existing pack-format LF
  codes.
- **`createSidecarClient(deps)`** — HTTP client for the marketplace
  entitlement verification sidecar. Production callers (the
  `stageflip-pack install` CLI, the desktop runtime) fetch
  `entitlementStatus` from here, then hand it to
  `verifyLicenseClaim`.

## Gate semantics

The license claim's `kind` drives the gate:

| Kind | Token required? | Entitlement required? | On failure |
|---|---|---|---|
| `open` | no | no | always passes |
| `paid-per-tenant` | yes (publisher scope) | `active` | LF-NPM-TOKEN-MISSING / LF-LICENSE-PACK-DENIED / LF-LICENSE-CLIP-REVOKED |
| `enterprise` | yes (publisher scope) | `active` | same as paid |

Decision order in `verifyLicenseClaim`:

1. `open` → `{ ok: true }` (short-circuit before any token check).
2. Look up token for `publisherScope`. If missing →
   `LF-NPM-TOKEN-MISSING`.
3. If `entitlementStatus === 'revoked'` →
   `LF-LICENSE-CLIP-REVOKED`.
4. If `entitlementStatus !== 'active'` (lapsed / pending / null /
   undefined) → `LF-LICENSE-PACK-DENIED`.
5. Else → `{ ok: true }`.

`unknown license.kind` throws — the discriminated union has exactly
three members and an unknown value is a programmer error.

## Sidecar wire format

The sidecar HTTP client POSTs to `<endpoint>/verify` with body
`{ sku, tenantToken }` and an `Authorization: Bearer <token>`
header. Response is `{ ok: boolean, status: 'active' | 'lapsed' |
'revoked' | 'pending' }`.

Failure handling:

| Server response | Client behavior |
|---|---|
| 2xx + valid body | return `{ ok, status }` |
| 401 | `{ ok: false, status: 'revoked' }` |
| 404 | `{ ok: false, status: 'pending' }` |
| 5xx | retry once; if still 5xx → throw |
| malformed JSON | throw |
| network error | throw (wrapped) |

The endpoint URL is supplied by the dedicated registry (T-536) at
tenant onboarding; this client only knows how to talk to it.

## LF code allocation

T-539 adds `LF-NPM-TOKEN-MISSING` to
`@stageflip/pack-format`'s `PACK_FORMAT_LF_CODES` /
`PACK_FORMAT_LF_SPECS` (severity `error`). The catalogue is now 8
codes: 5 from T-494 (ADR-012 §D10), 2 from T-505 (trial mode), 1
from T-539 (npm path).

## What's NOT in T-539

- **No CLI wrapper.** `stageflip-pack install` lives at T-540+; this
  package is the library it consumes.
- **No `~/.npmrc` mutation.** The token store is a separate sidecar
  cache; the tenant's `~/.npmrc` continues to drive `npm install`
  itself. The verifier consults the cache to decide whether the
  install should proceed.
- **No publisher onboarding flow.** Issuing tenant-scoped npm tokens
  is a marketplace-side concern handled by T-540 (tier system).
- **No production sidecar endpoint.** The HTTP client is shaped
  against the documented wire format; the actual sidecar deploys
  via T-550.

## Determinism perimeter

`packages/marketplace-npm/**` lives OUTSIDE the determinism
perimeter per CLAUDE.md §3. Both the file-backed token store
(`node:fs/promises`) and the sidecar client (`fetch`) are
host / CLI side; no clip / runtime code lives here.

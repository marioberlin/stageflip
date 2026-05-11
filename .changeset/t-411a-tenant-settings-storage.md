---
'@stageflip/storage': patch
'@stageflip/storage-postgres': patch
'@stageflip/storage-firebase': patch
---

T-411a — TenantSettings storage layer (1st of T-411 multi-PR sequence).

Adds a `TenantSettingsStore` facet to `@stageflip/storage` (the contract +
schema + in-memory adapter) and ships implementations on
`@stageflip/storage-postgres` (with new migration `0002_tenant_settings.sql`)
and `@stageflip/storage-firebase` (Firestore `tenant_settings/{tenantId}`
collection via a structural `FirestoreTenantSettingsLike` shim).

Schema (verbatim from T-411 D-T411-2): `tenantId`, `features.interactive ∈
{disabled, preview, ga}`, `updatedAt`, `updatedBy`. Both the outer object
and the nested `features` object are `.strict()` so unknown keys are
rejected at parse time.

Default-deny semantics live one layer up: the storage layer returns `null`
for absent rows; T-411b's tRPC `tenantSettings.get` procedure materialises
the `'disabled'` default per T-411 D-T411-5.

API / CLI / permission-shim / UI defer to T-411b–e per the parent spec's
multi-PR recommendation. NOT a structural extension per CLAUDE.md §13 —
adds a new storage facet to existing adapters; no clipKind / element type
/ compositing mode / runtime kind. Render verification N/A.

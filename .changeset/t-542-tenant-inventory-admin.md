---
'@stageflip/app-api': minor
---

T-542 — Per-tenant pack inventory admin surface. Adds a new read-only
Hono route `GET /admin/tenants/:tenantId/packs` to `apps/api` that lists
installed packs per tenant (`packId` / `publisherId` / `version` /
`licenseKind` / `entitlementStatus` / `installedAt`). Authorization is
admin-role-only (McpSessionRole `'admin'` / `'owner'` or the string
`'superadmin'`); non-admin McpSession principals + FirebasePrincipal
both 403. Persistence is abstracted behind a new
`TenantPackInventoryStore` interface; v1 ships an
`InMemoryTenantPackInventoryStore` (Map-backed; rows keyed by
`(tenantId, publisherId, packId)`; ordered `installedAt` desc with
`(publisherId, packId)` tiebreaker) used as the default in `createApp`.
Production wiring will inject a Firestore-backed adapter via T-550 —
deferred per spec. Mutating routes (revoke / force-uninstall) are
out-of-scope for this task. `ServerConfig` gains an optional
`tenantPackInventoryStore` dep; the `/admin/*` prefix is mounted behind
the existing Bearer-token `authMiddleware`. New skill at
`skills/stageflip/concepts/admin-pack-inventory/SKILL.md` documents the
surface.

---
title: Admin Pack Inventory
id: skills/stageflip/concepts/admin-pack-inventory
tier: concept
status: substantive
last_updated: 2026-05-14
owner_task: T-542
related:
  - skills/stageflip/concepts/tenant-settings/SKILL.md
  - skills/stageflip/concepts/auth/SKILL.md
  - skills/stageflip/concepts/marketplace-registry/SKILL.md
  - skills/stageflip/concepts/licensing/SKILL.md
---

# Admin Pack Inventory

The admin pack-inventory surface is one read-only HTTP route on
`apps/api` that lists the packs installed for a single tenant. Ops use
it to answer "what does tenant X have?" — version, license kind, and
entitlement status per row. There is no mutation in v1; revoke and
force-uninstall ship in a future task.

T-542 is the implementing spec (P16 δ, seventh task).

## The route

```
GET /admin/tenants/:tenantId/packs
```

Mounted on the root Hono app under `/admin`, behind the existing
Bearer-token `authMiddleware` covering `/admin/*`. The route handler
enforces the admin-role check inline.

Response shape on success (`200`):

```json
{
  "tenantId": "tenant-a",
  "packs": [
    {
      "tenantId": "tenant-a",
      "publisherId": "pub-x",
      "packId": "pack-1",
      "version": "2.0.0",
      "licenseKind": "paid-per-tenant",
      "entitlementStatus": "active",
      "installedAt": "2026-04-01T00:00:00.000Z"
    }
  ]
}
```

Empty inventory is `200` with `packs: []`. There is no "missing
tenant" concept — an unseen `tenantId` returns the same empty payload.

Error envelopes match the existing `apps/api` convention:

| Status | Body | When |
|---|---|---|
| `400` | `{ error: 'invalid_request', message }` | `tenantId` path-param fails the `[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}` regex |
| `401` | `{ error: 'unauthorized', message }` | Principal not set on the context (auth middleware bypassed) |
| `403` | `{ error: 'forbidden', message }` | Authenticated but role is not admin / owner / superadmin |
| `500` | `{ error: 'internal', message }` | Store call threw |

## Authorization

Admin-role-only. The predicate accepts:

| Principal kind | Role | Allowed |
|---|---|---|
| `mcp-session` | `'admin'` | yes |
| `mcp-session` | `'owner'` | yes |
| `mcp-session` | `'superadmin'` (string, not yet in `McpSessionRole`) | yes |
| `mcp-session` | `'viewer'` / `'editor'` / any other | no |
| `firebase` | (no role attached) | no |

The check is intentionally permissive on cross-tenant reads — this is
an org-ops surface, not an end-user surface. An admin in tenant A may
read tenant B's inventory. (Contrast with the
`/v1/tenant-settings/:tenantId` read predicate which denies
cross-tenant for non-superadmin actors.)

`'superadmin'` matches the same string-tolerant pattern documented in
`concepts/tenant-settings/SKILL.md` — the value is NOT yet a member of
`McpSessionRole`; a future PR will widen the union.

## The store: `TenantPackInventoryStore`

```ts
// apps/api/src/routes/admin-pack-inventory.ts
export interface TenantPackInventoryRow {
  readonly tenantId: string;
  readonly publisherId: string;
  readonly packId: string;
  readonly version: string;
  readonly licenseKind: 'open' | 'paid-per-tenant' | 'enterprise';
  readonly entitlementStatus:
    | 'active' | 'lapsed' | 'revoked' | 'pending' | 'trial' | null;
  readonly installedAt: string; // ISO-8601
}

export interface TenantPackInventoryStore {
  readonly listByTenant: (tenantId: string) => Promise<readonly TenantPackInventoryRow[]>;
  readonly upsert: (row: TenantPackInventoryRow) => Promise<void>;
}
```

`entitlementStatus` mirrors `TenantEntitlement.status` from
`@stageflip/pack-loader` (which gained `'trial'` in T-505 alongside the
existing `'active' | 'lapsed' | 'revoked' | 'pending'`). It is `null`
for `'open'` license packs which have no entitlement record.

`listByTenant` is the only method the route handler calls; `upsert`
exists for tests + as the seed point for the future pack-install /
pack-uninstall flows that will populate the store from the registry +
licensing surfaces.

### `InMemoryTenantPackInventoryStore`

Map-backed reference impl shipping in `@stageflip/app-api`. Rows are
keyed by `(tenantId, publisherId, packId)`; a subsequent `upsert` with
the same triple replaces the prior row. `listByTenant` returns rows
sorted `installedAt` desc with `(publisherId, packId)` as the
tiebreaker. `reset()` clears all tenants (test-only).

The Map-backed impl is the `createApp` default; production wiring will
inject a Firestore-backed adapter via T-550 (deferred).

## Server wire-up

`ServerConfig` gains:

```ts
tenantPackInventoryStore?: TenantPackInventoryStore;
```

`createApp` defaults it to a fresh `InMemoryTenantPackInventoryStore`,
applies `authMiddleware` to `/admin/*`, and mounts the route under
`/admin`. The full path the spec calls for is
`/admin/tenants/:tenantId/packs`.

The surface lives outside the determinism perimeter (`apps/api/**`
already does; CLAUDE.md §3 does not apply).

## Out of scope (deferred / future)

- **Mutation routes** — revoke / force-uninstall a pack from a tenant.
  Future task.
- **Firestore adapter** — production persistence. T-550.
- **Cross-tenant `list` of all installs** — only the per-tenant slice
  is exposed. A future superadmin route may add `GET /admin/packs` or
  similar.
- **Pagination + filtering by license / entitlement-status** — v1
  returns the full per-tenant list unfiltered. Filtering ships when a
  consumer needs it.
- **Audit log of "who looked at whose inventory"** — useful but
  separate; not in v1.
- **Soft-delete / tombstone semantics for revoked packs** — when revoke
  ships, the row stays with `entitlementStatus: 'revoked'`; no separate
  tombstone surface.

## Related

- ADR-008 — first-party packs + tenant install lifecycle (the source
  document model this surface reads from).
- Tasks: T-542 (this surface); T-541 (preceding P16 δ task — Sports
  Networks pack second register); T-550 (deferred — Firestore wiring +
  production adapter).
- Concept SKILLs: `concepts/tenant-settings/SKILL.md` (sibling admin
  surface; same auth-middleware mount posture);
  `concepts/marketplace-registry/SKILL.md` (where install events
  originate); `concepts/licensing/SKILL.md` (the entitlement row whose
  status this surface projects).
- CLAUDE.md §3 (determinism — does not apply); §13
  (structural-extension obligations — this surface is NOT a structural
  extension).

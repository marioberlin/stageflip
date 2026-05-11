---
title: Tenant Settings & Frontier Enablement
id: skills/stageflip/concepts/tenant-settings
tier: concept
status: substantive
last_updated: 2026-05-11
owner_task: T-411
related:
  - skills/stageflip/concepts/auth/SKILL.md
  - skills/stageflip/concepts/storage-contract/SKILL.md
  - skills/stageflip/concepts/runtimes/SKILL.md
---

# Tenant Settings & Frontier Enablement

The tenant-settings surface is one row per tenant, one knob (today),
gating one capability: the **interactive runtime tier** per ADR-005 §D3.
A tenant ships with `features.interactive: 'disabled'` and stays that
way until a superadmin (or, for `'preview'`, a tenant admin) flips it.

The surface composes four layers — a storage row, an HTTP API + CLI, an
authorization predicate, and a permission-shim integration — that
together implement ADR-005's "ships disabled by default" posture and
the §D5 mount-time enforcement order.

T-411 is the parent spec; sub-tasks T-411a / T-411b / T-411c shipped
the four layers in order. T-411e (admin UI) is deferred.

## What ships

| Layer | Package(s) | Surface |
|---|---|---|
| Storage | `@stageflip/storage` + `-postgres` + `-firebase` | `TenantSettings` row + `TenantSettingsStore` 3-method facet |
| API + CLI | `@stageflip/app-api` + `@stageflip/cli` | 3 Hono routes + `stageflip tenant set-interactive` command |
| Authorization | `@stageflip/app-api` | `canSetInteractive` pure-function predicate |
| Permission-shim | `@stageflip/runtimes-interactive` | `TenantFlagCache` + `PermissionShim.tenantFlagGate` mount option |

## The row: `TenantSettings`

```ts
// packages/storage/src/tenant-settings.ts
export const tenantSettingsSchema = z
  .object({
    tenantId: z.string().min(1),
    features: z
      .object({
        interactive: z.enum(['disabled', 'preview', 'ga']),
      })
      .strict(),
    updatedAt: z.string().datetime(),
    updatedBy: z.string().min(1),
  })
  .strict();
```

Both the outer object AND the nested `features` object are `.strict()`
so unknown keys at either level are rejected at parse time. v1 is
deliberately one knob — future widening (audit-log retention,
per-permission-kind grants, SSO config) is non-breaking via additional
optional fields on `features` and sibling fields on the outer object.

`features.interactive` semantics:

- `'disabled'` — interactive runtime tier denied for every deployment
  target. Default-deny for absent rows (see "Default posture" below).
- `'preview'` — `html` and `browser-live-preview` targets may
  live-mount; `on-device-display` stays on `staticFallback`.
- `'ga'` — every target may live-mount. Per ADR-005 §D7, this requires
  the security-review sign-off (T-403) and is **superadmin-only**.

## The contract: `TenantSettingsStore`

```ts
// packages/storage/src/tenant-settings-store.ts
export interface TenantSettingsStore {
  getTenantSettings(tenantId: string): Promise<TenantSettings | null>;
  putTenantSettings(settings: TenantSettings): Promise<void>;
  listTenantSettings(): Promise<TenantSettings[]>;
}
```

A separate facet from `StorageAdapter` (the doc-scoped 3-tier contract
in `concepts/storage-contract/SKILL.md`). Tenant settings are
tenant-scoped (`tenantId`-keyed) with a wholly different lifecycle —
the type system shouldn't pretend they're the same store. Adapters
implement either or both.

The store is **pure**: `getTenantSettings('absent') === null`. The
default-deny posture is materialised one layer up by the API route,
not by the store. This keeps the store interface small and predictable
(getters return what's persisted; nothing more).

Three implementations, each with a parallel test surface (round-trip /
upsert / list / null-on-absent / payload validation):

- `InMemoryTenantSettingsStore` (`@stageflip/storage`) — `Map`-backed;
  test + dev. `reset()` clears all rows.
- `PostgresTenantSettingsStore` (`@stageflip/storage-postgres`) —
  table `tenant_settings(tenant_id PK, features JSONB, updated_at,
  updated_by)`. Migration `0002_tenant_settings.sql`. Tested against
  `pg-mem`. `features` is JSONB so future v1+ widening is a code-only
  change with no DDL migration.
- `createFirebaseTenantSettingsStore({ firestore })`
  (`@stageflip/storage-firebase`) — targets the
  `tenant_settings/{tenantId}` collection. Region-routing is the
  consumer's job: deployments using `RegionRouter` instantiate one
  store per region (`us` / `eu`) and dispatch per request based on the
  tenant's region.

All three call `tenantSettingsSchema.parse()` before persisting —
defence in depth; the adapter is the last gate.

## The HTTP surface: three Hono routes

The implementation ships **Hono routes**, not tRPC. The parent T-411
spec said "tRPC router (or wherever the existing tRPC root lives —
implementer to confirm)"; the actual `@stageflip/app-api` is built on
Hono with no tRPC root, so T-411b followed the existing
`apps/api/src/routes/mcp-session.ts` convention. A future tRPC
migration is non-breaking — the route handlers extract their inputs
from `zValidator('json' | 'param')` and would be reusable as procedure
implementations.

```
GET  /v1/tenant-settings/:tenantId               → tenantSettings.get
POST /v1/tenant-settings/:tenantId/interactive   → tenantSettings.setInteractive
GET  /v1/tenant-settings                         → tenantSettings.list
```

All three sit behind the existing `authMiddleware` per the `/v1/*`
convention.

**`get`** — returns the persisted row when present. When absent,
synthesises a default-deny payload (`features.interactive: 'disabled'`
with `updatedAt: now()` and `updatedBy: '<systemActor>'`) and returns
it WITHOUT persisting. Read authorization: same-tenant or superadmin.

**`setInteractive`** — validates the body
`{ value: 'disabled' | 'preview' | 'ga' }`; runs `canSetInteractive`
(see below); on deny returns `403 { error: 'forbidden', reason }`; on
allow patches the row and `putTenantSettings(...)`. The first allowed
write **materialises** the row in the store (lazy creation per T-411
D-T411-5).

**`list`** — superadmin only; returns `{ tenantSettings: rows }`. May
be empty.

The clock is injected (`now: () => string`) into the route factory for
test hermeticity. Routes are I/O-bound and live outside the
determinism-gated paths; CLAUDE.md §3 does not apply.

The subrouter is a factory (`createTenantSettingsRoute({ store, now?,
systemActor? })`); the consumer wires the store at boot and mounts the
subrouter on the root app under `/v1/tenant-settings`. v1 wires an
in-memory store as the placeholder default; per-region Postgres /
Firebase wiring is a future deployment task.

## Authorization: `canSetInteractive`

A pure function in `apps/api/src/auth/can-set-interactive.ts`:

```ts
export type InteractiveValue = 'disabled' | 'preview' | 'ga';

export interface AuthorizationActor {
  readonly role:
    | 'viewer' | 'editor' | 'admin' | 'owner' | 'superadmin'
    | (string & {});
  readonly org: string;
}

export type AuthorizationDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string };

export function canSetInteractive(
  actor: AuthorizationActor,
  tenantId: string,
  currentValue: InteractiveValue,
  nextValue: InteractiveValue,
): AuthorizationDecision;
```

Two-role model (parent T-411 §D-T411-6, mapped onto the existing
`McpSessionRole` namespace):

| Actor role | Same tenant | Other tenant | Allowed transitions |
|---|---|---|---|
| `superadmin` | yes | yes | any → any (incl. `'ga'`) |
| `admin` (tenant_admin equivalent) | yes | no | `'disabled' ↔ 'preview'` only; `'ga'` denied |
| `owner` | yes | no | `'disabled' ↔ 'preview'` only; `'ga'` denied |
| `editor` / `viewer` / unknown | no | no | always denied |

**`'ga'` is deliberately superadmin-only.** Per ADR-005 §D7, GA
enablement requires the security-review sign-off; a tenant admin
cannot bypass it by clicking a button.

Cross-tenant calls (`actor.org !== tenantId`) are denied for any
non-superadmin actor with reason `'cross-tenant: ...'`.

`'superadmin'` is a NEW role value not yet in `McpSessionRole`'s
union; for v1 the predicate accepts any string role and falls through
to default-deny on unrecognised values. A future PR adds `'superadmin'`
to the union proper.

## The CLI

```
stageflip tenant set-interactive --tenant <id> --value <disabled|preview|ga> [--dry-run]
```

The CLI does NOT re-implement authorization. It POSTs to
`/v1/tenant-settings/<id>/interactive` carrying the user's MCP session
JWT (sourced from `STAGEFLIP_API_TOKEN`); the server enforces
authorization via `canSetInteractive`. In production, the ops-facing
CLI runs under a service-account credential granted the `superadmin`
role.

`--dry-run` prints the would-be POST URL + body and returns 0 without
sending. Useful for break-glass rehearsals.

The HTTP client is injectable (`TenantCommandDeps.createClient`) so
unit tests stub it and never hit real network. The default client uses
`fetch`.

## Default posture (the load-bearing rule)

Per ADR-005 §D3: "ships disabled by default for all tenants." This is
enforced at three layers:

1. **Storage**: `getTenantSettings('absent')` returns `null`. The
   store is pure; no implicit default materialisation.
2. **API `get`**: synthesises `{ features: { interactive: 'disabled' }
   }` for a `null` row and returns it WITHOUT persisting.
3. **API `setInteractive`**: the first allowed write materialises the
   row in the store.

Operators who want a tenant to ship in `'preview'` from day one MUST
flip the flag explicitly via the CLI or admin API as part of tenant
provisioning. Default-deny is the only safe posture for a
security-gated capability surface; a misconfigured tenant must not
accidentally get live-mount.

## The mount-time gate: `TenantFlagCache` + `PermissionShim.tenantFlagGate`

The interactive runtime host (`@stageflip/runtimes-interactive`) ships
the **tenant-flag cache** that the `PermissionShim` consults at
clip-mount time. The split is two surfaces:

```ts
// packages/runtimes/interactive/src/host/tenant-flag-cache.ts
export interface TenantFlagCache {
  readSync(tenantId: string, target: TenantFlagTarget): TenantFlagValue | undefined;
}

export interface MutableTenantFlagCache extends TenantFlagCache {
  populate(tenantId: string): Promise<void>;
  evict(tenantId?: string): void;
}

export type TenantFlagPopulator =
  (tenantId: string) => Promise<TenantFlagValue | null>;

export function createTenantFlagCache(
  options: { populator: TenantFlagPopulator },
): MutableTenantFlagCache;
```

**`readSync`** is sync, pure, and hot-path-safe — a `Map` lookup
against the in-process cache. No `await`, no `Date.now()`, no
`fetch()`. Safe to call from the determinism-gated clip scope per
CLAUDE.md §3.

**`populate(tenantId)`** is the ONLY async / network surface. The host
shell calls it at session start (NOT from clip code), invoking the
injected populator (which may call a `TenantSettingsStore` directly
server-side, or fetch `GET /v1/tenant-settings/:tenantId` from the
browser, or return a static value for tests). The cache seeds entries
for every target.

Default-deny on populator returning `null` (absent / unprovisioned
tenant): the cache stores `'disabled'` for every target. Default-deny
on populator throwing: entries stay unset; subsequent `readSync`
returns `undefined`, which the shim treats identically to
`'disabled'`.

**`evict(tenantId)`** clears a single tenant's entries (e.g., on
tenant logout); `evict()` clears the entire cache (test teardown,
session end). v1 has no automatic TTL eviction — operators flipping a
tenant's flag run `evict + populate` explicitly.

Crucially, the cache does NOT import `@stageflip/storage` —
`runtimes-interactive` is browser-bundle-safe; storage adapters are
server-side. The populator is injected; the cache makes no assumption
about its source.

### `PermissionShim.tenantFlagGate` mount option

The existing shim's mount sequence (per its file header) was:

1. tenant-policy `canMount(family)` → short-circuit on deny
2. iterate permissions → short-circuit on deny

T-411c inserted a **new step 0** opt-in via a constructor option:

0. tenant-flag matrix check via `TenantFlagCache.readSync` →
   short-circuit to `staticFallback` on insufficient posture.

```ts
export interface TenantFlagGateInput {
  cache: TenantFlagCache;
  tenantId: string;
  target: TenantFlagTarget;
}

export interface PermissionShimMountOptions {
  tenantFlagGate?: TenantFlagGateInput;
}
```

When `tenantFlagGate` is omitted (back-compat with all T-306 / T-385
consumers), the shim behaves exactly as before — no tenant-flag
check, no cache lookup. When supplied, the shim performs the matrix
check FIRST, before the family-policy gate. This matches ADR-005 §D5
step 1.

`PermissionResult` gains a third `reason` value `'tenant-flag-denied'`
on the `granted: false` branch. Existing consumers that switch on
`reason` without exhaustiveness keep compiling (the type widened, not
narrowed); consumers using `assertNever`-style exhaustiveness add a
case (a deliberate, narrow surface change).

### The `(features.interactive, target)` matrix

Restated verbatim from T-411 §D-T411-4 (which itself restates ADR-005
§D3). Source-of-truth lives there; the shim's
`TENANT_FLAG_GATING_MATRIX` const must stay in sync.

| Setting | `html` | `browser-live-preview` | `on-device-display` |
|---|---|---|---|
| `'disabled'` | static-fallback only | static-fallback only | static-fallback only |
| `'preview'` | live-mount | live-mount | static-fallback only |
| `'ga'` | live-mount | live-mount | live-mount |

Cache miss (`readSync` returns `undefined`) is treated as
`'disabled'`. Telemetry distinguishes the two: the
`'permission-denied-tenant-flag'` event carries
`flagValue: 'disabled' | 'preview' | 'ga' | 'cache-miss'` so operators
can tell "actively disabled" from "tenant flag not loaded".

### Telemetry

The shim emits `'permission-denied-tenant-flag'` with attributes:

```ts
{
  family: InteractiveClip['family'],
  tenantId: string,
  target: TenantFlagTarget,
  flagValue: TenantFlagValue | 'cache-miss',
}
```

Naming follows the existing `'tenant-denied'` / `'permission-denied'`
event family in `permission-shim.ts`. The sink is the existing
`EmitTelemetry` constructor parameter — no new wiring.

## Determinism posture

Mount-time call chain:

```
PermissionShim.mount(clip, options)
  → evaluateTenantFlagGating(cache, tenantId, target)
    → cache.readSync(tenantId, target)             // pure Map lookup
  → (existing) tenant-policy + permission iteration
```

No `Date.now()`, no `Math.random()`, no `fetch()`, no `setTimeout`,
no `await` on the hot path. The cache populator (`populate(tenantId)`)
DOES `await` — but that runs at session start in the host shell, never
from clip code.

`packages/runtimes/interactive/src/host/**` is NOT in the
`packages/runtimes/**/src/clips/**` scope of the determinism gate
(CLAUDE.md §3), but the cache is written defensively as if it were:
`readSync` is pure; `populate` is the only async surface.

## Rollout posture

Because `features.interactive` defaults to `'disabled'`, deploying the
T-411 implementations is instant-on without behavior change for any
existing tenant. The first behavioral effect happens when:

- A superadmin flips a tenant to `'preview'` → `liveMount` paths
  become reachable for `html` and `browser-live-preview`.
- A superadmin flips a tenant to `'ga'` → `liveMount` paths become
  reachable for `on-device-display` too.

**Rollback** is symmetric: superadmin flips back to `'disabled'`. The
shim re-reads on the next mount. **In-flight live-mounts are NOT torn
down** — v1 ships with mount-time-only gating per T-411 §D-T411-8. A
tear-down path is a future enhancement if security review asks for
one.

If a tenant gets stuck on `'preview'` and an interactive clip mounts
incorrectly, the recovery path is: superadmin CLI flip to
`'disabled'` → operator runs `cache.evict(tenantId)` followed by
`cache.populate(tenantId)` → all subsequent mounts go to
`staticFallback`. There is no "soft kill" intermediate posture in v1.

## Out of scope (deferred / future)

- **Admin UI** — settings panel, change-log view, RBAC management
  screens → T-411e (deferred per parent T-411 §D-T411-7).
- **Audit log** of who-changed-what-when. Useful but separate; needs
  its own retention / privacy / region policy.
- **`'superadmin'` added to `McpSessionRole` union** — v1's predicate
  accepts a string role; future PR formalises it.
- **Postgres / Firebase store wiring at server boot** — T-411b uses
  an in-memory placeholder; production wiring is a deployment task.
- **Per-permission-kind grants.** `features.interactive` is global per
  tenant; finer-grained "preview for shaders only" gating is not v1.
- **Soft-kill of in-flight live-mounts on rollback** — mount-time
  gating only.
- **Telemetry dashboards.** The `'permission-denied-tenant-flag'`
  observability event is logged; aggregate dashboards are downstream.
- **Self-service GA enablement.** `'ga'` requires superadmin; no
  self-service flow.
- **GraphQL or REST API surface.** Hono routes + CLI only in v1.
- **Region-routing per-request dispatch** at the consumer layer — the
  Firebase factory ships region-agnostic; per-tenant routing is a
  deployment concern.
- **Per-target populator override** — v1's populator returns one value
  seeded into all three targets; per-target overrides are a future
  widening when / if a consumer needs them.

## Related

- ADR-003 — interactive runtime tier (the layer this surface gates).
- ADR-005 — frontier clip catalogue; §D3 (the
  `features.interactive` 3-state toggle this surface implements);
  §D5 (the mount-time enforcement order — step 1 is the tenant-flag
  gate).
- Tasks: T-411 (parent spec); T-411a (storage); T-411b (API + CLI +
  authorization); T-411c (permission-shim wiring); T-411d (this
  concept SKILL + ADR-005 cross-link); T-411e (admin UI; deferred).
- Concept SKILLs: `concepts/auth/SKILL.md` (the role model);
  `concepts/storage-contract/SKILL.md` (sibling doc-scoped contract);
  `concepts/runtimes/SKILL.md` §"Interactive runtime tier" (the
  consumer of the mount-time gate).
- CLAUDE.md §3 (determinism rules the cache hot path satisfies);
  §13 (structural-extension obligations — this surface is NOT a
  structural extension).

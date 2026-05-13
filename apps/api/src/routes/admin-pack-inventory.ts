// apps/api/src/routes/admin-pack-inventory.ts
// T-542 — Per-tenant pack inventory admin route. Mounted under
// `/admin/tenants/:tenantId/packs`, this is the read-only surface ops
// uses to enumerate which packs a tenant has installed, at what
// version, and under what entitlement status. Mutation (revoke /
// force-uninstall) is deferred to a future task.
//
// The store interface is abstracted; v1 ships an in-memory
// implementation that the server defaults to. Production wiring binds
// a Firestore-backed adapter via T-550 (deferred).
//
// Authorization: admin-role-only (the McpSessionRole `'admin'` /
// `'owner'` or the string `'superadmin'`). FirebasePrincipal carries
// no role and is denied. Cross-tenant access is permitted for admins
// because this route is for org-ops, not end-user surface — the spec
// says "admin auth (existing auth middleware; admin role)" with no
// per-tenant scoping.

import { Hono } from 'hono';

import type { AuthVariables } from '../auth/middleware.js';
import type { Principal } from '../auth/verify.js';

/**
 * One row in the per-tenant pack inventory. Mirrors the
 * `TenantPackInstall` shape from `@stageflip/pack-loader` projected
 * to an admin-API DTO: only the fields ops needs to render a tenant's
 * installed-packs table, no internal entitlement detail.
 */
export interface TenantPackInventoryRow {
  readonly tenantId: string;
  readonly publisherId: string;
  readonly packId: string;
  readonly version: string;
  readonly licenseKind: 'open' | 'paid-per-tenant' | 'enterprise';
  /**
   * Entitlement status for paid / enterprise packs. Mirrors
   * `TenantEntitlement.status` from `@stageflip/pack-loader` (including
   * the `'trial'` value from T-505). `null` for `'open'` licenses,
   * which have no entitlement record.
   */
  readonly entitlementStatus: 'active' | 'lapsed' | 'revoked' | 'pending' | 'trial' | null;
  /** ISO-8601 timestamp of when the pack was installed for this tenant. */
  readonly installedAt: string;
}

/**
 * Persistence facet for the admin pack-inventory route. The
 * production wiring (T-550) binds a Firestore-backed adapter;
 * tests + dev use the in-memory implementation below.
 *
 * `listByTenant` is the only method the route handler calls.
 * `upsert` exists for tests + as the seed point for the future
 * pack-install / pack-uninstall flows that will populate the store.
 */
export interface TenantPackInventoryStore {
  readonly listByTenant: (tenantId: string) => Promise<readonly TenantPackInventoryRow[]>;
  readonly upsert: (row: TenantPackInventoryRow) => Promise<void>;
}

/**
 * Map-backed `TenantPackInventoryStore` for tests + dev. Rows are
 * keyed by `(tenantId, publisherId, packId)`; a subsequent `upsert`
 * with the same triple replaces the prior row.
 */
export class InMemoryTenantPackInventoryStore implements TenantPackInventoryStore {
  // Outer key: tenantId. Inner key: `${publisherId}/${packId}`.
  private readonly rows: Map<string, Map<string, TenantPackInventoryRow>> = new Map();

  async listByTenant(tenantId: string): Promise<readonly TenantPackInventoryRow[]> {
    const perTenant = this.rows.get(tenantId);
    if (!perTenant) return [];
    // Return a stable order: `installedAt` desc (newest first), then by
    // `${publisherId}/${packId}` ascending for ties. The route handler
    // relies on this; consumers should not assume insertion order.
    const out = Array.from(perTenant.values()).slice();
    out.sort((a, b) => {
      if (a.installedAt !== b.installedAt) {
        return a.installedAt < b.installedAt ? 1 : -1;
      }
      const ka = `${a.publisherId}/${a.packId}`;
      const kb = `${b.publisherId}/${b.packId}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    return out;
  }

  async upsert(row: TenantPackInventoryRow): Promise<void> {
    let perTenant = this.rows.get(row.tenantId);
    if (!perTenant) {
      perTenant = new Map();
      this.rows.set(row.tenantId, perTenant);
    }
    perTenant.set(`${row.publisherId}/${row.packId}`, row);
  }

  /** Test-only helper. Clears all tenants. */
  reset(): void {
    this.rows.clear();
  }
}

export interface AdminPackInventoryRouteDeps {
  /** Concrete `TenantPackInventoryStore` (in-memory / Firestore). */
  readonly store: TenantPackInventoryStore;
}

const TENANT_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

/**
 * Build the `/admin/tenants/:tenantId/packs` Hono subrouter.
 *
 * Authorization is enforced inline (not by a sibling middleware) so
 * the 401 / 403 paths are visible at this surface. The outer
 * `createApp` is expected to mount this on a path covered by the
 * existing `authMiddleware`, which populates `c.var.principal`. If
 * `principal` is unset (route mounted without auth), we return 401.
 */
export function createAdminPackInventoryRoute(
  deps: AdminPackInventoryRouteDeps,
): Hono<{ Variables: AuthVariables }> {
  const app = new Hono<{ Variables: AuthVariables }>();

  // GET /tenants/:tenantId/packs — list installed packs for one tenant.
  app.get('/tenants/:tenantId/packs', async (c) => {
    // 1. Auth check. `c.var.principal` is set by upstream
    // authMiddleware; if it's missing we treat it as a 401 (route
    // mounted without auth or auth middleware failed silently — both
    // are bugs the test surface should catch).
    const principal = c.var.principal as Principal | undefined;
    if (!principal) {
      return c.json({ error: 'unauthorized', message: 'principal not set' }, 401);
    }

    // 2. Role check — admin-only.
    if (!isAdminPrincipal(principal)) {
      return c.json({ error: 'forbidden', message: 'admin role required for pack inventory' }, 403);
    }

    // 3. Path-param validation. Reject empty / structurally invalid IDs
    // before we touch the store.
    const tenantId = c.req.param('tenantId');
    if (!tenantId || !TENANT_ID_PATTERN.test(tenantId)) {
      return c.json(
        { error: 'invalid_request', message: 'malformed tenantId path parameter' },
        400,
      );
    }

    // 4. Read-through to the store. Errors map to 500 — the store is
    // an internal dependency; transport-level error detail does not
    // leak.
    let rows: readonly TenantPackInventoryRow[];
    try {
      rows = await deps.store.listByTenant(tenantId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'internal', message: `inventory store failed: ${message}` }, 500);
    }

    return c.json({ tenantId, packs: rows });
  });

  return app;
}

/**
 * Admin-role predicate. The McpSessionRole namespace today is
 * `'viewer' | 'editor' | 'admin' | 'owner'`. We accept `'admin'` +
 * `'owner'` + the string `'superadmin'` (which is a NEW role value
 * not yet in the union — see `concepts/tenant-settings/SKILL.md`).
 * FirebasePrincipal carries no role and is always denied.
 */
function isAdminPrincipal(principal: Principal): boolean {
  if (principal.kind !== 'mcp-session') return false;
  const role = principal.role as string;
  return role === 'admin' || role === 'owner' || role === 'superadmin';
}

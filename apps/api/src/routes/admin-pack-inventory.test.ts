// apps/api/src/routes/admin-pack-inventory.test.ts
// T-542 — Admin pack-inventory route tests. Mirrors the
// tenant-settings.test.ts posture: drives the subrouter via Hono's
// in-memory `app.request(...)`, stubbing `c.var.principal` via a
// per-test header so the route logic is exercised in isolation from
// the auth verifier.

import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthVariables } from '../auth/middleware.js';
import type { FirebasePrincipal, McpPrincipal, Principal } from '../auth/verify.js';
import {
  InMemoryTenantPackInventoryStore,
  type TenantPackInventoryRow,
  type TenantPackInventoryStore,
  createAdminPackInventoryRoute,
} from './admin-pack-inventory.js';

function mcpPrincipal(overrides: Partial<McpPrincipal> = {}): McpPrincipal {
  return {
    kind: 'mcp-session',
    sub: 'user-1',
    org: 'tenant-a',
    role: 'admin',
    allowedBundles: [],
    ...overrides,
  };
}

function firebasePrincipal(overrides: Partial<FirebasePrincipal> = {}): FirebasePrincipal {
  return {
    kind: 'firebase',
    sub: 'fb-uid-1',
    ...overrides,
  };
}

interface Env {
  readonly app: Hono<{ Variables: AuthVariables }>;
  readonly store: InMemoryTenantPackInventoryStore;
  setPrincipal(p: Principal | undefined): void;
}

function buildEnv(): Env {
  const store = new InMemoryTenantPackInventoryStore();
  return buildEnvWithStore(store) as Env;
}

interface AnyEnv {
  readonly app: Hono<{ Variables: AuthVariables }>;
  setPrincipal(p: Principal | undefined): void;
}

function buildEnvWithStore(store: TenantPackInventoryStore): AnyEnv & {
  readonly store: InMemoryTenantPackInventoryStore;
} {
  let current: Principal | undefined = mcpPrincipal();
  const root = new Hono<{ Variables: AuthVariables }>();
  root.use('*', async (c, next) => {
    if (current !== undefined) {
      c.set('principal', current);
    }
    await next();
  });
  root.route('/admin', createAdminPackInventoryRoute({ store }));
  return {
    app: root,
    // The cast is safe at the use site — only the in-memory tests
    // touch `.store`; the throwing-store test uses its own builder.
    store: store as InMemoryTenantPackInventoryStore,
    setPrincipal(p) {
      current = p;
    },
  };
}

function row(overrides: Partial<TenantPackInventoryRow> = {}): TenantPackInventoryRow {
  return {
    tenantId: 'tenant-a',
    publisherId: 'pub-x',
    packId: 'pack-1',
    version: '1.0.0',
    licenseKind: 'open',
    entitlementStatus: null,
    installedAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('GET /admin/tenants/:tenantId/packs — happy path', () => {
  let env: Env;
  beforeEach(() => {
    env = buildEnv();
  });

  it('returns 200 with an empty packs array when the tenant has no rows', async () => {
    const res = await env.app.request('/admin/tenants/tenant-a/packs');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tenantId: string; packs: TenantPackInventoryRow[] };
    expect(body.tenantId).toBe('tenant-a');
    expect(body.packs).toEqual([]);
  });

  it('returns 200 with one row when the tenant has a single installed pack', async () => {
    const r = row();
    await env.store.upsert(r);
    const res = await env.app.request('/admin/tenants/tenant-a/packs');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tenantId: string; packs: TenantPackInventoryRow[] };
    expect(body.packs).toHaveLength(1);
    expect(body.packs[0]).toEqual(r);
  });

  it('returns multi-row inventory ordered by installedAt desc', async () => {
    await env.store.upsert(row({ packId: 'pack-old', installedAt: '2026-01-01T00:00:00.000Z' }));
    await env.store.upsert(row({ packId: 'pack-new', installedAt: '2026-03-01T00:00:00.000Z' }));
    await env.store.upsert(row({ packId: 'pack-mid', installedAt: '2026-02-01T00:00:00.000Z' }));
    const res = await env.app.request('/admin/tenants/tenant-a/packs');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tenantId: string; packs: TenantPackInventoryRow[] };
    expect(body.packs.map((p) => p.packId)).toEqual(['pack-new', 'pack-mid', 'pack-old']);
  });

  it('returns 200 with [] for a tenantId that has never been seen (no "missing tenant" concept)', async () => {
    await env.store.upsert(row({ tenantId: 'tenant-a' }));
    const res = await env.app.request('/admin/tenants/tenant-z/packs');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tenantId: string; packs: TenantPackInventoryRow[] };
    expect(body.tenantId).toBe('tenant-z');
    expect(body.packs).toEqual([]);
  });

  it('keeps order stable across repeated calls', async () => {
    await env.store.upsert(row({ packId: 'a', installedAt: '2026-04-01T00:00:00.000Z' }));
    await env.store.upsert(row({ packId: 'b', installedAt: '2026-04-02T00:00:00.000Z' }));
    await env.store.upsert(row({ packId: 'c', installedAt: '2026-04-03T00:00:00.000Z' }));
    const res1 = await env.app.request('/admin/tenants/tenant-a/packs');
    const res2 = await env.app.request('/admin/tenants/tenant-a/packs');
    const b1 = (await res1.json()) as { packs: TenantPackInventoryRow[] };
    const b2 = (await res2.json()) as { packs: TenantPackInventoryRow[] };
    expect(b1.packs.map((p) => p.packId)).toEqual(b2.packs.map((p) => p.packId));
  });

  it('isolates distinct tenants', async () => {
    await env.store.upsert(row({ tenantId: 'tenant-a', packId: 'a' }));
    await env.store.upsert(row({ tenantId: 'tenant-b', packId: 'b' }));
    const resA = await env.app.request('/admin/tenants/tenant-a/packs');
    const resB = await env.app.request('/admin/tenants/tenant-b/packs');
    const bA = (await resA.json()) as { packs: TenantPackInventoryRow[] };
    const bB = (await resB.json()) as { packs: TenantPackInventoryRow[] };
    expect(bA.packs.map((p) => p.packId)).toEqual(['a']);
    expect(bB.packs.map((p) => p.packId)).toEqual(['b']);
  });
});

describe('GET /admin/tenants/:tenantId/packs — auth + validation', () => {
  let env: Env;
  beforeEach(() => {
    env = buildEnv();
  });

  it('returns 401 when no principal is set (auth middleware bypassed)', async () => {
    env.setPrincipal(undefined);
    const res = await env.app.request('/admin/tenants/tenant-a/packs');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('unauthorized');
  });

  it('returns 403 for a non-admin McpSession principal (viewer)', async () => {
    env.setPrincipal(mcpPrincipal({ role: 'viewer' }));
    const res = await env.app.request('/admin/tenants/tenant-a/packs');
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('forbidden');
  });

  it('returns 403 for an editor McpSession principal', async () => {
    env.setPrincipal(mcpPrincipal({ role: 'editor' }));
    const res = await env.app.request('/admin/tenants/tenant-a/packs');
    expect(res.status).toBe(403);
  });

  it('returns 403 for a FirebasePrincipal (no role attached)', async () => {
    env.setPrincipal(firebasePrincipal());
    const res = await env.app.request('/admin/tenants/tenant-a/packs');
    expect(res.status).toBe(403);
  });

  it('allows owner role', async () => {
    env.setPrincipal(mcpPrincipal({ role: 'owner' }));
    const res = await env.app.request('/admin/tenants/tenant-a/packs');
    expect(res.status).toBe(200);
  });

  it('allows superadmin string role (not yet in McpSessionRole union)', async () => {
    env.setPrincipal(mcpPrincipal({ role: 'superadmin' as never }));
    const res = await env.app.request('/admin/tenants/tenant-a/packs');
    expect(res.status).toBe(200);
  });

  it('returns 400 for a malformed tenantId (contains slash via URL)', async () => {
    // A tenantId path-param with characters outside [a-zA-Z0-9_-] is
    // rejected. Hono routes parse the segment before the next slash;
    // here we use a control-character-like value via percent-encoding.
    const res = await env.app.request('/admin/tenants/%20bad%20id/packs');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid_request');
  });

  it('returns 500 when the store throws', async () => {
    const throwingStore: TenantPackInventoryStore = {
      listByTenant: async () => {
        throw new Error('boom');
      },
      upsert: async () => {
        // unused
      },
    };
    const throwEnv = buildEnvWithStore(throwingStore);
    const res = await throwEnv.app.request('/admin/tenants/tenant-a/packs');
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe('internal');
    expect(body.message).toMatch(/boom/);
  });
});

describe('InMemoryTenantPackInventoryStore — direct contract', () => {
  it('roundtrips upsert + listByTenant', async () => {
    const store = new InMemoryTenantPackInventoryStore();
    const r = row({ packId: 'rt', installedAt: '2026-05-01T00:00:00.000Z' });
    await store.upsert(r);
    const out = await store.listByTenant('tenant-a');
    expect(out).toEqual([r]);
  });

  it('replaces an existing row for the same (tenantId, publisherId, packId)', async () => {
    const store = new InMemoryTenantPackInventoryStore();
    await store.upsert(
      row({
        packId: 'same',
        version: '1.0.0',
        installedAt: '2026-01-01T00:00:00.000Z',
      }),
    );
    await store.upsert(
      row({
        packId: 'same',
        version: '2.0.0',
        installedAt: '2026-02-01T00:00:00.000Z',
        entitlementStatus: 'trial',
        licenseKind: 'paid-per-tenant',
      }),
    );
    const out = await store.listByTenant('tenant-a');
    expect(out).toHaveLength(1);
    expect(out[0]?.version).toBe('2.0.0');
    expect(out[0]?.entitlementStatus).toBe('trial');
    expect(out[0]?.licenseKind).toBe('paid-per-tenant');
  });

  it('isolates rows across distinct tenants', async () => {
    const store = new InMemoryTenantPackInventoryStore();
    await store.upsert(row({ tenantId: 'tenant-a', packId: 'pa' }));
    await store.upsert(row({ tenantId: 'tenant-b', packId: 'pb' }));
    const a = await store.listByTenant('tenant-a');
    const b = await store.listByTenant('tenant-b');
    expect(a.map((r) => r.packId)).toEqual(['pa']);
    expect(b.map((r) => r.packId)).toEqual(['pb']);
  });

  it('returns [] for a tenant with no rows', async () => {
    const store = new InMemoryTenantPackInventoryStore();
    expect(await store.listByTenant('absent')).toEqual([]);
  });

  it('reset() clears all rows', async () => {
    const store = new InMemoryTenantPackInventoryStore();
    await store.upsert(row());
    expect(await store.listByTenant('tenant-a')).toHaveLength(1);
    store.reset();
    expect(await store.listByTenant('tenant-a')).toEqual([]);
  });

  it('preserves the full TenantPackInventoryRow shape including all license kinds + entitlement statuses', async () => {
    const store = new InMemoryTenantPackInventoryStore();
    const open = row({ packId: 'p-open', licenseKind: 'open', entitlementStatus: null });
    const paid = row({
      packId: 'p-paid',
      licenseKind: 'paid-per-tenant',
      entitlementStatus: 'active',
      installedAt: '2026-04-02T00:00:00.000Z',
    });
    const ent = row({
      packId: 'p-ent',
      licenseKind: 'enterprise',
      entitlementStatus: 'trial',
      installedAt: '2026-04-03T00:00:00.000Z',
    });
    await store.upsert(open);
    await store.upsert(paid);
    await store.upsert(ent);
    const out = await store.listByTenant('tenant-a');
    // Ordered installedAt desc.
    expect(out.map((r) => r.packId)).toEqual(['p-ent', 'p-paid', 'p-open']);
    expect(out[0]?.licenseKind).toBe('enterprise');
    expect(out[0]?.entitlementStatus).toBe('trial');
  });
});

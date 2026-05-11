// apps/api/src/routes/tenant-settings.test.ts
// T-411b — TenantSettings route tests. Drives the subrouter via Hono's
// in-memory `app.request(...)` per the existing mcp-session.test.ts posture.
// Bypasses authMiddleware by mounting a tiny stub middleware that sets
// `c.var.principal` from a per-test header, so the routes are exercised in
// isolation from auth.

import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryTenantSettingsStore, type TenantSettings } from '@stageflip/storage';

import type { AuthVariables } from '../auth/middleware.js';
import type { McpPrincipal, Principal } from '../auth/verify.js';
import { createTenantSettingsRoute } from './tenant-settings.js';

function principal(overrides: Partial<McpPrincipal> = {}): McpPrincipal {
  return {
    kind: 'mcp-session',
    sub: 'user-1',
    org: 'tenant-a',
    role: 'admin',
    allowedBundles: [],
    ...overrides,
  };
}

interface Env {
  readonly app: Hono<{ Variables: AuthVariables }>;
  readonly store: InMemoryTenantSettingsStore;
  setPrincipal(p: Principal): void;
}

function buildEnv(now = '2026-05-11T00:00:00.000Z'): Env {
  const store = new InMemoryTenantSettingsStore();
  let current: Principal = principal();
  const root = new Hono<{ Variables: AuthVariables }>();
  root.use('*', async (c, next) => {
    c.set('principal', current);
    await next();
  });
  root.route(
    '/v1/tenant-settings',
    createTenantSettingsRoute({
      store,
      now: () => now,
      systemActor: 'system',
    }),
  );
  return {
    app: root,
    store,
    setPrincipal(p) {
      current = p;
    },
  };
}

describe('GET /v1/tenant-settings/:tenantId — happy path', () => {
  let env: Env;
  beforeEach(() => {
    env = buildEnv();
  });

  it('returns the persisted row when present', async () => {
    const seeded: TenantSettings = {
      tenantId: 'tenant-a',
      features: { interactive: 'preview' },
      updatedAt: '2026-04-01T12:00:00.000Z',
      updatedBy: 'user-prior',
    };
    await env.store.putTenantSettings(seeded);

    const res = await env.app.request('/v1/tenant-settings/tenant-a');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(seeded);
  });

  it('synthesises default-deny payload on absent row WITHOUT persisting', async () => {
    expect(env.store.size()).toBe(0);
    const res = await env.app.request('/v1/tenant-settings/tenant-a');
    expect(res.status).toBe(200);
    const body = (await res.json()) as TenantSettings;
    expect(body.tenantId).toBe('tenant-a');
    expect(body.features).toEqual({ interactive: 'disabled' });
    expect(body.updatedBy).toBe('system');
    // The synthesised default must NOT be persisted (parent §D-T411-5).
    expect(env.store.size()).toBe(0);
  });

  it('returns 403 on cross-tenant read by a non-superadmin', async () => {
    env.setPrincipal(principal({ org: 'tenant-b' }));
    const res = await env.app.request('/v1/tenant-settings/tenant-a');
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; reason: string };
    expect(body.error).toBe('forbidden');
    expect(body.reason).toMatch(/cross-tenant/);
  });

  it('allows superadmin cross-tenant read', async () => {
    env.setPrincipal(principal({ org: 'tenant-b', role: 'superadmin' as never }));
    const res = await env.app.request('/v1/tenant-settings/tenant-a');
    expect(res.status).toBe(200);
  });
});

describe('POST /v1/tenant-settings/:tenantId/interactive — happy path', () => {
  let env: Env;
  beforeEach(() => {
    env = buildEnv('2026-05-11T01:23:45.678Z');
  });

  it('rejects an invalid value with 400', async () => {
    const res = await env.app.request('/v1/tenant-settings/tenant-a/interactive', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'bogus' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects a missing body with 400', async () => {
    const res = await env.app.request('/v1/tenant-settings/tenant-a/interactive', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(400);
  });

  it('admin → preview on own tenant: 200 + materialises row + sets updatedAt/By', async () => {
    expect(env.store.size()).toBe(0);
    const res = await env.app.request('/v1/tenant-settings/tenant-a/interactive', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'preview' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as TenantSettings;
    expect(body).toEqual({
      tenantId: 'tenant-a',
      features: { interactive: 'preview' },
      updatedAt: '2026-05-11T01:23:45.678Z',
      updatedBy: 'user-1',
    });
    expect(env.store.size()).toBe(1);
    expect(await env.store.getTenantSettings('tenant-a')).toEqual(body);
  });

  it('admin → ga on own tenant: 403 forbidden (parent §D-T411-6 superadmin-only)', async () => {
    const res = await env.app.request('/v1/tenant-settings/tenant-a/interactive', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'ga' }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; reason: string };
    expect(body.error).toBe('forbidden');
    expect(body.reason).toMatch(/superadmin/i);
    expect(env.store.size()).toBe(0);
  });

  it('admin cross-tenant write: 403', async () => {
    env.setPrincipal(principal({ org: 'tenant-b' }));
    const res = await env.app.request('/v1/tenant-settings/tenant-a/interactive', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'preview' }),
    });
    expect(res.status).toBe(403);
  });

  it('superadmin → ga on any tenant: 200', async () => {
    env.setPrincipal(principal({ org: 'tenant-b', role: 'superadmin' as never }));
    const res = await env.app.request('/v1/tenant-settings/tenant-a/interactive', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'ga' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as TenantSettings;
    expect(body.features.interactive).toBe('ga');
  });

  it('viewer is denied with 403', async () => {
    env.setPrincipal(principal({ role: 'viewer' }));
    const res = await env.app.request('/v1/tenant-settings/tenant-a/interactive', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'preview' }),
    });
    expect(res.status).toBe(403);
  });

  it('overwrites an existing row on subsequent allowed writes', async () => {
    await env.app.request('/v1/tenant-settings/tenant-a/interactive', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'preview' }),
    });
    const res = await env.app.request('/v1/tenant-settings/tenant-a/interactive', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'disabled' }),
    });
    expect(res.status).toBe(200);
    expect((await env.store.getTenantSettings('tenant-a'))?.features.interactive).toBe('disabled');
  });
});

describe('GET /v1/tenant-settings — list (superadmin only)', () => {
  let env: Env;
  beforeEach(async () => {
    env = buildEnv();
    await env.store.putTenantSettings({
      tenantId: 'tenant-a',
      features: { interactive: 'preview' },
      updatedAt: '2026-04-01T00:00:00.000Z',
      updatedBy: 'u',
    });
    await env.store.putTenantSettings({
      tenantId: 'tenant-b',
      features: { interactive: 'disabled' },
      updatedAt: '2026-04-02T00:00:00.000Z',
      updatedBy: 'u',
    });
  });

  it('returns 403 to a non-superadmin (admin)', async () => {
    const res = await env.app.request('/v1/tenant-settings');
    expect(res.status).toBe(403);
  });

  it('returns the array to superadmin', async () => {
    env.setPrincipal(principal({ role: 'superadmin' as never }));
    const res = await env.app.request('/v1/tenant-settings');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tenantSettings: TenantSettings[] };
    expect(body.tenantSettings).toHaveLength(2);
    expect(body.tenantSettings.map((r) => r.tenantId).sort()).toEqual(['tenant-a', 'tenant-b']);
  });

  it('returns an empty array when the store is empty', async () => {
    const empty = buildEnv();
    empty.setPrincipal(principal({ role: 'superadmin' as never }));
    const res = await empty.app.request('/v1/tenant-settings');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tenantSettings: TenantSettings[] };
    expect(body.tenantSettings).toEqual([]);
  });
});

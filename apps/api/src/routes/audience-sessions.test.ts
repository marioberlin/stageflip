// apps/api/src/routes/audience-sessions.test.ts
// T-453 — Per-endpoint tests for the audience-sessions route:
// happy paths, auth failure (cross-tenant), audience-disabled posture,
// motion-native gate, tenant rate cap, voter cap, voter token mint.

import { describe, expect, it } from 'vitest';

import { issueMcpSessionJwt } from '@stageflip/mcp-server';

import {
  InMemoryAbuseTrackingStore,
  InMemoryAudienceResultsStore,
  InMemoryTenantSettingsStore,
} from '@stageflip/storage';

import { createApp } from '../server.js';

const SECRET = 'test-secret-32-bytes-minimum-len-ok';

function buildEnv() {
  const tenantSettingsStore = new InMemoryTenantSettingsStore();
  const audienceResultsStore = new InMemoryAudienceResultsStore({
    pepper: 'test-pepper-32-bytes-fixed-value-x',
  });
  const app = createApp({
    mcpSecret: SECRET,
    port: 0,
    resolvePrincipal: async () => ({
      sub: 'system',
      org: 'org-default',
      role: 'editor',
      allowedBundles: [],
    }),
    tenantSettingsStore,
    audienceResultsStore,
  });
  return { app, tenantSettingsStore, audienceResultsStore };
}

async function mcpToken(args: {
  sub?: string;
  org: string;
  role: 'editor' | 'admin' | 'viewer' | 'superadmin';
}): Promise<string> {
  return issueMcpSessionJwt({
    secret: SECRET,
    claims: {
      sub: args.sub ?? 'alice',
      org: args.org,
      role: args.role,
      allowedBundles: [],
    },
    ttlSeconds: 60,
  });
}

async function enableAudience(
  store: InMemoryTenantSettingsStore,
  tenantId: string,
  overrides: Partial<{
    motionNativeEnabled: boolean;
    maxIngestRateHz: number;
    maxConcurrentVotersPerSession: number;
    retentionDays: number;
  }> = {},
) {
  await store.putTenantSettings({
    tenantId,
    features: {
      interactive: 'ga',
      audience: {
        enabled: true,
        motionNativeEnabled: overrides.motionNativeEnabled ?? false,
        maxIngestRateHz: overrides.maxIngestRateHz ?? 100,
        maxConcurrentVotersPerSession: overrides.maxConcurrentVotersPerSession ?? 1000,
        retentionDays: overrides.retentionDays ?? 90,
      },
    },
    updatedAt: '2026-05-11T00:00:00.000Z',
    updatedBy: 'system',
  });
}

describe('POST /v1/audience/sessions — open session', () => {
  it('401s unauthenticated', async () => {
    const { app } = buildEnv();
    const res = await app.request('/v1/audience/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tenant-a',
        projectId: 'project-1',
        sessionId: 's-1',
        clipKind: 'live-poll-multiple-choice',
      }),
    });
    expect(res.status).toBe(401);
  });

  it('403s cross-tenant access', async () => {
    const { app } = buildEnv();
    const token = await mcpToken({ org: 'other-tenant', role: 'editor' });
    const res = await app.request('/v1/audience/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        tenantId: 'tenant-a',
        projectId: 'project-1',
        sessionId: 's-1',
        clipKind: 'live-poll-multiple-choice',
      }),
    });
    expect(res.status).toBe(403);
  });

  it('403s when tenant has audience disabled (default-deny on absent row)', async () => {
    const { app } = buildEnv();
    const token = await mcpToken({ org: 'tenant-a', role: 'editor' });
    const res = await app.request('/v1/audience/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        tenantId: 'tenant-a',
        projectId: 'project-1',
        sessionId: 's-1',
        clipKind: 'live-poll-multiple-choice',
      }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('audience_disabled');
  });

  it('403s motion-native clip kind when the tenant has the flag off', async () => {
    const { app, tenantSettingsStore } = buildEnv();
    await enableAudience(tenantSettingsStore, 'tenant-a', { motionNativeEnabled: false });
    const token = await mcpToken({ org: 'tenant-a', role: 'editor' });
    const res = await app.request('/v1/audience/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        tenantId: 'tenant-a',
        projectId: 'project-1',
        sessionId: 's-1',
        clipKind: 'heatmap',
      }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('motion_native_disabled');
  });

  it('200s and persists when audience is enabled', async () => {
    const { app, tenantSettingsStore, audienceResultsStore } = buildEnv();
    await enableAudience(tenantSettingsStore, 'tenant-a');
    const token = await mcpToken({ org: 'tenant-a', role: 'editor' });
    const res = await app.request('/v1/audience/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        tenantId: 'tenant-a',
        projectId: 'project-1',
        sessionId: 's-1',
        clipKind: 'live-poll-multiple-choice',
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sessionId: string; joinUrl: string; joinCode: string };
    expect(body.sessionId).toBe('s-1');
    expect(body.joinUrl).toContain('s-1');
    expect(body.joinCode).toBe('S-1');
    const stored = await audienceResultsStore.readSnapshot('s-1');
    expect(stored).not.toBeNull();
    expect(stored?.tenantId).toBe('tenant-a');
  });

  it('emits LF-AUDIENCE-TENANT-RATE-LIMITED + 429 when tenant burst is exhausted', async () => {
    const { app, tenantSettingsStore } = buildEnv();
    // Configure a very low tenant rate to exhaust the burst quickly.
    await enableAudience(tenantSettingsStore, 'tenant-a', { maxIngestRateHz: 1 });
    // App was already built with default-100 limiter; rebuild with a
    // smaller limiter by going through the dedicated route directly.
    const { createAudienceSessionsRoute, DEFAULT_AUDIENCE_FEATURE_SETTINGS } = await import(
      './audience-sessions.js'
    );
    void DEFAULT_AUDIENCE_FEATURE_SETTINGS;
    const { TenantRateLimiter } = await import('./audience-rate-limit.js');
    const { InMemoryAudienceResultsStore: Mem } = await import('@stageflip/storage');
    const t = 1_000_000;
    const audienceResultsStore = new Mem({ pepper: 'p'.repeat(32) });
    const route = createAudienceSessionsRoute({
      tenantSettingsStore,
      audienceResultsStore,
      now: () => t,
      tenantRateLimiter: new TenantRateLimiter({ maxIngestRateHz: 1, now: () => t }),
    });
    const direct = (await import('hono')).Hono;
    const wrapper = new direct<{ Variables: import('../auth/middleware.js').AuthVariables }>();
    wrapper.use('*', async (c, next) => {
      // Inject a fake principal for the cross-tenant gate.
      c.set('principal', {
        kind: 'mcp-session',
        sub: 'alice',
        org: 'tenant-a',
        role: 'editor',
        allowedBundles: [],
      });
      await next();
    });
    wrapper.route('/', route);

    const body = {
      tenantId: 'tenant-a',
      projectId: 'p',
      sessionId: 's-rate',
      clipKind: 'live-poll-multiple-choice',
    };
    // burst = 2 (= 2× 1Hz); third request must be refused.
    expect(
      (
        await wrapper.request('/', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...body, sessionId: 's-rate-1' }),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await wrapper.request('/', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...body, sessionId: 's-rate-2' }),
        })
      ).status,
    ).toBe(200);
    const res3 = await wrapper.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, sessionId: 's-rate-3' }),
    });
    expect(res3.status).toBe(429);
    const refused = (await res3.json()) as { lossFlag: { code: string } };
    expect(refused.lossFlag.code).toBe('LF-AUDIENCE-TENANT-RATE-LIMITED');
  });
});

describe('POST /v1/audience/sessions/:id/close — close session', () => {
  it('404s an unknown session', async () => {
    const { app, tenantSettingsStore } = buildEnv();
    await enableAudience(tenantSettingsStore, 'tenant-a');
    const token = await mcpToken({ org: 'tenant-a', role: 'editor' });
    const res = await app.request('/v1/audience/sessions/unknown/close', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });

  it('200s an open session — sets closedAt + recomputes ttlAt', async () => {
    const { app, tenantSettingsStore, audienceResultsStore } = buildEnv();
    await enableAudience(tenantSettingsStore, 'tenant-a', { retentionDays: 30 });
    await audienceResultsStore.openSession({
      tenantId: 'tenant-a',
      projectId: 'p',
      sessionId: 's-close',
      clipKind: 'live-poll-multiple-choice',
      adapterDescriptor: { id: 'audience-native', license: 'MIT' },
      createdAt: '2026-05-11T00:00:00.000Z',
      ttlAt: '2026-05-12T00:00:00.000Z',
    });
    const token = await mcpToken({ org: 'tenant-a', role: 'editor' });
    const res = await app.request('/v1/audience/sessions/s-close/close', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sessionId: string; closedAt: string };
    expect(body.sessionId).toBe('s-close');
    expect(body.closedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('GET /v1/audience/sessions/:id/state — current snapshot', () => {
  it('404s + emits LF-AUDIENCE-SNAPSHOT-MISSING when the session is unknown', async () => {
    const { app, tenantSettingsStore } = buildEnv();
    await enableAudience(tenantSettingsStore, 'tenant-a');
    const token = await mcpToken({ org: 'tenant-a', role: 'editor' });
    const res = await app.request('/v1/audience/sessions/unknown/state', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { lossFlag: { code: string } };
    expect(body.lossFlag.code).toBe('LF-AUDIENCE-SNAPSHOT-MISSING');
  });

  it('200s an open session for the owning tenant', async () => {
    const { app, tenantSettingsStore, audienceResultsStore } = buildEnv();
    await enableAudience(tenantSettingsStore, 'tenant-a');
    await audienceResultsStore.openSession({
      tenantId: 'tenant-a',
      projectId: 'p',
      sessionId: 's-state',
      clipKind: 'live-poll-multiple-choice',
      adapterDescriptor: { id: 'audience-native', license: 'MIT' },
      createdAt: '2026-05-11T00:00:00.000Z',
      ttlAt: '2026-05-12T00:00:00.000Z',
    });
    const token = await mcpToken({ org: 'tenant-a', role: 'editor' });
    const res = await app.request('/v1/audience/sessions/s-state/state', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { session: { sessionId: string } };
    expect(body.session.sessionId).toBe('s-state');
  });

  it('403s a cross-tenant read', async () => {
    const { app, tenantSettingsStore, audienceResultsStore } = buildEnv();
    await enableAudience(tenantSettingsStore, 'tenant-a');
    await audienceResultsStore.openSession({
      tenantId: 'tenant-a',
      projectId: 'p',
      sessionId: 's-state-xt',
      clipKind: 'live-poll-multiple-choice',
      adapterDescriptor: { id: 'audience-native', license: 'MIT' },
      createdAt: '2026-05-11T00:00:00.000Z',
      ttlAt: '2026-05-12T00:00:00.000Z',
    });
    const token = await mcpToken({ org: 'other-tenant', role: 'editor' });
    const res = await app.request('/v1/audience/sessions/s-state-xt/state', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });
});

describe('POST /v1/audience/sessions/:id/join — mint voter token', () => {
  it('404s an unknown session', async () => {
    const { app, tenantSettingsStore } = buildEnv();
    await enableAudience(tenantSettingsStore, 'tenant-a');
    const token = await mcpToken({ org: 'tenant-a', role: 'editor' });
    const res = await app.request('/v1/audience/sessions/unknown/join', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });

  it('410 + emits LF-AUDIENCE-SESSION-CLOSED on a closed session', async () => {
    const { app, tenantSettingsStore, audienceResultsStore } = buildEnv();
    await enableAudience(tenantSettingsStore, 'tenant-a');
    await audienceResultsStore.openSession({
      tenantId: 'tenant-a',
      projectId: 'p',
      sessionId: 's-closed',
      clipKind: 'live-poll-multiple-choice',
      adapterDescriptor: { id: 'audience-native', license: 'MIT' },
      createdAt: '2026-05-11T00:00:00.000Z',
      ttlAt: '2026-05-12T00:00:00.000Z',
    });
    await audienceResultsStore.closeSession({
      sessionId: 's-closed',
      closedAt: '2026-05-11T01:00:00.000Z',
      snapshotFrame: 0,
      ttlAt: '2026-08-09T01:00:00.000Z',
    });
    const token = await mcpToken({ org: 'tenant-a', role: 'editor' });
    const res = await app.request('/v1/audience/sessions/s-closed/join', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(410);
    const body = (await res.json()) as { lossFlag: { code: string } };
    expect(body.lossFlag.code).toBe('LF-AUDIENCE-SESSION-CLOSED');
  });

  it('200s + returns a voter token on a healthy session', async () => {
    const { app, tenantSettingsStore, audienceResultsStore } = buildEnv();
    await enableAudience(tenantSettingsStore, 'tenant-a');
    await audienceResultsStore.openSession({
      tenantId: 'tenant-a',
      projectId: 'p',
      sessionId: 's-join',
      clipKind: 'live-poll-multiple-choice',
      adapterDescriptor: { id: 'audience-native', license: 'MIT' },
      createdAt: '2026-05-11T00:00:00.000Z',
      ttlAt: '2026-05-12T00:00:00.000Z',
    });
    const token = await mcpToken({ org: 'tenant-a', role: 'editor' });
    const res = await app.request('/v1/audience/sessions/s-join/join', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { voterToken: string; sessionId: string };
    expect(body.voterToken).toMatch(/.+/);
    expect(body.sessionId).toBe('s-join');
  });

  it('429 + abuse-cooldown rejectReason when the IP is flagged (T-458)', async () => {
    const tenantSettingsStore = new InMemoryTenantSettingsStore();
    const audienceResultsStore = new InMemoryAudienceResultsStore({
      pepper: 'test-pepper-32-bytes-fixed-value-x',
    });
    const abuseTrackingStore = new InMemoryAbuseTrackingStore();
    // Pre-flag the IP at level 2 — 5 min cooldown.
    await abuseTrackingStore.flag({ kind: 'ip', value: '10.0.0.7' }, 2);
    const app = createApp({
      mcpSecret: SECRET,
      port: 0,
      resolvePrincipal: async () => ({
        sub: 'system',
        org: 'org-default',
        role: 'editor',
        allowedBundles: [],
      }),
      tenantSettingsStore,
      audienceResultsStore,
      abuseTrackingStore,
    });
    await enableAudience(tenantSettingsStore, 'tenant-a');
    await audienceResultsStore.openSession({
      tenantId: 'tenant-a',
      projectId: 'p',
      sessionId: 's-abuse',
      clipKind: 'live-poll-multiple-choice',
      adapterDescriptor: { id: 'audience-native', license: 'MIT' },
      createdAt: '2026-05-11T00:00:00.000Z',
      ttlAt: '2026-05-12T00:00:00.000Z',
    });
    const token = await mcpToken({ org: 'tenant-a', role: 'editor' });
    const res = await app.request('/v1/audience/sessions/s-abuse/join', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'x-forwarded-for': '10.0.0.7' },
    });
    expect(res.status).toBe(429);
    const body = (await res.json()) as {
      lossFlag: { code: string };
      rejectReason: string;
      abuseLevel: number;
    };
    expect(body.lossFlag.code).toBe('LF-AUDIENCE-VOTER-RATE-LIMITED');
    expect(body.rejectReason).toBe('abuse-cooldown');
    expect(body.abuseLevel).toBe(2);
  });

  it('409 + LF-AUDIENCE-CAPACITY-CAP when voter cap reached', async () => {
    const { app, tenantSettingsStore, audienceResultsStore } = buildEnv();
    await enableAudience(tenantSettingsStore, 'tenant-a', {
      maxConcurrentVotersPerSession: 1,
    });
    await audienceResultsStore.openSession({
      tenantId: 'tenant-a',
      projectId: 'p',
      sessionId: 's-cap',
      clipKind: 'live-poll-multiple-choice',
      adapterDescriptor: { id: 'audience-native', license: 'MIT' },
      createdAt: '2026-05-11T00:00:00.000Z',
      ttlAt: '2026-05-12T00:00:00.000Z',
    });
    const token = await mcpToken({ org: 'tenant-a', role: 'editor' });
    const first = await app.request('/v1/audience/sessions/s-cap/join', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'x-forwarded-for': '10.0.0.1' },
    });
    expect(first.status).toBe(200);
    const second = await app.request('/v1/audience/sessions/s-cap/join', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'x-forwarded-for': '10.0.0.2' },
    });
    expect(second.status).toBe(409);
    const body = (await second.json()) as { lossFlag: { code: string } };
    expect(body.lossFlag.code).toBe('LF-AUDIENCE-CAPACITY-CAP');
  });
});

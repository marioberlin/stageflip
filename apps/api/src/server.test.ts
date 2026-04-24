// apps/api/src/server.test.ts
// T-231 — integration test for the composed Hono app. Exercises
// /healthz + a protected route via app.request without opening a
// socket.

import { describe, expect, it, vi } from 'vitest';

import { issueMcpSessionJwt } from '@stageflip/mcp-server';

import { createApp } from './server.js';

const SECRET = 'test-secret-32-bytes-minimum-len-ok';

function buildApp() {
  return createApp({
    mcpSecret: SECRET,
    port: 0,
    resolvePrincipal: async ({ firebaseUid }) => ({
      sub: firebaseUid,
      org: 'org-default',
      role: 'editor',
      allowedBundles: ['read'],
    }),
    verifyFirebaseIdToken: vi.fn(async (t) => {
      if (t === 'bad') throw new Error('bad id-token');
      return { uid: `fb-${t}`, email: `${t}@example.com` };
    }),
  });
}

describe('createApp — health', () => {
  it('GET /healthz returns { ok: true }', async () => {
    const res = await buildApp().request('/healthz');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('createApp — auth flow', () => {
  it('401s unauthenticated access to /v1/*', async () => {
    const res = await buildApp().request('/v1/whoami');
    expect(res.status).toBe(401);
  });

  it('returns the principal when an MCP JWT is presented', async () => {
    const token = await issueMcpSessionJwt({
      secret: SECRET,
      claims: { sub: 'alice', org: 'acme', role: 'editor', allowedBundles: ['read'] },
      ttlSeconds: 60,
    });
    const res = await buildApp().request('/v1/whoami', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { principal: { sub: string; org: string } };
    expect(body.principal).toMatchObject({ sub: 'alice', org: 'acme' });
  });

  it('/auth/mcp-session mints a valid JWT from a Google id-token', async () => {
    const res = await buildApp().request('/auth/mcp-session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'alice', accessToken: 'at' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { jwt: string };
    expect(body.jwt.split('.')).toHaveLength(3);
  });
});

// apps/api/src/routes/mcp-session.test.ts
// T-229 /auth/mcp-session mint endpoint. Exercises the full flow
// via an in-memory Hono request.

import { describe, expect, it, vi } from 'vitest';

import { verifyMcpSessionJwt } from '@stageflip/mcp-server';

import { createMcpSessionRoute } from './mcp-session.js';

const MCP_SECRET = 'test-secret-32-bytes-minimum-len-ok';

function buildApp(overrides?: {
  verifyFirebaseIdToken?: Parameters<typeof createMcpSessionRoute>[0]['verifyFirebaseIdToken'];
  resolvePrincipal?: Parameters<typeof createMcpSessionRoute>[0]['resolvePrincipal'];
}) {
  return createMcpSessionRoute({
    mcpSecret: MCP_SECRET,
    ttlSeconds: 60,
    verifyFirebaseIdToken:
      overrides?.verifyFirebaseIdToken ??
      (async (token) => {
        if (token === 'bad') throw new Error('invalid-signature');
        return { uid: `fb-${token}`, email: `${token}@example.com` };
      }),
    resolvePrincipal:
      overrides?.resolvePrincipal ??
      (async ({ firebaseUid }) => ({
        sub: `user-${firebaseUid}`,
        org: 'org-default',
        role: 'editor',
        allowedBundles: ['read', 'create-mutate'],
      })),
  });
}

describe('POST /auth/mcp-session — happy path', () => {
  it('verifies Firebase id-token, resolves principal, mints an MCP session JWT', async () => {
    const app = buildApp();
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'good', accessToken: 'at' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { jwt: string };
    const verified = await verifyMcpSessionJwt({ secret: MCP_SECRET, token: body.jwt });
    expect(verified.sub).toBe('user-fb-good');
    expect(verified.org).toBe('org-default');
    expect(verified.allowedBundles).toEqual(['read', 'create-mutate']);
  });

  it('passes the Firebase claims into resolvePrincipal', async () => {
    const resolve = vi.fn(async () => ({
      sub: 'u',
      org: 'o',
      role: 'editor' as const,
      allowedBundles: [],
    }));
    const app = buildApp({ resolvePrincipal: resolve });
    await app.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'good', accessToken: 'at' }),
    });
    expect(resolve).toHaveBeenCalledWith({ firebaseUid: 'fb-good', email: 'good@example.com' });
  });
});

describe('POST /auth/mcp-session — error paths', () => {
  it('returns 401 when the id-token fails Firebase verification', async () => {
    const app = buildApp();
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'bad', accessToken: 'at' }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid_id_token');
  });

  it('returns 400 when the body is missing idToken', async () => {
    const app = buildApp();
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accessToken: 'at' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when the body is empty', async () => {
    const app = buildApp();
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '',
    });
    expect(res.status).toBe(400);
  });
});

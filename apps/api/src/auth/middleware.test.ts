// apps/api/src/auth/middleware.test.ts
// T-229 — middleware integration tests against a tiny Hono app.

import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { issueMcpSessionJwt } from '@stageflip/mcp-server';

import { authMiddleware } from './middleware.js';
import { createPrincipalVerifier } from './verify.js';

const MCP_SECRET = 'test-secret-32-bytes-minimum-len-ok';

async function session(
  overrides: Partial<Parameters<typeof issueMcpSessionJwt>[0]['claims']> = {},
): Promise<string> {
  return issueMcpSessionJwt({
    secret: MCP_SECRET,
    claims: {
      sub: 'u',
      org: 'o',
      role: 'editor',
      allowedBundles: ['read'],
      ...overrides,
    },
    ttlSeconds: 60,
  });
}

function buildApp(opts?: { allow?: Parameters<typeof authMiddleware>[0]['allow'] }) {
  const verify = createPrincipalVerifier({
    mcpSecret: MCP_SECRET,
    verifyFirebaseIdToken: vi.fn(async () => ({ uid: 'fb-uid', email: 'a@x' })),
  });
  const middlewareOpts = opts?.allow ? { verify, allow: opts.allow } : { verify };
  const app = new Hono();
  app.use('/protected/*', authMiddleware(middlewareOpts));
  app.get('/protected/me', (c) => c.json({ principal: c.var.principal }));
  app.get('/public', (c) => c.json({ ok: true }));
  return app;
}

describe('authMiddleware', () => {
  it('attaches the verified MCP principal to c.var.principal', async () => {
    const app = buildApp();
    const token = await session();
    const res = await app.request('/protected/me', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { principal: Record<string, unknown> };
    expect(body.principal).toMatchObject({ kind: 'mcp-session', sub: 'u', org: 'o' });
  });

  it('falls back to the Firebase path when MCP verification fails structurally', async () => {
    const app = buildApp();
    const res = await app.request('/protected/me', {
      headers: { authorization: 'Bearer not-an-mcp-jwt' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { principal: Record<string, unknown> };
    expect(body.principal).toMatchObject({ kind: 'firebase', sub: 'fb-uid' });
  });

  it('returns 401 with a structured body when no authorization header is present', async () => {
    const app = buildApp();
    const res = await app.request('/protected/me');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string; reason: string };
    expect(body.error).toBe('unauthorized');
    expect(body.reason).toBe('missing');
  });

  it('returns 401 with reason="expired" on an expired MCP JWT', async () => {
    const app = buildApp();
    const expired = await issueMcpSessionJwt({
      secret: MCP_SECRET,
      claims: { sub: 'u', org: 'o', role: 'viewer', allowedBundles: [] },
      ttlSeconds: -10,
    });
    const res = await app.request('/protected/me', {
      headers: { authorization: `Bearer ${expired}` },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { reason: string };
    expect(body.reason).toBe('expired');
  });

  it('leaves unprotected routes untouched', async () => {
    const app = buildApp();
    const res = await app.request('/public');
    expect(res.status).toBe(200);
  });

  it('returns 403 when the `allow` guard rejects the principal', async () => {
    const app = buildApp({ allow: (p) => p.kind === 'mcp-session' && p.role === 'admin' });
    const token = await session({ role: 'viewer' });
    const res = await app.request('/protected/me', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });
});

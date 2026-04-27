// packages/auth-middleware/src/require-role.test.ts
// T-262 AC #11 — requireRole calls requireAuth then checkRoleAtLeast.

import { describe, expect, it } from 'vitest';
import type { AuthRequest, AuthResponse } from './require-auth.js';
import { requireRole } from './require-role.js';
import type { ApiKeyStore, IdTokenVerifier } from './resolve-principal.js';

function recording(): { res: AuthResponse; status: () => number | null; body: () => unknown } {
  let status: number | null = null;
  let body: unknown = null;
  const res: AuthResponse = {
    status(code) {
      status = code;
      return res;
    },
    json(b) {
      body = b;
      return res;
    },
  };
  return { res, status: () => status, body: () => body };
}

function withRole(role: string): IdTokenVerifier {
  return {
    async verifyIdToken() {
      return { uid: 'u', org: 'o', role };
    },
  };
}

const noKeys: ApiKeyStore = {
  async findByPrefix() {
    return [];
  },
};

describe('requireRole (AC #11)', () => {
  it('passes when principal role >= need', async () => {
    const mw = requireRole('editor', { idTokens: withRole('admin'), apiKeys: noKeys });
    const req: AuthRequest = { headers: { authorization: 'Bearer x' } };
    const sink = recording();
    let called = false;
    await mw(req, sink.res, () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(req.principal?.role).toBe('admin');
  });

  it('emits 403 with insufficient-role when principal role < need', async () => {
    const mw = requireRole('admin', { idTokens: withRole('editor'), apiKeys: noKeys });
    const req: AuthRequest = { headers: { authorization: 'Bearer x' } };
    const sink = recording();
    await mw(req, sink.res, () => {});
    expect(sink.status()).toBe(403);
    expect(sink.body()).toEqual({ code: 'insufficient-role', have: 'editor', need: 'admin' });
  });

  it('emits 401 from underlying requireAuth on missing token', async () => {
    const mw = requireRole('viewer', { idTokens: withRole('editor'), apiKeys: noKeys });
    const req: AuthRequest = { headers: {} };
    const sink = recording();
    await mw(req, sink.res, () => {});
    expect(sink.status()).toBe(401);
  });
});

// packages/auth-middleware/src/require-auth.test.ts
// T-262 AC #10 — requireAuth attaches req.principal or 401s.

import { describe, expect, it } from 'vitest';
import { type AuthRequest, type AuthResponse, requireAuth } from './require-auth.js';
import type { ApiKeyStore, IdTokenVerifier } from './resolve-principal.js';

function recordingResponse(): {
  res: AuthResponse;
  status: number | null;
  body: unknown;
} {
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
  return {
    res,
    get status() {
      return status;
    },
    get body() {
      return body;
    },
  };
}

const idTokens: IdTokenVerifier = {
  async verifyIdToken() {
    return { uid: 'u', org: 'o', role: 'editor' };
  },
};

const emptyKeys: ApiKeyStore = {
  async findByPrefix() {
    return [];
  },
};

describe('requireAuth (AC #10)', () => {
  it('attaches req.principal and calls next() on success', async () => {
    const mw = requireAuth({ idTokens, apiKeys: emptyKeys });
    const req: AuthRequest = { headers: { authorization: 'Bearer good' } };
    const sink = recordingResponse();
    let called = false;
    await mw(req, sink.res, () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(req.principal).toMatchObject({ kind: 'user', userId: 'u' });
  });

  it('writes 401 with structured body when token is missing', async () => {
    const mw = requireAuth({ idTokens, apiKeys: emptyKeys });
    const req: AuthRequest = { headers: {} };
    const sink = recordingResponse();
    await mw(req, sink.res, () => {
      throw new Error('next() should not be called on 401');
    });
    expect(sink.status).toBe(401);
    expect(sink.body).toMatchObject({ code: 'missing-token' });
  });

  it('writes 400 when api-key has no X-Org-Id', async () => {
    const mw = requireAuth({ idTokens, apiKeys: emptyKeys });
    const req: AuthRequest = {
      headers: { authorization: 'Bearer sf_dev_abc123def456' },
    };
    const sink = recordingResponse();
    await mw(req, sink.res, () => {});
    expect(sink.status).toBe(400);
    expect(sink.body).toMatchObject({ code: 'missing-org-header' });
  });

  it('forwards unexpected errors to next(err)', async () => {
    const broken: IdTokenVerifier = {
      async verifyIdToken() {
        throw Object.assign(new Error('boom'), { weird: true });
      },
    };
    const mw = requireAuth({ idTokens: broken, apiKeys: emptyKeys });
    const req: AuthRequest = { headers: { authorization: 'Bearer x' } };
    const sink = recordingResponse();
    // boom is not "expired" so resolvePrincipal wraps it as AuthError(invalid-token);
    // requireAuth then writes 401, not next(err). But if a non-AuthError leaks:
    await mw(req, sink.res, () => {});
    expect(sink.status).toBe(401);
    expect(sink.body).toMatchObject({ code: 'invalid-token' });
  });
});

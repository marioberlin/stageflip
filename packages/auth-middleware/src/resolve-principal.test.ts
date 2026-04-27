// packages/auth-middleware/src/resolve-principal.test.ts
// T-262 AC #7–#9 — `resolvePrincipal` parses Authorization → Principal.

import { afterEach, describe, expect, it } from 'vitest';
import { _resetApiKeyCacheForTest, hashApiKey } from './api-key-verify.js';
import { AuthError } from './errors.js';
import {
  type ApiKeyStore,
  type DecodedFirebaseToken,
  type IdTokenVerifier,
  type McpSessionVerifier,
  type PersistedApiKey,
  resolvePrincipal,
} from './resolve-principal.js';

afterEach(() => {
  _resetApiKeyCacheForTest();
});

function stubIdTokens(decoded?: Partial<DecodedFirebaseToken>): IdTokenVerifier {
  return {
    async verifyIdToken(token) {
      if (token === 'expired') throw new Error('Firebase ID token has expired');
      if (token === 'bad') throw new Error('signature mismatch');
      return {
        uid: decoded?.uid ?? 'user-1',
        org: decoded?.org ?? 'org-1',
        role: decoded?.role ?? 'editor',
      };
    },
  };
}

function emptyApiKeyStore(): ApiKeyStore {
  return {
    async findByPrefix() {
      return [];
    },
  };
}

describe('resolvePrincipal — Firebase ID token (AC #7)', () => {
  it('returns a user principal with userId/orgId/role', async () => {
    const principal = await resolvePrincipal({
      authorization: 'Bearer good-token',
      orgIdHeader: undefined,
      idTokens: stubIdTokens(),
      apiKeys: emptyApiKeyStore(),
    });
    expect(principal).toEqual({ kind: 'user', userId: 'user-1', orgId: 'org-1', role: 'editor' });
  });

  it('rejects when role custom claim is unknown', async () => {
    const verifier = stubIdTokens({ role: 'superuser' });
    await expect(
      resolvePrincipal({
        authorization: 'Bearer good',
        orgIdHeader: undefined,
        idTokens: verifier,
        apiKeys: emptyApiKeyStore(),
      }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it('rejects when org claim is missing', async () => {
    const verifier: IdTokenVerifier = {
      async verifyIdToken() {
        return { uid: 'u', role: 'editor' };
      },
    };
    await expect(
      resolvePrincipal({
        authorization: 'Bearer t',
        orgIdHeader: undefined,
        idTokens: verifier,
        apiKeys: emptyApiKeyStore(),
      }),
    ).rejects.toMatchObject({ code: 'invalid-token' });
  });
});

describe('resolvePrincipal — error codes (AC #9)', () => {
  it('throws missing-token on absent Authorization header', async () => {
    await expect(
      resolvePrincipal({
        authorization: undefined,
        orgIdHeader: undefined,
        idTokens: stubIdTokens(),
        apiKeys: emptyApiKeyStore(),
      }),
    ).rejects.toMatchObject({ code: 'missing-token' });
  });

  it('throws invalid-token on malformed header', async () => {
    await expect(
      resolvePrincipal({
        authorization: 'NotBearer xyz',
        orgIdHeader: undefined,
        idTokens: stubIdTokens(),
        apiKeys: emptyApiKeyStore(),
      }),
    ).rejects.toMatchObject({ code: 'invalid-token' });
  });

  it('throws expired-token when verifier reports expiry', async () => {
    await expect(
      resolvePrincipal({
        authorization: 'Bearer expired',
        orgIdHeader: undefined,
        idTokens: stubIdTokens(),
        apiKeys: emptyApiKeyStore(),
      }),
    ).rejects.toMatchObject({ code: 'expired-token' });
  });

  it('throws invalid-token on generic verifier failure', async () => {
    await expect(
      resolvePrincipal({
        authorization: 'Bearer bad',
        orgIdHeader: undefined,
        idTokens: stubIdTokens(),
        apiKeys: emptyApiKeyStore(),
      }),
    ).rejects.toMatchObject({ code: 'invalid-token' });
  });
});

describe('resolvePrincipal — API key (AC #8)', () => {
  const TOKEN = 'sf_dev_AAAAAAabcdefghijklmnopqrstuv';

  async function persisted(): Promise<PersistedApiKey> {
    return {
      id: 'key-1',
      orgId: 'org-1',
      hashedKey: await hashApiKey(TOKEN),
      role: 'admin',
    };
  }

  it('looks up by prefix scoped to X-Org-Id and returns apiKey principal', async () => {
    const seen: { orgId: string; prefix: string }[] = [];
    const record = await persisted();
    const store: ApiKeyStore = {
      async findByPrefix(orgId, prefix) {
        seen.push({ orgId, prefix });
        return [record];
      },
    };
    const principal = await resolvePrincipal({
      authorization: `Bearer ${TOKEN}`,
      orgIdHeader: 'org-1',
      idTokens: stubIdTokens(),
      apiKeys: store,
    });
    expect(principal).toEqual({ kind: 'apiKey', orgId: 'org-1', keyId: 'key-1', role: 'admin' });
    expect(seen[0]?.orgId).toBe('org-1');
    expect(seen[0]?.prefix.startsWith('sf_dev_')).toBe(true);
  });

  it('rejects api-key without X-Org-Id with missing-org-header (400)', async () => {
    await expect(
      resolvePrincipal({
        authorization: `Bearer ${TOKEN}`,
        orgIdHeader: undefined,
        idTokens: stubIdTokens(),
        apiKeys: emptyApiKeyStore(),
      }),
    ).rejects.toMatchObject({ code: 'missing-org-header' });
  });

  it('rejects api-key whose stored hash does not match', async () => {
    const otherHash = await hashApiKey('sf_dev_DIFFERENTabcdefghijklmnopqrstuv');
    const store: ApiKeyStore = {
      async findByPrefix() {
        return [{ id: 'k', orgId: 'org-1', hashedKey: otherHash, role: 'editor' }];
      },
    };
    await expect(
      resolvePrincipal({
        authorization: `Bearer ${TOKEN}`,
        orgIdHeader: 'org-1',
        idTokens: stubIdTokens(),
        apiKeys: store,
      }),
    ).rejects.toMatchObject({ code: 'unknown-api-key' });
  });

  it('skips revoked keys', async () => {
    const record = await persisted();
    const revoked: PersistedApiKey = { ...record, revokedAt: 1 };
    const store: ApiKeyStore = {
      async findByPrefix() {
        return [revoked];
      },
    };
    await expect(
      resolvePrincipal({
        authorization: `Bearer ${TOKEN}`,
        orgIdHeader: 'org-1',
        idTokens: stubIdTokens(),
        apiKeys: store,
      }),
    ).rejects.toMatchObject({ code: 'unknown-api-key' });
  });
});

describe('resolvePrincipal — MCP session', () => {
  it('returns mcp-session principal when verifier accepts the token', async () => {
    const verifier: McpSessionVerifier = {
      async verifyMcpSessionJwt() {
        return { sub: 'u-2', org: 'org-2', role: 'viewer', allowedBundles: ['design'] };
      },
    };
    const principal = await resolvePrincipal({
      authorization: 'Bearer mcp.jwt.here',
      orgIdHeader: undefined,
      idTokens: stubIdTokens(),
      apiKeys: emptyApiKeyStore(),
      mcpSessions: verifier,
    });
    expect(principal).toEqual({
      kind: 'mcp-session',
      userId: 'u-2',
      orgId: 'org-2',
      role: 'viewer',
      allowedBundles: ['design'],
    });
  });

  it('falls through to Firebase verifier if mcp verifier rejects', async () => {
    const verifier: McpSessionVerifier = {
      async verifyMcpSessionJwt() {
        throw new Error('not an mcp session');
      },
    };
    const principal = await resolvePrincipal({
      authorization: 'Bearer regular.firebase.jwt',
      orgIdHeader: undefined,
      idTokens: stubIdTokens(),
      apiKeys: emptyApiKeyStore(),
      mcpSessions: verifier,
    });
    expect(principal.kind).toBe('user');
  });
});

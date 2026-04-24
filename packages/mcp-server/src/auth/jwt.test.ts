// packages/mcp-server/src/auth/jwt.test.ts
// T-223 — JWT issuance + verification. Uses an HS256 shared secret
// (symmetric) because the MCP flow pins one signer (our API) and one
// verifier (the MCP server); neither needs asymmetric key handling.

import { describe, expect, it } from 'vitest';

import { issueMcpSessionJwt, verifyMcpSessionJwt } from './jwt.js';

const SECRET = 'test-secret-32-bytes-minimum-len-ok';

describe('issueMcpSessionJwt', () => {
  it('round-trips claims through verifyMcpSessionJwt', async () => {
    const token = await issueMcpSessionJwt({
      secret: SECRET,
      claims: {
        sub: 'user-123',
        org: 'org-abc',
        role: 'editor',
        allowedBundles: ['read', 'create-mutate'],
      },
      ttlSeconds: 60,
    });
    const verified = await verifyMcpSessionJwt({ secret: SECRET, token });
    expect(verified).toMatchObject({
      sub: 'user-123',
      org: 'org-abc',
      role: 'editor',
      allowedBundles: ['read', 'create-mutate'],
    });
  });

  it('emits an `iss` of "stageflip" and a `typ` of "mcp-session"', async () => {
    const token = await issueMcpSessionJwt({
      secret: SECRET,
      claims: { sub: 'u', org: 'o', role: 'viewer', allowedBundles: [] },
      ttlSeconds: 60,
    });
    const verified = await verifyMcpSessionJwt({ secret: SECRET, token });
    expect(verified.iss).toBe('stageflip');
    expect(verified.typ).toBe('mcp-session');
  });

  it('sets exp = now + ttlSeconds within a small tolerance', async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await issueMcpSessionJwt({
      secret: SECRET,
      claims: { sub: 'u', org: 'o', role: 'viewer', allowedBundles: [] },
      ttlSeconds: 3600,
    });
    const verified = await verifyMcpSessionJwt({ secret: SECRET, token });
    expect(verified.exp).toBeGreaterThanOrEqual(before + 3600 - 2);
    expect(verified.exp).toBeLessThanOrEqual(before + 3600 + 2);
  });
});

describe('verifyMcpSessionJwt — rejection paths', () => {
  it('rejects a token signed with a different secret', async () => {
    const token = await issueMcpSessionJwt({
      secret: SECRET,
      claims: { sub: 'u', org: 'o', role: 'viewer', allowedBundles: [] },
      ttlSeconds: 60,
    });
    await expect(
      verifyMcpSessionJwt({ secret: 'different-secret-32-bytes-min-len', token }),
    ).rejects.toThrow(/signature|verification|invalid/i);
  });

  it('rejects an expired token', async () => {
    const token = await issueMcpSessionJwt({
      secret: SECRET,
      claims: { sub: 'u', org: 'o', role: 'viewer', allowedBundles: [] },
      ttlSeconds: -10,
    });
    await expect(verifyMcpSessionJwt({ secret: SECRET, token })).rejects.toThrow(/expired|exp/i);
  });

  it('rejects garbage input that does not parse as a JWT', async () => {
    await expect(verifyMcpSessionJwt({ secret: SECRET, token: 'not.a.jwt' })).rejects.toThrow();
  });

  it('rejects a token with the wrong `typ`', async () => {
    const token = await issueMcpSessionJwt({
      secret: SECRET,
      claims: { sub: 'u', org: 'o', role: 'viewer', allowedBundles: [] },
      ttlSeconds: 60,
      typ: 'something-else',
    });
    await expect(verifyMcpSessionJwt({ secret: SECRET, token })).rejects.toThrow(
      /typ|mcp-session/i,
    );
  });
});

describe('allowedBundles claim', () => {
  it('returns an empty array when the issuer requested an empty scope', async () => {
    const token = await issueMcpSessionJwt({
      secret: SECRET,
      claims: { sub: 'u', org: 'o', role: 'viewer', allowedBundles: [] },
      ttlSeconds: 60,
    });
    const verified = await verifyMcpSessionJwt({ secret: SECRET, token });
    expect(verified.allowedBundles).toEqual([]);
  });
});

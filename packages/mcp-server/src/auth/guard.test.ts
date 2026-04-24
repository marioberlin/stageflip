// packages/mcp-server/src/auth/guard.test.ts
// T-223 — MCP request guard. Extracts the bearer JWT from an MCP
// session-metadata object, verifies it, and returns the allowedBundles
// the server should scope the session to.

import { describe, expect, it } from 'vitest';

import { UnauthorizedError, guardMcpSession } from './guard.js';
import { issueMcpSessionJwt } from './jwt.js';

const SECRET = 'test-secret-32-bytes-minimum-len-ok';

async function sessionToken(
  claims: Partial<Parameters<typeof issueMcpSessionJwt>[0]['claims']> = {},
): Promise<string> {
  return await issueMcpSessionJwt({
    secret: SECRET,
    claims: {
      sub: 'u',
      org: 'o',
      role: 'editor',
      allowedBundles: ['read', 'create-mutate'],
      ...claims,
    },
    ttlSeconds: 60,
  });
}

describe('guardMcpSession — success', () => {
  it('returns the verified principal + allowedBundles from the JWT', async () => {
    const token = await sessionToken();
    const result = await guardMcpSession({
      secret: SECRET,
      metadata: { authorization: `Bearer ${token}` },
    });
    expect(result.principal.sub).toBe('u');
    expect(result.principal.org).toBe('o');
    expect(result.principal.role).toBe('editor');
    expect(result.allowedBundles).toEqual(['read', 'create-mutate']);
  });

  it('accepts lower-case `bearer` prefix (RFC 6750 is case-insensitive)', async () => {
    const token = await sessionToken();
    const result = await guardMcpSession({
      secret: SECRET,
      metadata: { authorization: `bearer ${token}` },
    });
    expect(result.principal.sub).toBe('u');
  });
});

describe('guardMcpSession — rejections', () => {
  it('throws UnauthorizedError when metadata has no authorization header', async () => {
    await expect(guardMcpSession({ secret: SECRET, metadata: {} })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('throws when the header is present but has no Bearer prefix', async () => {
    const token = await sessionToken();
    await expect(
      guardMcpSession({ secret: SECRET, metadata: { authorization: token } }),
    ).rejects.toThrow(/bearer/i);
  });

  it('throws when the token has a bad signature', async () => {
    const token = await sessionToken();
    await expect(
      guardMcpSession({
        secret: 'wrong-secret-that-is-at-least-32b',
        metadata: { authorization: `Bearer ${token}` },
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('throws when the JWT is expired', async () => {
    const expired = await issueMcpSessionJwt({
      secret: SECRET,
      claims: {
        sub: 'u',
        org: 'o',
        role: 'editor',
        allowedBundles: [],
      },
      ttlSeconds: -10,
    });
    await expect(
      guardMcpSession({
        secret: SECRET,
        metadata: { authorization: `Bearer ${expired}` },
      }),
    ).rejects.toMatchObject({ reason: 'expired' });
  });
});

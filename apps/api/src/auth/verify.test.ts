// apps/api/src/auth/verify.test.ts
// T-229 — auth verifier: accepts either a Firebase ID token or a
// T-223 MCP session JWT. Tests inject a mock Firebase verifier so CI
// never hits accounts.google.com.

import { describe, expect, it, vi } from 'vitest';

import { issueMcpSessionJwt } from '@stageflip/mcp-server';

import { UnauthorizedError, createPrincipalVerifier } from './verify.js';

const MCP_SECRET = 'test-secret-32-bytes-minimum-len-ok';

describe('createPrincipalVerifier — MCP session path', () => {
  it('accepts a valid MCP session JWT and returns a principal tagged "mcp-session"', async () => {
    const token = await issueMcpSessionJwt({
      secret: MCP_SECRET,
      claims: { sub: 'user-1', org: 'org-a', role: 'editor', allowedBundles: ['read'] },
      ttlSeconds: 60,
    });
    const verifier = createPrincipalVerifier({
      mcpSecret: MCP_SECRET,
      verifyFirebaseIdToken: vi.fn(),
    });
    const principal = await verifier(`Bearer ${token}`);
    expect(principal).toMatchObject({
      kind: 'mcp-session',
      sub: 'user-1',
      org: 'org-a',
      role: 'editor',
      allowedBundles: ['read'],
    });
  });

  it('prefers MCP session path when the token passes that verification', async () => {
    const token = await issueMcpSessionJwt({
      secret: MCP_SECRET,
      claims: { sub: 'u', org: 'o', role: 'viewer', allowedBundles: [] },
      ttlSeconds: 60,
    });
    const firebaseMock = vi.fn();
    const verifier = createPrincipalVerifier({
      mcpSecret: MCP_SECRET,
      verifyFirebaseIdToken: firebaseMock,
    });
    await verifier(`Bearer ${token}`);
    expect(firebaseMock).not.toHaveBeenCalled();
  });
});

describe('createPrincipalVerifier — Firebase ID path', () => {
  it('falls back to Firebase verification when MCP verification fails', async () => {
    const firebaseMock = vi.fn().mockResolvedValue({
      uid: 'firebase-uid-123',
      email: 'alice@example.com',
    });
    const verifier = createPrincipalVerifier({
      mcpSecret: MCP_SECRET,
      verifyFirebaseIdToken: firebaseMock,
    });
    const principal = await verifier('Bearer not-an-mcp-jwt');
    expect(principal).toEqual({
      kind: 'firebase',
      sub: 'firebase-uid-123',
      email: 'alice@example.com',
    });
    expect(firebaseMock).toHaveBeenCalledWith('not-an-mcp-jwt');
  });
});

describe('createPrincipalVerifier — rejections', () => {
  it('throws UnauthorizedError for missing header', async () => {
    const verifier = createPrincipalVerifier({
      mcpSecret: MCP_SECRET,
      verifyFirebaseIdToken: vi.fn(),
    });
    await expect(verifier(undefined)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('throws UnauthorizedError for missing Bearer prefix', async () => {
    const verifier = createPrincipalVerifier({
      mcpSecret: MCP_SECRET,
      verifyFirebaseIdToken: vi.fn(),
    });
    await expect(verifier('just-a-token')).rejects.toThrow(/bearer/i);
  });

  it('throws when neither MCP nor Firebase verification succeeds', async () => {
    const firebaseMock = vi.fn().mockRejectedValue(new Error('invalid firebase token'));
    const verifier = createPrincipalVerifier({
      mcpSecret: MCP_SECRET,
      verifyFirebaseIdToken: firebaseMock,
    });
    await expect(verifier('Bearer garbage')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('throws on an expired MCP session JWT without falling through to Firebase', async () => {
    const expired = await issueMcpSessionJwt({
      secret: MCP_SECRET,
      claims: { sub: 'u', org: 'o', role: 'viewer', allowedBundles: [] },
      ttlSeconds: -10,
    });
    const firebaseMock = vi.fn();
    const verifier = createPrincipalVerifier({
      mcpSecret: MCP_SECRET,
      verifyFirebaseIdToken: firebaseMock,
    });
    await expect(verifier(`Bearer ${expired}`)).rejects.toMatchObject({
      reason: 'expired',
    });
    expect(firebaseMock).not.toHaveBeenCalled();
  });
});

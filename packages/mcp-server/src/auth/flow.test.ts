// packages/mcp-server/src/auth/flow.test.ts
// T-223 — OAuth flow orchestrator. End-to-end via a MockAuthProvider so
// CI never hits a real identity provider.

import { promises as fs, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type AuthProvider, MockAuthProvider, runAuthFlow } from './flow.js';
import { issueMcpSessionJwt } from './jwt.js';
import { verifyMcpSessionJwt } from './jwt.js';
import { createFileTokenStore } from './store.js';

const API_SECRET = 'test-secret-32-bytes-minimum-len-ok';

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'stageflip-flow-'));
});
afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true });
});

function mockProvider(overrides?: Partial<AuthProvider>): AuthProvider {
  const base = new MockAuthProvider({
    issuer: 'mock-idp',
    exchange: async ({ code, codeVerifier }) => {
      // Mock IdP: echo the verifier back as proof PKCE was threaded.
      return {
        accessToken: `at-${code}-${codeVerifier.slice(0, 4)}`,
        refreshToken: `rt-${code}`,
        idToken: JSON.stringify({ sub: 'user-42', email: 'u@example.com' }),
      };
    },
    mintSessionJwt: async ({ idToken }) => {
      const parsed = JSON.parse(idToken) as { sub: string };
      return await issueMcpSessionJwt({
        secret: API_SECRET,
        claims: {
          sub: parsed.sub,
          org: 'org-default',
          role: 'editor',
          allowedBundles: ['read', 'create-mutate'],
        },
        ttlSeconds: 3600,
      });
    },
  });
  if (!overrides) return base;
  // Wrap overridden methods while preserving the class instance so
  // `authorizationUrl` (a prototype method) remains callable.
  return {
    issuer: base.issuer,
    authorizationUrl: base.authorizationUrl.bind(base),
    exchange: overrides.exchange ?? base.exchange,
    mintSessionJwt: overrides.mintSessionJwt ?? base.mintSessionJwt,
  };
}

describe('runAuthFlow — happy path', () => {
  it('drives the PKCE round-trip and persists a verified JWT in the token store', async () => {
    const store = createFileTokenStore({ path: path.join(workDir, 'auth.json') });
    const provider = mockProvider();
    const redirect = vi.fn<(url: string) => Promise<string>>().mockResolvedValue('auth-code-xyz');

    const result = await runAuthFlow({
      provider,
      store,
      redirectHandler: redirect,
      profile: 'default',
    });

    expect(result.profile).toBe('default');
    expect(redirect).toHaveBeenCalledOnce();
    const url = redirect.mock.calls[0]?.[0] ?? '';
    expect(url).toContain('code_challenge=');
    expect(url).toContain('code_challenge_method=S256');

    const stored = await store.load();
    expect(stored).not.toBeNull();
    if (!stored) return;
    const verified = await verifyMcpSessionJwt({ secret: API_SECRET, token: stored.jwt });
    expect(verified.sub).toBe('user-42');
    expect(verified.allowedBundles).toEqual(['read', 'create-mutate']);
    expect(stored.refreshToken).toBe('rt-auth-code-xyz');
    expect(stored.issuer).toBe('mock-idp');
  });
});

describe('runAuthFlow — error paths', () => {
  it('wraps a redirectHandler rejection as a flow error without touching the store', async () => {
    const store = createFileTokenStore({ path: path.join(workDir, 'auth.json') });
    const provider = mockProvider();
    const redirect = vi
      .fn<(url: string) => Promise<string>>()
      .mockRejectedValue(new Error('user closed browser'));

    await expect(
      runAuthFlow({
        provider,
        store,
        redirectHandler: redirect,
        profile: 'default',
      }),
    ).rejects.toThrow(/closed browser|redirect/i);

    expect(await store.load()).toBeNull();
  });

  it('errors if the provider-minted JWT fails verification against our secret', async () => {
    const store = createFileTokenStore({ path: path.join(workDir, 'auth.json') });
    const provider = mockProvider({
      mintSessionJwt: async () => {
        return await issueMcpSessionJwt({
          secret: 'different-wrong-secret-32-bytes-mn',
          claims: {
            sub: 'x',
            org: 'o',
            role: 'viewer',
            allowedBundles: [],
          },
          ttlSeconds: 60,
        });
      },
    });
    const redirect = vi.fn<(url: string) => Promise<string>>().mockResolvedValue('code');
    await expect(
      runAuthFlow({
        provider,
        store,
        redirectHandler: redirect,
        profile: 'default',
        verifySecret: API_SECRET,
      }),
    ).rejects.toThrow(/signature|verification|invalid/i);
  });
});

describe('runAuthFlow — PKCE verifier uniqueness', () => {
  it('generates a fresh verifier per flow invocation', async () => {
    const store = createFileTokenStore({ path: path.join(workDir, 'auth.json') });
    const urls: string[] = [];
    const redirect = vi.fn<(url: string) => Promise<string>>().mockImplementation(async (url) => {
      urls.push(url);
      return 'code';
    });
    const provider = mockProvider();

    await runAuthFlow({ provider, store, redirectHandler: redirect, profile: 'default' });
    await runAuthFlow({ provider, store, redirectHandler: redirect, profile: 'default' });

    const challenges = urls.map((u) => new URL(u).searchParams.get('code_challenge'));
    expect(challenges[0]).not.toBe(challenges[1]);
  });
});

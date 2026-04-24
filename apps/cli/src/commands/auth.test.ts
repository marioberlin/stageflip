// apps/cli/src/commands/auth.test.ts
// Exercises login/logout/whoami with mocked AuthProvider + TokenStore.

import { promises as fs, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MockAuthProvider, createFileTokenStore, issueMcpSessionJwt } from '@stageflip/mcp-server';
import type { AuthProvider, TokenStore } from '@stageflip/mcp-server';

import type { CliEnv } from '../types.js';
import { createAuthCommands } from './auth.js';

const SECRET = 'test-secret-32-bytes-minimum-len-ok';

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'stageflip-auth-cmd-'));
});
afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true });
});

function envFor(overrides: Record<string, string | undefined> = {}): {
  env: CliEnv;
  logs: string[];
  errors: string[];
} {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    logs,
    errors,
    env: {
      cwd: workDir,
      env: overrides,
      log: (l) => logs.push(l),
      error: (l) => errors.push(l),
      exit: () => {
        throw new Error('unexpected exit');
      },
    },
  };
}

function mockProvider(): AuthProvider {
  const base = new MockAuthProvider({
    issuer: 'mock',
    exchange: async () => ({ accessToken: 'at', refreshToken: 'rt', idToken: 'id' }),
    mintSessionJwt: async () =>
      issueMcpSessionJwt({
        secret: SECRET,
        claims: {
          sub: 'user-1',
          org: 'org-1',
          role: 'editor',
          allowedBundles: ['read'],
        },
        ttlSeconds: 60,
      }),
  });
  return {
    issuer: base.issuer,
    authorizationUrl: base.authorizationUrl.bind(base),
    exchange: base.exchange,
    mintSessionJwt: base.mintSessionJwt,
  };
}

function tokenStore(file: string): TokenStore {
  return createFileTokenStore({ path: file });
}

describe('login', () => {
  it('persists a minted JWT via the mocked provider + store', async () => {
    const storeFile = path.join(workDir, 'auth.json');
    const { env, logs } = envFor();
    const cmds = createAuthCommands({
      createProvider: () => mockProvider(),
      createStore: () => tokenStore(storeFile),
      openBrowser: vi.fn(async () => 'the-auth-code'),
    });
    const code = await cmds.runLogin({ env, args: [], flags: {} });
    expect(code).toBe(0);
    expect(logs[0]).toMatch(/logged in/i);
    const stored = JSON.parse(await fs.readFile(storeFile, 'utf8'));
    expect(stored.issuer).toBe('mock');
  });

  it('surfaces redirect-handler rejections as a login failure', async () => {
    const storeFile = path.join(workDir, 'auth.json');
    const { env, errors } = envFor();
    const cmds = createAuthCommands({
      createProvider: () => mockProvider(),
      createStore: () => tokenStore(storeFile),
      openBrowser: vi.fn(async () => {
        throw new Error('browser not available');
      }),
    });
    const code = await cmds.runLogin({ env, args: [], flags: {} });
    expect(code).toBe(1);
    expect(errors[0]).toMatch(/login failed/i);
    await expect(fs.access(storeFile)).rejects.toThrow();
  });
});

describe('logout', () => {
  it('clears the local token store', async () => {
    const storeFile = path.join(workDir, 'auth.json');
    await fs.mkdir(path.dirname(storeFile), { recursive: true });
    await fs.writeFile(
      storeFile,
      JSON.stringify({
        jwt: 'x',
        refreshToken: 'y',
        expiresAt: 0,
        issuer: 'mock',
        profile: 'default',
      }),
    );
    const { env, logs } = envFor();
    const cmds = createAuthCommands({
      createProvider: () => mockProvider(),
      createStore: () => tokenStore(storeFile),
      openBrowser: vi.fn(),
    });
    const code = await cmds.runLogout({ env, args: [], flags: {} });
    expect(code).toBe(0);
    expect(logs[0]).toMatch(/logged out/i);
    await expect(fs.access(storeFile)).rejects.toThrow();
  });
});

describe('whoami', () => {
  it('errors when no token is stored', async () => {
    const { env, errors } = envFor();
    const cmds = createAuthCommands({
      createProvider: () => mockProvider(),
      createStore: () => tokenStore(path.join(workDir, 'auth.json')),
      openBrowser: vi.fn(),
    });
    const code = await cmds.runWhoami({ env, args: [], flags: {} });
    expect(code).toBe(1);
    expect(errors[0]).toMatch(/not logged in/i);
  });

  it('verifies + prints the principal when STAGEFLIP_JWT_SECRET is set', async () => {
    const storeFile = path.join(workDir, 'auth.json');
    const jwt = await issueMcpSessionJwt({
      secret: SECRET,
      claims: { sub: 'alice', org: 'acme', role: 'admin', allowedBundles: [] },
      ttlSeconds: 60,
    });
    const store = tokenStore(storeFile);
    await store.save({
      jwt,
      refreshToken: 'rt',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      issuer: 'mock',
      profile: 'default',
    });
    const { env, logs } = envFor({ STAGEFLIP_JWT_SECRET: SECRET });
    const cmds = createAuthCommands({
      createProvider: () => mockProvider(),
      createStore: () => tokenStore(storeFile),
      openBrowser: vi.fn(),
    });
    const code = await cmds.runWhoami({ env, args: [], flags: {} });
    expect(code).toBe(0);
    expect(logs.join(' ')).toMatch(/alice/);
    expect(logs.join(' ')).toMatch(/acme/);
    expect(logs.join(' ')).toMatch(/admin/);
  });
});

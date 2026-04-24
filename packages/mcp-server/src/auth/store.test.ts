// packages/mcp-server/src/auth/store.test.ts
// T-223 — filesystem token store. Tests run against a tmp dir so the
// real `~/.config/stageflip/auth.json` never gets touched.

import { promises as fs } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createFileTokenStore } from './store.js';

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'stageflip-auth-'));
});
afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true });
});

const sampleToken = {
  jwt: 'eyJ...',
  refreshToken: 'refresh-abc',
  expiresAt: 1_800_000_000,
  issuer: 'stageflip',
  profile: 'default',
} as const;

describe('createFileTokenStore — basics', () => {
  it('reads back what it wrote', async () => {
    const store = createFileTokenStore({ path: path.join(workDir, 'auth.json') });
    await store.save(sampleToken);
    const loaded = await store.load();
    expect(loaded).toEqual(sampleToken);
  });

  it('returns null for a never-saved store', async () => {
    const store = createFileTokenStore({ path: path.join(workDir, 'missing.json') });
    expect(await store.load()).toBeNull();
  });

  it('clear() removes the file', async () => {
    const target = path.join(workDir, 'auth.json');
    const store = createFileTokenStore({ path: target });
    await store.save(sampleToken);
    await store.clear();
    expect(await store.load()).toBeNull();
    await expect(fs.access(target)).rejects.toThrow();
  });

  it('creates intermediate directories atomically', async () => {
    const nested = path.join(workDir, 'a', 'b', 'c', 'auth.json');
    const store = createFileTokenStore({ path: nested });
    await store.save(sampleToken);
    expect(await store.load()).toEqual(sampleToken);
  });
});

describe('createFileTokenStore — permissions', () => {
  it('writes the file with 0600 mode so other users cannot read tokens', async () => {
    const target = path.join(workDir, 'auth.json');
    const store = createFileTokenStore({ path: target });
    await store.save(sampleToken);
    const stat = await fs.stat(target);
    // Check owner-only perms (mask against 0o777).
    expect(stat.mode & 0o777).toBe(0o600);
  });
});

describe('createFileTokenStore — schema', () => {
  it('rejects a load when the file is not valid JSON', async () => {
    const target = path.join(workDir, 'auth.json');
    await fs.mkdir(workDir, { recursive: true });
    await fs.writeFile(target, 'not-json');
    const store = createFileTokenStore({ path: target });
    await expect(store.load()).rejects.toThrow(/json|parse/i);
  });

  it('rejects a load when required fields are missing', async () => {
    const target = path.join(workDir, 'auth.json');
    await fs.writeFile(target, JSON.stringify({ jwt: 'x' }));
    const store = createFileTokenStore({ path: target });
    await expect(store.load()).rejects.toThrow(/invalid|missing|schema/i);
  });
});

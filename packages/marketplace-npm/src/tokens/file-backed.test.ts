// packages/marketplace-npm/src/tokens/file-backed.test.ts

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FileBackedNpmTokenStore } from './file-backed.js';

describe('FileBackedNpmTokenStore', () => {
  let dir: string;
  let path: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'stageflip-npm-tokens-'));
    path = join(dir, 'npm-tokens.json');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('store + lookup roundtrip persists to disk', async () => {
    const s = new FileBackedNpmTokenStore({ path });
    await s.store('@stageflip', 'tok-abc');
    expect(await s.lookup('@stageflip')).toBe('tok-abc');

    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as { scopes: Record<string, string> };
    expect(parsed.scopes['@stageflip']).toBe('tok-abc');
  });

  it('a second store instance reads the persisted file', async () => {
    const s1 = new FileBackedNpmTokenStore({ path });
    await s1.store('@stageflip', 'tok-abc');
    await s1.store('@other', 'tok-xyz');

    const s2 = new FileBackedNpmTokenStore({ path });
    expect(await s2.lookup('@stageflip')).toBe('tok-abc');
    expect(await s2.lookup('@other')).toBe('tok-xyz');
    expect(await s2.listScopes()).toEqual(['@stageflip', '@other']);
  });

  it('handles a missing file as empty (first run)', async () => {
    const s = new FileBackedNpmTokenStore({ path });
    expect(await s.lookup('@stageflip')).toBeNull();
    expect(await s.listScopes()).toEqual([]);
  });

  it('treats corrupt JSON as empty (recovery, not crash)', async () => {
    await writeFile(path, '{not valid json', 'utf8');
    const s = new FileBackedNpmTokenStore({ path });
    expect(await s.lookup('@stageflip')).toBeNull();
    expect(await s.listScopes()).toEqual([]);
  });

  it('treats schema-mismatched JSON as empty', async () => {
    await writeFile(path, JSON.stringify({ unrelated: 'shape' }), 'utf8');
    const s = new FileBackedNpmTokenStore({ path });
    expect(await s.lookup('@stageflip')).toBeNull();
  });

  it('skips malformed entries when loading', async () => {
    await writeFile(
      path,
      JSON.stringify({
        scopes: {
          '@valid': 'tok-ok',
          missingAt: 'tok-bad',
          '@empty': '',
        },
      }),
      'utf8',
    );
    const s = new FileBackedNpmTokenStore({ path });
    expect(await s.lookup('@valid')).toBe('tok-ok');
    expect(await s.listScopes()).toEqual(['@valid']);
  });

  it('revoke removes the entry on disk', async () => {
    const s = new FileBackedNpmTokenStore({ path });
    await s.store('@stageflip', 'tok-abc');
    await s.revoke('@stageflip');
    expect(await s.lookup('@stageflip')).toBeNull();

    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as { scopes: Record<string, string> };
    expect(parsed.scopes['@stageflip']).toBeUndefined();
  });

  it('atomic write: target file is never partially written', async () => {
    // Sanity-check the rename protocol: after store() returns, the
    // file at `path` must be a complete, parseable JSON document
    // (not a truncated tempfile).
    const s = new FileBackedNpmTokenStore({ path });
    await s.store('@stageflip', 'tok-a');
    await s.store('@stageflip', 'tok-b');
    await s.store('@stageflip', 'tok-c');
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as { scopes: Record<string, string> };
    expect(parsed.scopes['@stageflip']).toBe('tok-c');
  });

  it('creates parent directories on first write', async () => {
    const nested = join(dir, 'a', 'b', 'tokens.json');
    const s = new FileBackedNpmTokenStore({ path: nested });
    await s.store('@stageflip', 'tok');
    expect(await s.lookup('@stageflip')).toBe('tok');
  });

  it('rejects empty path at construction time', () => {
    expect(() => new FileBackedNpmTokenStore({ path: '' })).toThrow(/non-empty string/);
  });
});

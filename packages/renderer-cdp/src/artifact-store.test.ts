// packages/renderer-cdp/src/artifact-store.test.ts

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { InMemoryArtifactStore, LocalFsArtifactStore, sanitizeArtifactKey } from './artifact-store';

// --- sanitizeArtifactKey ---------------------------------------------------

describe('sanitizeArtifactKey', () => {
  it('accepts valid single-segment keys', () => {
    expect(sanitizeArtifactKey('render.mp4')).toBe('render.mp4');
    expect(sanitizeArtifactKey('a-b_c.123')).toBe('a-b_c.123');
  });

  it('accepts nested single-level slash segments', () => {
    expect(sanitizeArtifactKey('2026-04-21/out.mp4')).toBe('2026-04-21/out.mp4');
    expect(sanitizeArtifactKey('runs/12/frame.png')).toBe('runs/12/frame.png');
  });

  it('rejects empty, leading/trailing slash, and double slashes', () => {
    expect(() => sanitizeArtifactKey('')).toThrow(/non-empty/);
    expect(() => sanitizeArtifactKey('/abs')).toThrow(/start or end/);
    expect(() => sanitizeArtifactKey('trail/')).toThrow(/start or end/);
    expect(() => sanitizeArtifactKey('foo//bar')).toThrow(/'\/\/'/);
  });

  it("rejects '.' and '..' segments (path traversal)", () => {
    expect(() => sanitizeArtifactKey('..')).toThrow(/'\.' or '\.\.'/);
    expect(() => sanitizeArtifactKey('../escape')).toThrow(/'\.' or '\.\.'/);
    expect(() => sanitizeArtifactKey('inside/../out')).toThrow(/'\.' or '\.\.'/);
    expect(() => sanitizeArtifactKey('./foo')).toThrow(/'\.' or '\.\.'/);
  });

  it('rejects characters outside [A-Za-z0-9._-]', () => {
    expect(() => sanitizeArtifactKey('has space.mp4')).toThrow(/outside/);
    expect(() => sanitizeArtifactKey('has$dollar')).toThrow(/outside/);
    expect(() => sanitizeArtifactKey('unicode-é')).toThrow(/outside/);
  });

  it('rejects non-strings with a TypeError', () => {
    // @ts-expect-error — intentional bad input
    expect(() => sanitizeArtifactKey(42)).toThrow(TypeError);
  });
});

// --- InMemoryArtifactStore -------------------------------------------------

describe('InMemoryArtifactStore', () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'stageflip-artifact-store-mem-'));
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('round-trips put + has + get + delete on a single key', async () => {
    const src = join(tempRoot, 'src.bin');
    await writeFile(src, new Uint8Array([1, 2, 3, 4]));
    const store = new InMemoryArtifactStore();

    const stored = await store.put('render.mp4', src);
    expect(stored.key).toBe('render.mp4');
    expect(stored.sizeBytes).toBe(4);
    expect(stored.localPath).toBe('memory:render.mp4');

    expect(await store.has('render.mp4')).toBe(true);
    const got = await store.get('render.mp4');
    expect(got?.sizeBytes).toBe(4);

    await store.delete('render.mp4');
    expect(await store.has('render.mp4')).toBe(false);
    expect(await store.get('render.mp4')).toBeNull();
  });

  it('list returns stored keys sorted', async () => {
    const src = join(tempRoot, 's.bin');
    await writeFile(src, new Uint8Array([0]));
    const store = new InMemoryArtifactStore();
    await store.put('b.mp4', src);
    await store.put('a.mp4', src);
    expect(await store.list()).toEqual(['a.mp4', 'b.mp4']);
  });

  it('bytesFor exposes the stored content for assertions', async () => {
    const src = join(tempRoot, 's.bin');
    await writeFile(src, new Uint8Array([9, 8, 7]));
    const store = new InMemoryArtifactStore();
    await store.put('k', src);
    const bytes = store.bytesFor('k');
    expect(bytes).toBeInstanceOf(Uint8Array);
    if (bytes === undefined) throw new Error('bytesFor returned undefined');
    expect(Array.from(bytes)).toEqual([9, 8, 7]);
  });

  it('records every call for inspection', async () => {
    const src = join(tempRoot, 's.bin');
    await writeFile(src, new Uint8Array([0]));
    const store = new InMemoryArtifactStore();
    await store.put('k', src);
    await store.has('k');
    await store.get('k');
    await store.delete('k');
    expect(store.calls.map((c) => c.op)).toEqual(['put', 'has', 'get', 'delete']);
  });

  it('surfaces sanitize errors on all key-accepting methods', async () => {
    const store = new InMemoryArtifactStore();
    await expect(store.put('/bad', '/irrelevant')).rejects.toThrow(/start or end/);
    await expect(store.has('..')).rejects.toThrow(/'\.' or '\.\.'/);
    await expect(store.get('')).rejects.toThrow(/non-empty/);
    await expect(store.delete('has space')).rejects.toThrow(/outside/);
  });
});

// --- LocalFsArtifactStore --------------------------------------------------

describe('LocalFsArtifactStore', () => {
  let tempRoot: string;
  let storeRoot: string;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'stageflip-artifact-store-fs-'));
    storeRoot = join(tempRoot, 'store');
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('put copies the source file into rootDir and get returns it', async () => {
    const src = join(tempRoot, 'src.bin');
    await writeFile(src, new Uint8Array([0xaa, 0xbb, 0xcc]));
    const store = new LocalFsArtifactStore({ rootDir: storeRoot });

    const stored = await store.put('render.mp4', src);
    expect(stored.key).toBe('render.mp4');
    expect(stored.sizeBytes).toBe(3);
    expect(stored.localPath).toBe(join(storeRoot, 'render.mp4'));

    expect(await store.has('render.mp4')).toBe(true);
    const got = await store.get('render.mp4');
    expect(got?.localPath).toBe(stored.localPath);
  });

  it('creates nested directories on put for multi-segment keys', async () => {
    const src = join(tempRoot, 'src.bin');
    await writeFile(src, new Uint8Array([0]));
    const store = new LocalFsArtifactStore({ rootDir: storeRoot });

    const stored = await store.put('runs/42/out.mp4', src);
    expect(stored.localPath).toBe(join(storeRoot, 'runs', '42', 'out.mp4'));
    expect(await store.has('runs/42/out.mp4')).toBe(true);
  });

  it('list walks the tree and returns relative keys, sorted', async () => {
    const src = join(tempRoot, 'src.bin');
    await writeFile(src, new Uint8Array([0]));
    const store = new LocalFsArtifactStore({ rootDir: storeRoot });

    await store.put('b.mp4', src);
    await store.put('runs/12/a.mp4', src);
    await store.put('a.mp4', src);

    const listed = await store.list();
    expect(listed).toEqual(['a.mp4', 'b.mp4', 'runs/12/a.mp4']);
  });

  it('list returns an empty array when rootDir does not exist', async () => {
    const store = new LocalFsArtifactStore({ rootDir: join(tempRoot, 'never-created') });
    expect(await store.list()).toEqual([]);
  });

  it('delete removes the file and is a no-op on unknown keys', async () => {
    const src = join(tempRoot, 'src.bin');
    await writeFile(src, new Uint8Array([0]));
    const store = new LocalFsArtifactStore({ rootDir: storeRoot });
    await store.put('render.mp4', src);

    await store.delete('render.mp4');
    expect(await store.has('render.mp4')).toBe(false);

    // No throw on missing key.
    await expect(store.delete('never-existed')).resolves.toBeUndefined();
  });

  it('get returns null for missing keys', async () => {
    const store = new LocalFsArtifactStore({ rootDir: storeRoot });
    expect(await store.get('missing.mp4')).toBeNull();
    expect(await store.has('missing.mp4')).toBe(false);
  });

  it('rejects malformed keys on every method', async () => {
    const store = new LocalFsArtifactStore({ rootDir: storeRoot });
    await expect(store.put('../escape', '/dev/null')).rejects.toThrow(/'\.' or '\.\.'/);
    await expect(store.has('/abs')).rejects.toThrow(/start or end/);
    await expect(store.get('has space')).rejects.toThrow(/outside/);
    await expect(store.delete('')).rejects.toThrow(/non-empty/);
  });

  it('rejects empty or non-string rootDir at construction', () => {
    expect(() => new LocalFsArtifactStore({ rootDir: '' })).toThrow(/rootDir/);
    // @ts-expect-error — intentional bad input
    expect(() => new LocalFsArtifactStore({})).toThrow(/rootDir/);
  });

  it('has() is file-only — a directory created by a nested put does not count as present', async () => {
    // Reviewer-flagged consistency bug: prior to the fix, `has` used
    // `access` and returned true for directories, while `get` used
    // `stat+isFile` and returned null. Now both use stat+isFile.
    const src = join(tempRoot, 's.bin');
    await writeFile(src, new Uint8Array([0]));
    const store = new LocalFsArtifactStore({ rootDir: storeRoot });
    await store.put('runs/42/out.mp4', src);

    // The directories runs/ and runs/42/ exist on disk but are not
    // artifact keys themselves.
    expect(await store.has('runs')).toBe(false);
    expect(await store.has('runs/42')).toBe(false);
    expect(await store.has('runs/42/out.mp4')).toBe(true);
  });

  it('put returns the sanitised key (round-trips through get)', async () => {
    const src = join(tempRoot, 's.bin');
    await writeFile(src, new Uint8Array([0]));
    const store = new LocalFsArtifactStore({ rootDir: storeRoot });

    const putResult = await store.put('round.trip.mp4', src);
    const getResult = await store.get(putResult.key);
    expect(getResult).not.toBeNull();
    expect(getResult?.key).toBe(putResult.key);
  });
});

// packages/renderer-cdp/src/bake.test.ts

import { describe, expect, it } from 'vitest';

import {
  type BakeArtifact,
  type BakeJob,
  type BakeRuntime,
  InMemoryBakeCache,
  InMemoryBakeOrchestrator,
} from './bake';

// --- helpers ---------------------------------------------------------------

function job(id: string, overrides: Partial<BakeJob> = {}): BakeJob {
  return {
    id,
    runtimeId: 'blender',
    clipKind: 'blender-scene',
    params: {},
    width: 1920,
    height: 1080,
    fps: 30,
    durationFrames: 90,
    ...overrides,
  };
}

/**
 * Fake bake runtime: claims a list of clip kinds and returns a synthetic
 * artifact per job. Records every bake call for assertions.
 */
class FakeBakeRuntime implements BakeRuntime {
  public readonly bakes: BakeJob[] = [];
  constructor(
    public readonly id: string,
    private readonly kinds: readonly string[],
    private readonly failKind?: string,
  ) {}

  canBake(clipKind: string): boolean {
    return this.kinds.includes(clipKind);
  }

  async bake(j: BakeJob): Promise<BakeArtifact> {
    this.bakes.push(j);
    if (this.failKind !== undefined && j.clipKind === this.failKind) {
      throw new Error(`fake bake failure for ${j.clipKind}`);
    }
    return {
      jobId: j.id,
      kind: 'frames',
      localPath: `/tmp/bake/${j.id}`,
      sizeBytes: 42,
      metadata: { runtime: this.id },
    };
  }
}

// --- InMemoryBakeCache -----------------------------------------------------

describe('InMemoryBakeCache', () => {
  it('round-trips put + has + get + delete', async () => {
    const cache = new InMemoryBakeCache();
    const artifact: BakeArtifact = {
      jobId: 'j1',
      kind: 'video',
      localPath: '/tmp/j1.mp4',
      sizeBytes: 1024,
    };
    expect(await cache.has('j1')).toBe(false);
    await cache.put(artifact);
    expect(await cache.has('j1')).toBe(true);
    expect(await cache.get('j1')).toEqual(artifact);
    await cache.delete('j1');
    expect(await cache.has('j1')).toBe(false);
    expect(await cache.get('j1')).toBeNull();
  });

  it('delete is a no-op on missing keys', async () => {
    const cache = new InMemoryBakeCache();
    await expect(cache.delete('never-there')).resolves.toBeUndefined();
  });

  it('size reflects current entries', async () => {
    const cache = new InMemoryBakeCache();
    expect(cache.size).toBe(0);
    await cache.put({ jobId: 'a', kind: 'frames', localPath: '/a' });
    await cache.put({ jobId: 'b', kind: 'frames', localPath: '/b' });
    expect(cache.size).toBe(2);
  });
});

// --- InMemoryBakeOrchestrator ---------------------------------------------

describe('InMemoryBakeOrchestrator.register', () => {
  it('accepts multiple runtimes and lists them in registration order', () => {
    const o = new InMemoryBakeOrchestrator();
    const a = new FakeBakeRuntime('a', ['kind-a']);
    const b = new FakeBakeRuntime('b', ['kind-b']);
    o.register(a);
    o.register(b);
    expect(o.listRuntimes().map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('rejects duplicate runtime ids', () => {
    const o = new InMemoryBakeOrchestrator();
    o.register(new FakeBakeRuntime('dup', ['x']));
    expect(() => o.register(new FakeBakeRuntime('dup', ['y']))).toThrow(/already registered/);
  });

  it('rejects an empty runtime id', () => {
    const o = new InMemoryBakeOrchestrator();
    expect(() => o.register(new FakeBakeRuntime('', ['x']))).toThrow(/non-empty/);
  });
});

describe('InMemoryBakeOrchestrator.bakeAll', () => {
  it('bakes each job through its matching runtime and returns baked[]', async () => {
    const o = new InMemoryBakeOrchestrator();
    const rt = new FakeBakeRuntime('blender', ['blender-scene', 'heavy-three']);
    o.register(rt);

    const result = await o.bakeAll([
      job('j1', { clipKind: 'blender-scene' }),
      job('j2', { clipKind: 'heavy-three' }),
    ]);

    expect(result.baked).toHaveLength(2);
    expect(result.cached).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
    expect(rt.bakes.map((b) => b.id)).toEqual(['j1', 'j2']);
  });

  it('serves cache hits from `cached[]` and skips the runtime', async () => {
    const cache = new InMemoryBakeCache();
    await cache.put({
      jobId: 'precached',
      kind: 'frames',
      localPath: '/tmp/precached',
    });

    const o = new InMemoryBakeOrchestrator({ cache });
    const rt = new FakeBakeRuntime('blender', ['blender-scene']);
    o.register(rt);

    const result = await o.bakeAll([job('precached'), job('fresh')]);

    expect(result.baked.map((a) => a.jobId)).toEqual(['fresh']);
    expect(result.cached.map((a) => a.jobId)).toEqual(['precached']);
    expect(rt.bakes.map((b) => b.id)).toEqual(['fresh']);
  });

  it('writes fresh bakes through to the cache', async () => {
    const cache = new InMemoryBakeCache();
    const o = new InMemoryBakeOrchestrator({ cache });
    o.register(new FakeBakeRuntime('blender', ['blender-scene']));
    await o.bakeAll([job('j1')]);
    expect(await cache.has('j1')).toBe(true);
  });

  it('records no-runtime failure when no registered runtime claims the clipKind', async () => {
    const o = new InMemoryBakeOrchestrator();
    o.register(new FakeBakeRuntime('blender', ['blender-scene']));

    const result = await o.bakeAll([job('j1', { clipKind: 'unknown-kind' })]);

    expect(result.baked).toHaveLength(0);
    expect(result.cached).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.reason).toBe('no-runtime');
    expect(result.failed[0]?.message).toMatch(/unknown-kind/);
  });

  it('records bake-error failure when a runtime throws, and continues with remaining jobs', async () => {
    const o = new InMemoryBakeOrchestrator();
    o.register(new FakeBakeRuntime('blender', ['ok', 'boom'], 'boom'));

    const result = await o.bakeAll([
      job('j-ok-1', { clipKind: 'ok' }),
      job('j-fail', { clipKind: 'boom' }),
      job('j-ok-2', { clipKind: 'ok' }),
    ]);

    expect(result.baked.map((a) => a.jobId)).toEqual(['j-ok-1', 'j-ok-2']);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.reason).toBe('bake-error');
    expect(result.failed[0]?.message).toMatch(/fake bake failure/);
  });

  it('first-registered wins when multiple runtimes claim the same kind', async () => {
    const o = new InMemoryBakeOrchestrator();
    const first = new FakeBakeRuntime('first', ['shared']);
    const second = new FakeBakeRuntime('second', ['shared']);
    o.register(first);
    o.register(second);

    await o.bakeAll([job('j', { clipKind: 'shared' })]);

    expect(first.bakes).toHaveLength(1);
    expect(second.bakes).toHaveLength(0);
  });

  it('handles an empty job list with no state change', async () => {
    const o = new InMemoryBakeOrchestrator();
    const result = await o.bakeAll([]);
    expect(result.baked).toHaveLength(0);
    expect(result.cached).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });
});

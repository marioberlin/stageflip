// packages/runtimes/blender/src/submit.test.ts
// T-265 AC #8–#13 — submit handler.

import type { BlenderClipElement } from '@stageflip/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type BakeBucketReader, manifestKey } from './fetch.js';
import { computeInputsHash } from './inputs-hash.js';
import { type BakeJobPayload, BakeQueueProducer, type BullQueueLike } from './queue.js';
import {
  DEFAULT_TOKENS_PER_SUBMIT,
  type RateLimiterLike,
  SubmitError,
  type SubmitRegionRouter,
  submitBakeJobHandler,
} from './submit.js';

const SCENE = { template: 'fluid-sim', params: { viscosity: 0.5 } };
const DURATION = { durationMs: 2000, fps: 30 };
const HASH = computeInputsHash({ scene: SCENE, duration: DURATION });

function descriptor(overrides: Partial<BlenderClipElement> = {}): BlenderClipElement {
  return {
    id: 'el_blend1',
    transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
    animations: [],
    type: 'blender-clip',
    scene: SCENE,
    duration: DURATION,
    inputsHash: HASH,
    ...overrides,
  };
}

function makeReader(map: Record<string, string>): BakeBucketReader {
  return {
    bucketName: 'us-bucket',
    async getText(p) {
      return map[p] ?? null;
    },
    publicUrl(p) {
      return `https://us-bucket/${p}`;
    },
  };
}

interface Setup {
  limiter: RateLimiterLike;
  consumeSpy: ReturnType<typeof vi.fn>;
  router: SubmitRegionRouter;
  producer: BakeQueueProducer;
  queueAdd: ReturnType<typeof vi.fn>;
  bakeBucketMap: Record<string, string>;
}

function setup(opts: { allow?: boolean; manifestPresent?: boolean } = {}): Setup {
  const consumeSpy = vi.fn(async () =>
    opts.allow === false
      ? { allowed: false as const, tier: 'org', retryAfterMs: 1000 }
      : { allowed: true as const },
  );
  const limiter: RateLimiterLike = { consume: consumeSpy };
  const bakeBucketMap: Record<string, string> = {};
  if (opts.manifestPresent) {
    bakeBucketMap[manifestKey(HASH)] = JSON.stringify({
      inputsHash: HASH,
      frameCount: 1,
      fps: 30,
      durationMs: 2000,
      outputBucket: 'us-bucket',
      region: 'us',
      completedAt: '2026-04-27T00:00:00.000Z',
    });
  }
  const reader = makeReader(bakeBucketMap);
  const router: SubmitRegionRouter = {
    reader: () => reader,
    outputBucket: (r) => (r === 'eu' ? 'eu-bucket' : 'us-bucket'),
  };
  const queueAdd = vi.fn(async (_name: string, _data: BakeJobPayload) => ({ id: 'job_xyz' }));
  const queue: BullQueueLike = { add: queueAdd };
  const producer = new BakeQueueProducer({ queue });
  return { limiter, consumeSpy, router, producer, queueAdd, bakeBucketMap };
}

const CALLER = { uid: 'u1', orgId: 'o1', region: 'us' as const };

describe('submitBakeJobHandler — auth (T-265 AC #8)', () => {
  it('rejects an unauthenticated caller', async () => {
    const s = setup();
    await expect(
      submitBakeJobHandler(
        { ...s, clock: () => 0, newBakeId: () => 'b1' },
        { uid: '', orgId: 'o1', region: 'us' },
        { clipDescriptor: descriptor() },
      ),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });
  it('rejects a caller without an active org', async () => {
    const s = setup();
    await expect(
      submitBakeJobHandler(
        { ...s, clock: () => 0, newBakeId: () => 'b1' },
        { uid: 'u1', orgId: undefined, region: 'us' },
        { clipDescriptor: descriptor() },
      ),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('submitBakeJobHandler — rate limit (T-265 AC #9)', () => {
  it('consumes 10 tokens by default per submission', async () => {
    const s = setup();
    await submitBakeJobHandler({ ...s, clock: () => 0, newBakeId: () => 'b1' }, CALLER, {
      clipDescriptor: descriptor(),
    });
    expect(s.consumeSpy).toHaveBeenCalledTimes(DEFAULT_TOKENS_PER_SUBMIT);
    expect(s.consumeSpy).toHaveBeenCalledWith({ user: 'u1', org: 'o1' });
  });
  it('rejects with rate-limited error when limiter denies', async () => {
    const s = setup({ allow: false });
    await expect(
      submitBakeJobHandler({ ...s, clock: () => 0, newBakeId: () => 'b1' }, CALLER, {
        clipDescriptor: descriptor(),
      }),
    ).rejects.toMatchObject({ code: 'rate-limited' });
  });
  it('respects an injected tokensPerSubmit override', async () => {
    const s = setup();
    await submitBakeJobHandler(
      { ...s, clock: () => 0, newBakeId: () => 'b1', tokensPerSubmit: 3 },
      CALLER,
      { clipDescriptor: descriptor() },
    );
    expect(s.consumeSpy).toHaveBeenCalledTimes(3);
  });
});

describe('submitBakeJobHandler — hash verification (T-265 AC #10)', () => {
  it('rejects a forged inputsHash with code "inputs-hash-mismatch"', async () => {
    const s = setup();
    await expect(
      submitBakeJobHandler({ ...s, clock: () => 0, newBakeId: () => 'b1' }, CALLER, {
        clipDescriptor: descriptor({ inputsHash: 'b'.repeat(64) }),
      }),
    ).rejects.toBeInstanceOf(SubmitError);
    try {
      await submitBakeJobHandler({ ...s, clock: () => 0, newBakeId: () => 'b1' }, CALLER, {
        clipDescriptor: descriptor({ inputsHash: 'b'.repeat(64) }),
      });
    } catch (err) {
      expect((err as SubmitError).code).toBe('inputs-hash-mismatch');
    }
  });
});

describe('submitBakeJobHandler — cache hit (T-265 AC #11)', () => {
  it('returns "ready" without enqueueing when manifest exists', async () => {
    const s = setup({ manifestPresent: true });
    const out = await submitBakeJobHandler(
      { ...s, clock: () => 0, newBakeId: () => 'b1' },
      CALLER,
      { clipDescriptor: descriptor() },
    );
    expect(out.status).toBe('ready');
    expect(out.inputsHash).toBe(HASH);
    expect(s.queueAdd).not.toHaveBeenCalled();
  });
  it('populates frame URLs from the manifest on cache hit (one-shot contract)', async () => {
    // setup() seeds a manifest with frameCount: 1 → caller should receive
    // the URL for frame-0.png in the same response, no second round-trip.
    const s = setup({ manifestPresent: true });
    const out = await submitBakeJobHandler(
      { ...s, clock: () => 0, newBakeId: () => 'b1' },
      CALLER,
      { clipDescriptor: descriptor() },
    );
    if (out.status !== 'ready') throw new Error('expected status=ready');
    expect(out.frames).toEqual([`https://us-bucket/bakes/${HASH}/frame-0.png`]);
  });
});

describe('submitBakeJobHandler — cache miss (T-265 AC #12)', () => {
  it('enqueues a job + returns "pending"', async () => {
    const s = setup();
    let counter = 0;
    const out = await submitBakeJobHandler(
      { ...s, clock: () => 0, newBakeId: () => `b${++counter}` },
      CALLER,
      { clipDescriptor: descriptor() },
    );
    expect(out.status).toBe('pending');
    expect(s.queueAdd).toHaveBeenCalledTimes(1);
    const [name, payload] = s.queueAdd.mock.calls[0] as [string, BakeJobPayload];
    expect(name).toBe('bake');
    expect(payload.inputsHash).toBe(HASH);
    expect(payload.outputBucket).toBe('us-bucket');
    expect(payload.region).toBe('us');
    expect(payload.scene.template).toBe('fluid-sim');
    expect(payload.bakeId).toBe('b1');
  });
});

describe('submitBakeJobHandler — region routing (T-265 AC #13)', () => {
  it('writes to EU bucket when caller.region === "eu"', async () => {
    const s = setup();
    await submitBakeJobHandler(
      { ...s, clock: () => 0, newBakeId: () => 'b1' },
      { ...CALLER, region: 'eu' },
      { clipDescriptor: descriptor() },
    );
    const [, payload] = s.queueAdd.mock.calls[0] as [string, BakeJobPayload];
    expect(payload.outputBucket).toBe('eu-bucket');
    expect(payload.region).toBe('eu');
  });
});

describe('submitBakeJobHandler — order of operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('checks rate limit before computing/checking the hash', async () => {
    // The handler enforces auth → rate-limit → hash → cache → enqueue. Pin
    // the order so future refactors do not accidentally let a forged-hash
    // request slip past the limiter.
    const s = setup({ allow: false });
    await expect(
      submitBakeJobHandler({ ...s, clock: () => 0, newBakeId: () => 'b1' }, CALLER, {
        clipDescriptor: descriptor({ inputsHash: 'b'.repeat(64) }),
      }),
    ).rejects.toMatchObject({ code: 'rate-limited' });
  });
});

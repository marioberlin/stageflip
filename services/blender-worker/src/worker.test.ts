// services/blender-worker/src/worker.test.ts
// T-265 AC #19–#24 — bake worker orchestration tests.

import type { BakeJobPayload } from '@stageflip/runtimes-blender';
import { describe, expect, it, vi } from 'vitest';

import {
  type BakeOutputBucket,
  type BlenderInvoker,
  type BucketRouter,
  type ProcessBakeJobDeps,
  WORKER_QUEUE_NAME,
  type WorkerObservability,
  buildManifest,
  expectedFrameCount,
  processBakeJob,
} from './worker.js';

const PAYLOAD: BakeJobPayload = {
  bakeId: 'b1',
  inputsHash: 'a'.repeat(64),
  scene: { template: 'fluid-sim', params: {} },
  duration: { durationMs: 1000, fps: 30 }, // expect 30 frames
  outputBucket: 'us-bucket',
  region: 'us',
};

function makeBucket(initial: Record<string, string> = {}): {
  bucket: BakeOutputBucket;
  store: Record<string, Uint8Array | string>;
  putBytes: ReturnType<typeof vi.fn>;
  putText: ReturnType<typeof vi.fn>;
} {
  const store: Record<string, Uint8Array | string> = { ...initial };
  const putBytes = vi.fn(async (path: string, bytes: Uint8Array) => {
    store[path] = bytes;
  });
  const putText = vi.fn(async (path: string, text: string) => {
    store[path] = text;
  });
  const bucket: BakeOutputBucket = {
    async getText(path) {
      const v = store[path];
      if (v === undefined) return null;
      return typeof v === 'string' ? v : null;
    },
    putBytes,
    putText,
  };
  return { bucket, store, putBytes, putText };
}

function makeDeps(opts: {
  bucket: BakeOutputBucket;
  invoker?: BlenderInvoker;
  cpuFallback?: boolean;
  frameCount?: number;
}): ProcessBakeJobDeps & { observabilityCalls: { info: unknown[][]; warn: unknown[][] } } {
  const obsInfo: unknown[][] = [];
  const obsWarn: unknown[][] = [];
  const observability: WorkerObservability = {
    info: (msg, ctx) => {
      obsInfo.push([msg, ctx]);
    },
    warn: (msg, ctx) => {
      obsWarn.push([msg, ctx]);
    },
    captureError: () => {
      /* noop */
    },
  };
  const router: BucketRouter = { bucketFor: () => opts.bucket };
  const frameCount = opts.frameCount ?? 30;
  const invoker: BlenderInvoker = opts.invoker ?? {
    render: async () => ({
      frames: Array.from({ length: frameCount }, (_, i) => new Uint8Array([i & 0xff])),
      cpuFallback: opts.cpuFallback ?? false,
    }),
  };
  return {
    invoker,
    router,
    observability,
    clock: () => Date.parse('2026-04-27T12:00:00.000Z'),
    observabilityCalls: { info: obsInfo, warn: obsWarn },
  };
}

describe('WORKER_QUEUE_NAME (T-265 AC #19)', () => {
  it('is "stageflip:bakes"', () => {
    expect(WORKER_QUEUE_NAME).toBe('stageflip:bakes');
  });
});

describe('expectedFrameCount', () => {
  it('rounds up partial frames', () => {
    expect(expectedFrameCount(1000, 30)).toBe(30);
    expect(expectedFrameCount(1001, 30)).toBe(31);
    expect(expectedFrameCount(2000, 30)).toBe(60);
  });
});

describe('buildManifest (T-265 AC #23)', () => {
  it('includes the documented fields', () => {
    const m = buildManifest({
      payload: PAYLOAD,
      frameCount: 30,
      completedAt: '2026-04-27T12:00:00.000Z',
    });
    expect(m).toEqual({
      inputsHash: PAYLOAD.inputsHash,
      frameCount: 30,
      fps: 30,
      durationMs: 1000,
      outputBucket: 'us-bucket',
      region: 'us',
      completedAt: '2026-04-27T12:00:00.000Z',
    });
  });
});

describe('processBakeJob — idempotency (T-265 AC #20)', () => {
  it('short-circuits when manifest.json already exists', async () => {
    const { bucket, putBytes, putText } = makeBucket({
      [`bakes/${PAYLOAD.inputsHash}/manifest.json`]: '{"frameCount":30}',
    });
    const deps = makeDeps({ bucket });
    const renderSpy = vi.spyOn(deps.invoker, 'render');
    const out = await processBakeJob(deps, PAYLOAD);
    expect(out.status).toBe('cached');
    expect(renderSpy).not.toHaveBeenCalled();
    expect(putBytes).not.toHaveBeenCalled();
    expect(putText).not.toHaveBeenCalled();
  });
});

describe('processBakeJob — render path (T-265 AC #21, #22, #23)', () => {
  it('invokes Blender, writes 30 frames, then writes manifest', async () => {
    const { bucket, putBytes, putText, store } = makeBucket();
    const deps = makeDeps({ bucket });
    const out = await processBakeJob(deps, PAYLOAD);
    expect(out.status).toBe('rendered');
    expect(putBytes).toHaveBeenCalledTimes(30);
    expect(putText).toHaveBeenCalledTimes(1);
    // Manifest written last (idempotency monotonicity).
    const manifestPath = `bakes/${PAYLOAD.inputsHash}/manifest.json`;
    const manifest = JSON.parse(store[manifestPath] as string);
    expect(manifest.frameCount).toBe(30);
    expect(manifest.fps).toBe(30);
    expect(manifest.region).toBe('us');
  });

  it('writes frames to architecture-locked paths', async () => {
    const { bucket, putBytes } = makeBucket();
    const deps = makeDeps({ bucket });
    await processBakeJob(deps, PAYLOAD);
    const calls = putBytes.mock.calls as Array<[string, Uint8Array]>;
    expect(calls[0]?.[0]).toBe(`bakes/${PAYLOAD.inputsHash}/frame-0.png`);
    expect(calls[29]?.[0]).toBe(`bakes/${PAYLOAD.inputsHash}/frame-29.png`);
  });

  it('throws when frame count mismatches expected', async () => {
    const { bucket } = makeBucket();
    const deps = makeDeps({ bucket, frameCount: 5 }); // returns 5 frames; expects 30
    await expect(processBakeJob(deps, PAYLOAD)).rejects.toThrow(/frame count mismatch/);
  });
});

describe('processBakeJob — GPU/CPU dual-path (T-265 AC #24)', () => {
  it('emits a CPU-fallback warning when invoker reports cpuFallback', async () => {
    const { bucket } = makeBucket();
    const deps = makeDeps({ bucket, cpuFallback: true });
    await processBakeJob(deps, PAYLOAD);
    expect(deps.observabilityCalls.warn[0]?.[0]).toBe('bake.cpu_fallback');
  });
  it('does NOT warn when GPU is used (cpuFallback false)', async () => {
    const { bucket } = makeBucket();
    const deps = makeDeps({ bucket, cpuFallback: false });
    await processBakeJob(deps, PAYLOAD);
    expect(deps.observabilityCalls.warn).toHaveLength(0);
  });
});

describe('processBakeJob — region routing', () => {
  it('asks the router for the EU bucket when payload.region === "eu"', async () => {
    const { bucket } = makeBucket();
    const router: BucketRouter = {
      bucketFor: vi.fn(() => bucket),
    };
    const deps = makeDeps({ bucket });
    const depsWithRouter = { ...deps, router };
    await processBakeJob(depsWithRouter, { ...PAYLOAD, region: 'eu', outputBucket: 'eu-bucket' });
    expect(router.bucketFor).toHaveBeenCalledWith('eu', 'eu-bucket');
  });
});

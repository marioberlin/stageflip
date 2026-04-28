// packages/runtimes/blender/src/queue.test.ts
// T-265 AC #17, #18 — BullMQ producer.

import { describe, expect, it, vi } from 'vitest';

import {
  BAKE_QUEUE_NAME,
  BakeQueueProducer,
  type BullQueueLike,
  DEFAULT_BAKE_JOB_OPTIONS,
} from './queue.js';

const PAYLOAD = {
  bakeId: 'b1',
  inputsHash: 'a'.repeat(64),
  scene: { template: 'fluid-sim', params: {} },
  duration: { durationMs: 1000, fps: 30 },
  outputBucket: 'stageflip-assets',
  region: 'us' as const,
};

describe('BAKE_QUEUE_NAME (T-265 AC #17 — architecture-locked)', () => {
  it('is "stageflip:bakes" per docs/architecture.md:341', () => {
    expect(BAKE_QUEUE_NAME).toBe('stageflip:bakes');
  });
});

describe('DEFAULT_BAKE_JOB_OPTIONS (T-265 AC #18)', () => {
  it('uses 3 attempts with exponential backoff', () => {
    expect(DEFAULT_BAKE_JOB_OPTIONS.attempts).toBe(3);
    expect(DEFAULT_BAKE_JOB_OPTIONS.backoff.type).toBe('exponential');
  });
  it('removes completed jobs after 1 day', () => {
    expect(DEFAULT_BAKE_JOB_OPTIONS.removeOnComplete.age).toBe(86400);
  });
});

describe('BakeQueueProducer.enqueue', () => {
  it('calls queue.add with name "bake" + payload + options', async () => {
    const add = vi.fn(async () => ({ id: 'job_42' }));
    const queue: BullQueueLike = { add };
    const producer = new BakeQueueProducer({ queue });
    const id = await producer.enqueue(PAYLOAD);
    expect(id).toBe('job_42');
    expect(add).toHaveBeenCalledWith('bake', PAYLOAD, expect.objectContaining({ attempts: 3 }));
  });

  it('throws when the queue returns no job id', async () => {
    const add = vi.fn(async () => ({}));
    const queue: BullQueueLike = { add };
    const producer = new BakeQueueProducer({ queue });
    await expect(producer.enqueue(PAYLOAD)).rejects.toThrow(/job without an id/);
  });

  it('forwards a custom jobOptions override', async () => {
    const add = vi.fn(async () => ({ id: 'job_42' }));
    const queue: BullQueueLike = { add };
    const producer = new BakeQueueProducer({ queue, jobOptions: { attempts: 5, custom: true } });
    await producer.enqueue(PAYLOAD);
    expect(add).toHaveBeenCalledWith('bake', PAYLOAD, { attempts: 5, custom: true });
  });
});

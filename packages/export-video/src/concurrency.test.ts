// packages/export-video/src/concurrency.test.ts

import { describe, expect, it } from 'vitest';

import { mapWithConcurrency } from './concurrency.js';

describe('mapWithConcurrency', () => {
  it('returns [] for empty input', async () => {
    const out = await mapWithConcurrency([], 5, async (x) => x);
    expect(out).toEqual([]);
  });

  it('preserves input order in the output', async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 10);
    expect(out).toEqual([10, 20, 30, 40]);
  });

  it('runs in parallel up to the limit', async () => {
    let running = 0;
    let peak = 0;
    const tasks = Array.from({ length: 10 }, (_, i) => i);
    await mapWithConcurrency(tasks, 3, async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running -= 1;
      return 0;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });

  it('treats non-positive limit as unlimited', async () => {
    let running = 0;
    let peak = 0;
    const tasks = Array.from({ length: 6 }, (_, i) => i);
    await mapWithConcurrency(tasks, 0, async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running -= 1;
      return 0;
    });
    expect(peak).toBe(6);
  });

  it('treats Infinity as unlimited', async () => {
    let peak = 0;
    let running = 0;
    await mapWithConcurrency([1, 2, 3], Number.POSITIVE_INFINITY, async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 2));
      running -= 1;
      return 0;
    });
    expect(peak).toBe(3);
  });

  it('propagates the index to the task fn', async () => {
    const out = await mapWithConcurrency(['a', 'b', 'c'], 2, async (task, i) => `${i}:${task}`);
    expect(out).toEqual(['0:a', '1:b', '2:c']);
  });

  it('propagates a thrown error', async () => {
    await expect(
      mapWithConcurrency([1, 2], 2, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});

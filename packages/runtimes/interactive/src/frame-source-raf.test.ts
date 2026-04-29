// packages/runtimes/interactive/src/frame-source-raf.test.ts
// T-383 ACs #15, #17 — RAFFrameSource. Uses an injected fake rAF
// implementation to drive ticks deterministically; we don't rely on
// happy-dom's rAF cadence.

import { describe, expect, it, vi } from 'vitest';

import { RAFFrameSource } from './frame-source-raf.js';

interface FakeRaf {
  raf: (cb: FrameRequestCallback) => number;
  caf: (handle: number) => void;
  pump: (count: number) => void;
  pendingCount: () => number;
}

function makeFakeRaf(): FakeRaf {
  let next = 1;
  const queue = new Map<number, FrameRequestCallback>();
  return {
    raf: (cb) => {
      const handle = next++;
      queue.set(handle, cb);
      return handle;
    },
    caf: (handle) => {
      queue.delete(handle);
    },
    pump: (count) => {
      for (let i = 0; i < count; i += 1) {
        // Drain a single tick — the callback will re-queue itself.
        const entries = Array.from(queue.entries());
        if (entries.length === 0) return;
        const first = entries[0];
        if (!first) return;
        const [handle, cb] = first;
        queue.delete(handle);
        cb(0);
      }
    },
    pendingCount: () => queue.size,
  };
}

describe('RAFFrameSource (T-383 AC #15, #17)', () => {
  it('AC #15 — emits at least 30 frames over 30 pumps', () => {
    const fake = makeFakeRaf();
    const source = new RAFFrameSource({
      requestAnimationFrame: fake.raf,
      cancelAnimationFrame: fake.caf,
    });
    const seen: number[] = [];
    source.subscribe((f) => seen.push(f));
    fake.pump(30);
    expect(seen.length).toBeGreaterThanOrEqual(30);
    expect(seen[0]).toBe(1);
    expect(seen[29]).toBe(30);
  });

  it('current() starts at 0, advances after pumps', () => {
    const fake = makeFakeRaf();
    const source = new RAFFrameSource({
      requestAnimationFrame: fake.raf,
      cancelAnimationFrame: fake.caf,
    });
    expect(source.current()).toBe(0);
    source.subscribe(() => undefined);
    fake.pump(5);
    expect(source.current()).toBe(5);
  });

  it('initialFrame override', () => {
    const fake = makeFakeRaf();
    const source = new RAFFrameSource({
      requestAnimationFrame: fake.raf,
      cancelAnimationFrame: fake.caf,
      initialFrame: 100,
    });
    expect(source.current()).toBe(100);
  });

  it('AC #17 — unsubscribe stops handler receipts; loop stops when last subscriber leaves', () => {
    const fake = makeFakeRaf();
    const source = new RAFFrameSource({
      requestAnimationFrame: fake.raf,
      cancelAnimationFrame: fake.caf,
    });
    const handler = vi.fn();
    const unsub = source.subscribe(handler);
    fake.pump(1);
    expect(handler).toHaveBeenCalledTimes(1);
    unsub();
    unsub(); // idempotent
    fake.pump(5);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(fake.pendingCount()).toBe(0);
  });

  it('multiple subscribers all receive ticks', () => {
    const fake = makeFakeRaf();
    const source = new RAFFrameSource({
      requestAnimationFrame: fake.raf,
      cancelAnimationFrame: fake.caf,
    });
    const a = vi.fn();
    const b = vi.fn();
    source.subscribe(a);
    source.subscribe(b);
    fake.pump(2);
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('dispose() clears subscribers and stops the loop', () => {
    const fake = makeFakeRaf();
    const source = new RAFFrameSource({
      requestAnimationFrame: fake.raf,
      cancelAnimationFrame: fake.caf,
    });
    const handler = vi.fn();
    source.subscribe(handler);
    fake.pump(1);
    source.dispose();
    fake.pump(5);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(fake.pendingCount()).toBe(0);
  });

  it('falls back to globals when no factory injected (smoke test only)', () => {
    // happy-dom may or may not provide rAF; we just verify the constructor
    // doesn't throw without injected fakes.
    expect(() => new RAFFrameSource()).not.toThrow();
  });
});

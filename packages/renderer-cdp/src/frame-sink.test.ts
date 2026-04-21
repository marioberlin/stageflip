// packages/renderer-cdp/src/frame-sink.test.ts

import { describe, expect, it } from 'vitest';

import { InMemoryFrameSink } from './frame-sink';

describe('InMemoryFrameSink', () => {
  it('collects frames in the order onFrame was called', async () => {
    const sink = new InMemoryFrameSink();
    await sink.onFrame(0, new Uint8Array([1]));
    await sink.onFrame(1, new Uint8Array([2]));
    await sink.onFrame(2, new Uint8Array([3]));
    await sink.close();

    expect(sink.frames.map((f) => f.frame)).toEqual([0, 1, 2]);
    expect(sink.frames.map((f) => Array.from(f.buffer))).toEqual([[1], [2], [3]]);
  });

  it('rejects onFrame after close', async () => {
    const sink = new InMemoryFrameSink();
    await sink.close();
    await expect(sink.onFrame(0, new Uint8Array([1]))).rejects.toThrow(/after close/);
  });

  it('close is idempotent', async () => {
    const sink = new InMemoryFrameSink();
    await sink.close();
    await expect(sink.close()).resolves.toBeUndefined();
  });

  it('reports whether it has been closed', async () => {
    const sink = new InMemoryFrameSink();
    expect(sink.isClosed).toBe(false);
    await sink.close();
    expect(sink.isClosed).toBe(true);
  });
});

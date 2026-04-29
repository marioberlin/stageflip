// packages/runtimes/interactive/src/frame-source-record.test.ts
// T-383 ACs #16, #17 — RecordModeFrameSource.

import { describe, expect, it, vi } from 'vitest';

import { RecordModeFrameSource } from './frame-source-record.js';

describe('RecordModeFrameSource (T-383 AC #16, #17)', () => {
  it('AC #16 — advance(N) emits exactly N frames in order', () => {
    const source = new RecordModeFrameSource();
    const seen: number[] = [];
    source.subscribe((f) => seen.push(f));
    source.advance(5);
    expect(seen).toEqual([1, 2, 3, 4, 5]);
    expect(source.current()).toBe(5);
  });

  it('AC #16 — default advance() emits one frame', () => {
    const source = new RecordModeFrameSource();
    const handler = vi.fn();
    source.subscribe(handler);
    source.advance();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(1);
  });

  it('AC #16 — initialFrame respected', () => {
    const source = new RecordModeFrameSource(30);
    expect(source.current()).toBe(30);
    const seen: number[] = [];
    source.subscribe((f) => seen.push(f));
    source.advance(2);
    expect(seen).toEqual([31, 32]);
  });

  it('AC #16 — multiple subscribers see every frame', () => {
    const source = new RecordModeFrameSource();
    const a: number[] = [];
    const b: number[] = [];
    source.subscribe((f) => a.push(f));
    source.subscribe((f) => b.push(f));
    source.advance(3);
    expect(a).toEqual([1, 2, 3]);
    expect(b).toEqual([1, 2, 3]);
  });

  it('AC #17 — unsubscribe stops receipts and is idempotent', () => {
    const source = new RecordModeFrameSource();
    const handler = vi.fn();
    const unsub = source.subscribe(handler);
    source.advance(1);
    unsub();
    unsub(); // idempotent
    source.advance(2);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(source.subscriberCount()).toBe(0);
  });

  it('AC #17 — subscriberCount tracks handler count', () => {
    const source = new RecordModeFrameSource();
    expect(source.subscriberCount()).toBe(0);
    const u1 = source.subscribe(() => undefined);
    const u2 = source.subscribe(() => undefined);
    expect(source.subscriberCount()).toBe(2);
    u1();
    expect(source.subscriberCount()).toBe(1);
    u2();
    expect(source.subscriberCount()).toBe(0);
  });

  it('advance(0) is a no-op', () => {
    const source = new RecordModeFrameSource();
    const handler = vi.fn();
    source.subscribe(handler);
    source.advance(0);
    expect(handler).not.toHaveBeenCalled();
    expect(source.current()).toBe(0);
  });

  it('advance(-1) throws', () => {
    const source = new RecordModeFrameSource();
    expect(() => source.advance(-1)).toThrow();
  });

  it('advance(1.5) throws', () => {
    const source = new RecordModeFrameSource();
    expect(() => source.advance(1.5)).toThrow();
  });

  it('reset() jumps without emitting', () => {
    const source = new RecordModeFrameSource();
    const handler = vi.fn();
    source.subscribe(handler);
    source.reset(100);
    expect(source.current()).toBe(100);
    expect(handler).not.toHaveBeenCalled();
    source.advance(1);
    expect(handler).toHaveBeenCalledWith(101);
  });

  it('subscribe inside a callback observes the next tick', () => {
    const source = new RecordModeFrameSource();
    const lateHandler = vi.fn();
    source.subscribe((f) => {
      if (f === 1) {
        source.subscribe(lateHandler);
      }
    });
    source.advance(2);
    // Late handler subscribed during frame 1, observes frame 2 only.
    expect(lateHandler).toHaveBeenCalledTimes(1);
    expect(lateHandler).toHaveBeenCalledWith(2);
  });

  it('unsubscribe inside a callback works without crash', () => {
    const source = new RecordModeFrameSource();
    const unsubRef: { current: (() => void) | undefined } = { current: undefined };
    const handler = vi.fn(() => {
      unsubRef.current?.();
    });
    unsubRef.current = source.subscribe(handler);
    source.advance(3);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

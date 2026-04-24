// packages/agent/src/executor/patch-sink.test.ts

import { describe, expect, it } from 'vitest';
import { createPatchSink } from './patch-sink.js';
import type { JsonPatchOp } from './types.js';

const op = (path: string, value: string): JsonPatchOp => ({
  op: 'add',
  path,
  value,
});

describe('createPatchSink', () => {
  it('starts empty', () => {
    const sink = createPatchSink();
    expect(sink.size).toBe(0);
    expect(sink.drain()).toEqual([]);
  });

  it('push / pushAll / drain preserve FIFO order', () => {
    const sink = createPatchSink();
    sink.push(op('/a', '1'));
    sink.pushAll([op('/b', '2'), op('/c', '3')]);
    sink.push(op('/d', '4'));
    expect(sink.size).toBe(4);

    const drained = sink.drain();
    expect(drained.map((o) => o.path)).toEqual(['/a', '/b', '/c', '/d']);
    expect(sink.size).toBe(0);
  });

  it('drain is repeatable — second drain after new pushes returns only new ops', () => {
    const sink = createPatchSink();
    sink.push(op('/a', '1'));
    expect(sink.drain()).toHaveLength(1);

    sink.push(op('/b', '2'));
    expect(sink.drain()).toEqual([op('/b', '2')]);
  });

  it('pushAll accepts a readonly array without mutating it', () => {
    const sink = createPatchSink();
    const source: readonly JsonPatchOp[] = Object.freeze([op('/a', '1'), op('/b', '2')]);
    sink.pushAll(source);
    expect(sink.drain()).toHaveLength(2);
    expect(source).toHaveLength(2); // unchanged
  });
});

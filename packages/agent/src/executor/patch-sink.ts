// packages/agent/src/executor/patch-sink.ts
// FIFO patch accumulator. Handlers push JSON-Patch ops; the Executor
// drains + applies them after every tool call.

import type { JsonPatchOp, PatchSink } from './types.js';

export function createPatchSink(): PatchSink {
  const queue: JsonPatchOp[] = [];

  return {
    push(op) {
      queue.push(op);
    },
    pushAll(ops) {
      for (const op of ops) queue.push(op);
    },
    drain() {
      const out = queue.slice();
      queue.length = 0;
      return out;
    },
    get size() {
      return queue.length;
    },
  };
}

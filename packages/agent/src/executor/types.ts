// packages/agent/src/executor/types.ts
// Executor agent contracts per skills/stageflip/concepts/agent-executor.
// Events use `kind` (not `type`) to match the skill verbatim; state
// machines in the editor UI (ai-copilot sidebar) and parity traces key
// on the discriminated `kind` field.

import type { ToolContext } from '@stageflip/engine';
import type { Document } from '@stageflip/schema';
import type { Operation as JsonPatchOp } from 'fast-json-patch';

export type { JsonPatchOp };

/** Terminal status for a step. */
export type StepStatus = 'ok' | 'aborted' | 'max_iterations' | 'bundle_limit_exceeded';

export type ExecutorEvent =
  | { kind: 'step-start'; stepId: string }
  | { kind: 'tool-call'; stepId: string; name: string; args: unknown }
  | {
      kind: 'tool-result';
      stepId: string;
      name: string;
      result: unknown;
      isError: boolean;
    }
  | { kind: 'patch-applied'; stepId: string; patch: JsonPatchOp[] }
  | { kind: 'step-end'; stepId: string; status: StepStatus }
  | { kind: 'plan-end'; finalDocument: Document };

/**
 * Patch accumulator — tool handlers push JSON-Patch ops during `handle()`;
 * the Executor drains + applies them against the working document after
 * each tool call, then emits `patch-applied`.
 */
export interface PatchSink {
  push(op: JsonPatchOp): void;
  pushAll(ops: readonly JsonPatchOp[]): void;
  /** Returns pending ops and clears the internal queue. */
  drain(): JsonPatchOp[];
  /** Pending op count (inspection only; tests use this). */
  readonly size: number;
}

/**
 * Context passed to every tool handler in an Executor-driven run.
 * `document` is the working document snapshot at call time — handlers
 * must treat it as read-only and mutate via `patchSink`. The Executor
 * applies drained patches + re-reads `document` on the next call.
 */
export interface ExecutorContext extends ToolContext {
  readonly document: Document;
  readonly patchSink: PatchSink;
  readonly stepId: string;
}

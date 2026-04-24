// packages/agent/src/executor/types.ts
// Executor agent contracts per skills/stageflip/concepts/agent-executor.
// Events use `kind` (not `type`) to match the skill verbatim; state
// machines in the editor UI (ai-copilot sidebar) and parity traces key
// on the discriminated `kind` field.

import type { PatchSink as EnginePatchSink, JsonPatchOp, MutationContext } from '@stageflip/engine';
import type { Document } from '@stageflip/schema';

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
 * Patch accumulator — Executor-side extension of the engine's
 * {@link EnginePatchSink} contract, adding `drain` + `size` that the
 * Executor relies on between tool calls. Handler-side code uses only
 * the `push` / `pushAll` surface defined in engine.
 */
export interface PatchSink extends EnginePatchSink {
  /** Returns pending ops and clears the internal queue. */
  drain(): JsonPatchOp[];
  /** Pending op count (inspection only; tests use this). */
  readonly size: number;
}

/**
 * Context passed to every tool handler in an Executor-driven run.
 * Narrows engine's {@link MutationContext} with a required `stepId` and
 * an Executor-implemented {@link PatchSink}. Read-tier handlers that
 * accept `DocumentContext` and write-tier handlers that accept
 * `MutationContext` both work unchanged.
 */
export interface ExecutorContext extends MutationContext {
  readonly patchSink: PatchSink;
  readonly stepId: string;
}

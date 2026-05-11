// packages/adapter-sandbox/src/in-process-runner.ts
// `InProcessSandboxRunner` — runs the adapter callable directly in the host
// Node process. NO ISOLATION in v1; this is a documented trust boundary.
//
// Every adapter that ships today (kokoro, fish-speech, ace-step, yue,
// stable-audio-open) is StageFlip-built on Apache-2.0 / MIT models we
// audit ourselves; the same trust posture as host code. If a third-party
// `in-process` adapter ever lands in-tree, this runner is the place to
// add `vm.Context` isolation (v2 work; ADR-007 §D4).
//
// The runner is still responsible for emitting `start` / `complete` /
// `failed` audit events — even with no isolation, the audit trail is the
// security-team signal that the adapter ran.
//
// Determinism: pure dispatch. No clock / RNG. Audit events carry no
// timestamp by default; if the host wants timestamps it injects them
// upstream via a transport wrapper.

import type { AdapterAuditEvent, SandboxInvocation, SandboxRunner } from './types.js';
import { maybeMakeUsageEmitContext } from './usage-emit.js';

/**
 * Host-supplied callable invoked by `InProcessSandboxRunner`. Receives
 * the descriptor (so the host can route by adapter id) + the raw input
 * payload + the scoped credential. Returns the adapter's output.
 *
 * The host wires this to its in-process adapter dispatch table — for
 * StageFlip's reference adapters today, this is a switch on
 * `descriptor.id` that calls the corresponding `<adapter>.synthesize` /
 * `<adapter>.generate` method.
 */
export type InProcessCallable = (
  descriptor: SandboxInvocation['descriptor'],
  input: unknown,
  credential: SandboxInvocation['credential'],
) => Promise<unknown>;

/**
 * `InProcessSandboxRunner` — wraps the callable with audit-event emission.
 * No process boundary; no `vm.Context`; no resource limits. The trust
 * boundary is identical to direct invocation.
 */
export class InProcessSandboxRunner implements SandboxRunner {
  constructor(private readonly callable: InProcessCallable) {}

  async run<TOut>(invocation: SandboxInvocation): Promise<TOut> {
    const baseEvent = {
      adapterId: invocation.descriptor.id,
      modality: invocation.descriptor.modality.kind,
      tenantId: invocation.tenantId,
      sandboxKind: 'in-process',
    } as const;

    const startEvent: AdapterAuditEvent = { kind: 'start', ...baseEvent };
    invocation.auditEmitter.emit(startEvent);

    // T-445 — capture clock for usage telemetry (no-op when seam absent).
    const usageCtx = maybeMakeUsageEmitContext(invocation);
    const startMs = usageCtx !== undefined ? usageCtx.clock() : 0;

    try {
      const result = (await this.callable(
        invocation.descriptor,
        invocation.input,
        invocation.credential,
      )) as TOut;
      const completeEvent: AdapterAuditEvent = { kind: 'complete', ...baseEvent };
      invocation.auditEmitter.emit(completeEvent);
      if (usageCtx !== undefined) {
        usageCtx.emit('success', startMs, usageCtx.clock());
      }
      return result;
    } catch (cause) {
      const errorMessage = cause instanceof Error ? cause.message : String(cause);
      const failedEvent: AdapterAuditEvent = {
        kind: 'failed',
        ...baseEvent,
        errorMessage,
      };
      invocation.auditEmitter.emit(failedEvent);
      if (usageCtx !== undefined) {
        usageCtx.emit('failed', startMs, usageCtx.clock());
      }
      throw cause;
    }
  }
}

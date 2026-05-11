// packages/adapter-sandbox/src/usage-emit.ts
// Per-runner helper that emits an `AdapterUsageEventLike` when the
// host has wired the T-445 telemetry seam. Shared across the three
// runners (in-process / sidecar / remote-service) so the shape and
// no-op logic stay uniform.
//
// Determinism posture: pure dispatch — the clock seam is the only
// non-pure element and is injected on every invocation. Runners are
// operational glue and outside the determinism scan path.

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import type { AdapterUsageEventLike, SandboxInvocation } from './types.js';

/**
 * Resolves to `undefined` if the host hasn't wired all three optional
 * usage-telemetry fields (`usageEmitter` + `clock` + `selectedReason`).
 * Otherwise returns a closure that, given a terminal outcome + start
 * timestamp, emits the usage event verbatim.
 *
 * The closure-construction pattern matches the runners' "wire on entry,
 * settle on exit" lifecycle — the runner captures the closure once at
 * `start`, then calls it post-terminal-audit-event.
 */
export interface UsageEmitContext {
  readonly emit: (
    outcome: AdapterUsageEventLike['outcome'],
    startMs: number,
    endMs: number,
  ) => void;
  readonly clock: () => number;
}

export function maybeMakeUsageEmitContext(
  invocation: SandboxInvocation,
): UsageEmitContext | undefined {
  const { usageEmitter, clock, selectedReason } = invocation;
  if (usageEmitter === undefined || clock === undefined || selectedReason === undefined) {
    return undefined;
  }
  const emit = (
    outcome: AdapterUsageEventLike['outcome'],
    startMs: number,
    endMs: number,
  ): void => {
    const event = buildUsageEvent(invocation, outcome, startMs, endMs, selectedReason);
    usageEmitter.emit(event);
  };
  return { emit, clock };
}

function buildUsageEvent(
  invocation: SandboxInvocation,
  outcome: AdapterUsageEventLike['outcome'],
  startMs: number,
  endMs: number,
  selectedReason: AdapterUsageEventLike['selectedReason'],
): AdapterUsageEventLike {
  const descriptor: AdapterDescriptor = invocation.descriptor;
  // Cost is `costPerCall.usd ?? 0`. Free adapters (apache-2.0 TTS /
  // music / sfx) record a zero-amount line item for completeness.
  const costAmount = (descriptor as { costPerCall?: { usd?: number } }).costPerCall?.usd ?? 0;
  const latencyMs = Math.max(0, endMs - startMs);
  return {
    tenantId: invocation.tenantId,
    adapterId: descriptor.id,
    modality: descriptor.modality.kind,
    selectedReason,
    latencyMs,
    costAmount,
    costCurrency: 'USD',
    outcome,
    timestamp: new Date(endMs).toISOString(),
  };
}

// packages/adapter-sandbox/src/in-process-runner.test.ts
// Tests for InProcessSandboxRunner — round-trip + error path + audit
// event emission ordering.

import { describe, expect, it, vi } from 'vitest';

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import { InMemoryAuditEmitter } from './audit-emitter.js';
import { InProcessSandboxRunner } from './in-process-runner.js';
import type { AdapterUsageEventLike, SandboxInvocation } from './types.js';

class CapturingUsageEmitter {
  readonly events: AdapterUsageEventLike[] = [];
  emit(event: AdapterUsageEventLike): void {
    this.events.push(event);
  }
}

function makeClock(initialMs: number, stepMs: number): () => number {
  let t = initialMs;
  return () => {
    const v = t;
    t += stepMs;
    return v;
  };
}

const descriptor: AdapterDescriptor = {
  id: 'fake-tts',
  modality: { kind: 'tts' },
  capability: {},
  license: { kind: 'apache-2.0' },
  sandbox: { kind: 'in-process' },
};

function makeInvocation(over: Partial<SandboxInvocation> = {}): SandboxInvocation {
  const auditEmitter = over.auditEmitter ?? new InMemoryAuditEmitter();
  return {
    descriptor,
    tenantId: 't-1',
    credential: null,
    input: { text: 'hi' },
    auditEmitter,
    ...over,
  };
}

describe('InProcessSandboxRunner', () => {
  it('forwards descriptor + input + credential to the callable and returns its result', async () => {
    const callable = vi.fn(async () => ({ ok: true, audio: 'bytes' }));
    const runner = new InProcessSandboxRunner(callable);
    const result = await runner.run(makeInvocation());
    expect(result).toEqual({ ok: true, audio: 'bytes' });
    expect(callable).toHaveBeenCalledTimes(1);
    expect(callable).toHaveBeenCalledWith(descriptor, { text: 'hi' }, null);
  });

  it('forwards a non-null credential', async () => {
    const callable = vi.fn(async () => 'ok');
    const runner = new InProcessSandboxRunner(callable);
    await runner.run(makeInvocation({ credential: { apiKey: 'sk-abc' } }));
    expect(callable).toHaveBeenCalledWith(descriptor, { text: 'hi' }, { apiKey: 'sk-abc' });
  });

  it('emits start + complete on success', async () => {
    const emitter = new InMemoryAuditEmitter();
    const runner = new InProcessSandboxRunner(async () => 'ok');
    await runner.run(makeInvocation({ auditEmitter: emitter }));
    const evs = emitter.events();
    expect(evs.map((e) => e.kind)).toEqual(['start', 'complete']);
    expect(evs[0]).toMatchObject({
      kind: 'start',
      adapterId: 'fake-tts',
      modality: 'tts',
      tenantId: 't-1',
      sandboxKind: 'in-process',
    });
  });

  it('emits start + failed and rethrows on callable error', async () => {
    const emitter = new InMemoryAuditEmitter();
    const runner = new InProcessSandboxRunner(async () => {
      throw new Error('boom');
    });
    await expect(runner.run(makeInvocation({ auditEmitter: emitter }))).rejects.toThrow('boom');
    const evs = emitter.events();
    expect(evs.map((e) => e.kind)).toEqual(['start', 'failed']);
    expect(evs[1]).toMatchObject({ kind: 'failed', errorMessage: 'boom' });
  });

  it('renders non-Error throws via String() into errorMessage', async () => {
    const emitter = new InMemoryAuditEmitter();
    const runner = new InProcessSandboxRunner(async () => {
      throw 'just-a-string';
    });
    await expect(runner.run(makeInvocation({ auditEmitter: emitter }))).rejects.toBe(
      'just-a-string',
    );
    const evs = emitter.events();
    expect(evs[1]).toMatchObject({ kind: 'failed', errorMessage: 'just-a-string' });
  });

  // ---- T-445 — usage telemetry ----

  it('does not emit usage when seam absent', async () => {
    const usageEmitter = new CapturingUsageEmitter();
    const runner = new InProcessSandboxRunner(async () => 'ok');
    // Only usageEmitter wired (missing clock + selectedReason) — must skip emission.
    await runner.run(makeInvocation({ usageEmitter }));
    expect(usageEmitter.events).toEqual([]);
  });

  it('emits success usage event when all three seam fields are wired', async () => {
    const usageEmitter = new CapturingUsageEmitter();
    const clock = makeClock(1_000_000, 50); // start=1_000_000; end=1_000_050
    const runner = new InProcessSandboxRunner(async () => 'ok');
    await runner.run(makeInvocation({ usageEmitter, clock, selectedReason: 'capability-router' }));
    expect(usageEmitter.events.length).toBe(1);
    expect(usageEmitter.events[0]).toMatchObject({
      tenantId: 't-1',
      adapterId: 'fake-tts',
      modality: 'tts',
      selectedReason: 'capability-router',
      latencyMs: 50,
      costAmount: 0,
      costCurrency: 'USD',
      outcome: 'success',
    });
    expect(usageEmitter.events[0]?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('emits failed usage event with selectedReason=explicit', async () => {
    const usageEmitter = new CapturingUsageEmitter();
    const clock = makeClock(2_000_000, 10);
    const runner = new InProcessSandboxRunner(async () => {
      throw new Error('boom');
    });
    await expect(
      runner.run(makeInvocation({ usageEmitter, clock, selectedReason: 'explicit' })),
    ).rejects.toThrow('boom');
    expect(usageEmitter.events.length).toBe(1);
    expect(usageEmitter.events[0]).toMatchObject({
      selectedReason: 'explicit',
      outcome: 'failed',
      latencyMs: 10,
    });
  });

  it('reads costAmount from descriptor.costPerCall.usd when present', async () => {
    const usageEmitter = new CapturingUsageEmitter();
    const clock = makeClock(0, 1);
    const runner = new InProcessSandboxRunner(async () => 'ok');
    const descriptorWithCost: AdapterDescriptor = {
      ...descriptor,
      costPerCall: { usd: 0.04 },
    };
    await runner.run({
      descriptor: descriptorWithCost,
      tenantId: 't-1',
      credential: null,
      input: { text: 'hi' },
      auditEmitter: new InMemoryAuditEmitter(),
      usageEmitter,
      clock,
      selectedReason: 'capability-router',
    });
    expect(usageEmitter.events[0]?.costAmount).toBe(0.04);
  });
});

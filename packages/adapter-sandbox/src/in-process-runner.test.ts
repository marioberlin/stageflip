// packages/adapter-sandbox/src/in-process-runner.test.ts
// Tests for InProcessSandboxRunner — round-trip + error path + audit
// event emission ordering.

import { describe, expect, it, vi } from 'vitest';

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import { InMemoryAuditEmitter } from './audit-emitter.js';
import { InProcessSandboxRunner } from './in-process-runner.js';
import type { SandboxInvocation } from './types.js';

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
});

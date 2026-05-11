// packages/adapter-sandbox/src/sandbox-factory.test.ts
// Tests for SandboxFactory dispatch on descriptor.sandbox.kind.

import { describe, expect, it } from 'vitest';

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import { SandboxFactory } from './sandbox-factory.js';
import type { SandboxInvocation, SandboxRunner } from './types.js';

function makeRunner(tag: string): SandboxRunner {
  return {
    async run<TOut>(_inv: SandboxInvocation): Promise<TOut> {
      return tag as TOut;
    },
  };
}

const base: AdapterDescriptor = {
  id: 'fake',
  modality: { kind: 'tts' },
  capability: {},
  license: { kind: 'apache-2.0' },
  sandbox: { kind: 'in-process' },
};

describe('SandboxFactory', () => {
  const factory = new SandboxFactory({
    inProcess: makeRunner('in-process'),
    sidecar: makeRunner('sidecar'),
    remoteService: makeRunner('remote-service'),
  });

  it('returns in-process runner for in-process descriptor', () => {
    const r = factory.pick(base);
    expect(r).toBeDefined();
  });

  it('returns sidecar runner for sidecar descriptor', () => {
    const r = factory.pick({
      ...base,
      sandbox: { kind: 'sidecar', runtime: 'node' },
    });
    expect(r).toBeDefined();
  });

  it('returns remote-service runner for remote-service descriptor', () => {
    const r = factory.pick({
      ...base,
      sandbox: { kind: 'remote-service', baseUrlEnvVar: 'FAKE' },
    });
    expect(r).toBeDefined();
  });

  it('throws on wasm-sandbox (not implemented in v1)', () => {
    expect(() =>
      factory.pick({
        ...base,
        sandbox: { kind: 'wasm-sandbox' },
      }),
    ).toThrow(/wasm-sandbox.*not implemented/);
  });

  it('round-trips end-to-end — picked runner emits tag', async () => {
    const inProcess = makeRunner('IN');
    const sidecar = makeRunner('SC');
    const remoteService = makeRunner('RS');
    const f = new SandboxFactory({ inProcess, sidecar, remoteService });

    const invocation: SandboxInvocation = {
      descriptor: base,
      tenantId: 't-1',
      credential: null,
      input: {},
      auditEmitter: { emit() {} },
    };
    expect(await f.pick(base).run(invocation)).toBe('IN');
    expect(
      await f.pick({ ...base, sandbox: { kind: 'sidecar', runtime: 'node' } }).run(invocation),
    ).toBe('SC');
    expect(
      await f
        .pick({ ...base, sandbox: { kind: 'remote-service', baseUrlEnvVar: 'X' } })
        .run(invocation),
    ).toBe('RS');
  });
});

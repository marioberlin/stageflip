// packages/adapter-sandbox/src/types.test.ts
// Compile-time shape tests for the sandbox type module. These are
// type-only assertions; runtime behavior of each runner is tested
// in the per-runner test files.

import { describe, expect, it } from 'vitest';

import type {
  AdapterAuditEvent,
  AdapterCredential,
  AuditEmitter,
  ResourceLimits,
  SandboxInvocation,
  SandboxRunner,
} from './types.js';

describe('types — shape assertions', () => {
  it('AdapterCredential accepts apiKey-only / baseUrl-only / both / empty', () => {
    const a: AdapterCredential = { apiKey: 'k' };
    const b: AdapterCredential = { baseUrl: 'https://x' };
    const c: AdapterCredential = { apiKey: 'k', baseUrl: 'https://x' };
    const d: AdapterCredential = {};
    expect(a.apiKey).toBe('k');
    expect(b.baseUrl).toBe('https://x');
    expect(c.apiKey).toBe('k');
    expect(d).toEqual({});
  });

  it('ResourceLimits accepts any subset of the three dimensions', () => {
    const a: ResourceLimits = { maxCpuMs: 1000 };
    const b: ResourceLimits = { maxMemoryMb: 256 };
    const c: ResourceLimits = { maxDiskMb: 100 };
    const d: ResourceLimits = { maxCpuMs: 1000, maxMemoryMb: 256, maxDiskMb: 100 };
    const e: ResourceLimits = {};
    expect(a.maxCpuMs).toBe(1000);
    expect(b.maxMemoryMb).toBe(256);
    expect(c.maxDiskMb).toBe(100);
    expect(d).toBeDefined();
    expect(e).toEqual({});
  });

  it('AdapterAuditEvent — every kind constructs with required fields', () => {
    const start: AdapterAuditEvent = {
      kind: 'start',
      adapterId: 'a',
      modality: 'tts',
      tenantId: 't',
      sandboxKind: 'in-process',
    };
    const complete: AdapterAuditEvent = {
      kind: 'complete',
      adapterId: 'a',
      modality: 'tts',
      tenantId: 't',
      sandboxKind: 'in-process',
    };
    const failed: AdapterAuditEvent = {
      kind: 'failed',
      adapterId: 'a',
      modality: 'tts',
      tenantId: 't',
      sandboxKind: 'in-process',
      errorMessage: 'boom',
    };
    const killed: AdapterAuditEvent = {
      kind: 'killed-for-resource-limit',
      adapterId: 'a',
      modality: 'tts',
      tenantId: 't',
      sandboxKind: 'sidecar',
      dimension: 'cpu',
    };
    expect(start.kind).toBe('start');
    expect(complete.kind).toBe('complete');
    expect(failed.errorMessage).toBe('boom');
    expect(killed.dimension).toBe('cpu');
  });

  it('AuditEmitter has the expected emit method shape', () => {
    const events: AdapterAuditEvent[] = [];
    const emitter: AuditEmitter = {
      emit(e) {
        events.push(e);
      },
    };
    emitter.emit({
      kind: 'start',
      adapterId: 'a',
      modality: 'tts',
      tenantId: 't',
      sandboxKind: 'in-process',
    });
    expect(events.length).toBe(1);
  });

  it('SandboxRunner accepts a generic TOut at the call boundary', async () => {
    const r: SandboxRunner = {
      async run<TOut>(_inv: SandboxInvocation): Promise<TOut> {
        return 'ok' as TOut;
      },
    };
    const events: AdapterAuditEvent[] = [];
    const out = await r.run<string>({
      descriptor: {
        id: 'a',
        modality: { kind: 'tts' },
        capability: {},
        license: { kind: 'apache-2.0' },
        sandbox: { kind: 'in-process' },
      },
      tenantId: 't',
      credential: null,
      input: 'x',
      auditEmitter: {
        emit(e) {
          events.push(e);
        },
      },
    });
    expect(out).toBe('ok');
  });
});

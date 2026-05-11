// packages/adapter-sandbox/src/remote-service-runner.test.ts
// Tests for RemoteServiceSandboxRunner — URL resolution, header
// injection, error path, audit event emission.

import { describe, expect, it, vi } from 'vitest';

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import { InMemoryAuditEmitter } from './audit-emitter.js';
import { RemoteServiceConfigError, RemoteServiceSandboxRunner } from './remote-service-runner.js';
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
  id: 'fake-remote',
  modality: { kind: 'video-gen' },
  capability: {},
  license: { kind: 'proprietary-byo' },
  sandbox: { kind: 'remote-service', baseUrlEnvVar: 'FAKE_REMOTE_URL' },
};

function makeInvocation(over: Partial<SandboxInvocation> = {}): SandboxInvocation {
  const auditEmitter = over.auditEmitter ?? new InMemoryAuditEmitter();
  return {
    descriptor,
    tenantId: 't-1',
    credential: null,
    input: { prompt: 'a cat' },
    auditEmitter,
    ...over,
  };
}

describe('RemoteServiceSandboxRunner', () => {
  it('resolves base URL from env var by default; passes adapter id + tenant id headers', async () => {
    const httpsCallable = vi.fn(async () => ({ ok: true, video: 'bytes' }));
    const envLookup = (k: string): string | undefined =>
      k === 'FAKE_REMOTE_URL' ? 'https://api.fake.example/v1' : undefined;
    const runner = new RemoteServiceSandboxRunner(httpsCallable, envLookup);
    const result = await runner.run(makeInvocation());
    expect(result).toEqual({ ok: true, video: 'bytes' });
    expect(httpsCallable).toHaveBeenCalledTimes(1);
    const [url, headers, body] = httpsCallable.mock.calls[0] ?? [];
    expect(url).toBe('https://api.fake.example/v1');
    expect(headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-Adapter-Id': 'fake-remote',
      'X-Tenant-Id': 't-1',
    });
    expect((headers as Record<string, string>).Authorization).toBeUndefined();
    expect(body).toEqual({ prompt: 'a cat' });
  });

  it('forwards apiKey as Authorization: Bearer header', async () => {
    const httpsCallable = vi.fn(async () => 'ok');
    const runner = new RemoteServiceSandboxRunner(httpsCallable, (k) =>
      k === 'FAKE_REMOTE_URL' ? 'https://api.fake' : undefined,
    );
    await runner.run(makeInvocation({ credential: { apiKey: 'sk-tenant-abc' } }));
    const [, headers] = httpsCallable.mock.calls[0] ?? [];
    expect((headers as Record<string, string>).Authorization).toBe('Bearer sk-tenant-abc');
  });

  it('credential.baseUrl override takes precedence over env var', async () => {
    const httpsCallable = vi.fn(async () => 'ok');
    const runner = new RemoteServiceSandboxRunner(httpsCallable, () => 'https://env.example');
    await runner.run(makeInvocation({ credential: { baseUrl: 'https://override.example' } }));
    const [url] = httpsCallable.mock.calls[0] ?? [];
    expect(url).toBe('https://override.example');
  });

  it('throws RemoteServiceConfigError when neither env var nor credential.baseUrl is set', async () => {
    const httpsCallable = vi.fn(async () => 'ok');
    const runner = new RemoteServiceSandboxRunner(httpsCallable, () => undefined);
    await expect(runner.run(makeInvocation())).rejects.toThrow(RemoteServiceConfigError);
    expect(httpsCallable).not.toHaveBeenCalled();
  });

  it('emits start + complete on success', async () => {
    const emitter = new InMemoryAuditEmitter();
    const runner = new RemoteServiceSandboxRunner(
      async () => 'ok',
      () => 'https://api.fake',
    );
    await runner.run(makeInvocation({ auditEmitter: emitter }));
    const evs = emitter.events();
    expect(evs.map((e) => e.kind)).toEqual(['start', 'complete']);
    expect(evs[0]).toMatchObject({ sandboxKind: 'remote-service' });
  });

  it('emits start + failed on HTTPS error and rethrows', async () => {
    const emitter = new InMemoryAuditEmitter();
    const runner = new RemoteServiceSandboxRunner(
      async () => {
        throw new Error('502 Bad Gateway');
      },
      () => 'https://api.fake',
    );
    await expect(runner.run(makeInvocation({ auditEmitter: emitter }))).rejects.toThrow(
      '502 Bad Gateway',
    );
    const evs = emitter.events();
    expect(evs.map((e) => e.kind)).toEqual(['start', 'failed']);
    expect(evs[1]).toMatchObject({ errorMessage: '502 Bad Gateway' });
  });

  it('emits start + failed on URL-resolution failure', async () => {
    const emitter = new InMemoryAuditEmitter();
    const runner = new RemoteServiceSandboxRunner(vi.fn(), () => undefined);
    await expect(runner.run(makeInvocation({ auditEmitter: emitter }))).rejects.toThrow(
      RemoteServiceConfigError,
    );
    const evs = emitter.events();
    expect(evs.map((e) => e.kind)).toEqual(['start', 'failed']);
  });

  // ---- T-445 — usage telemetry ----

  it('emits success usage event when seam is wired', async () => {
    const usageEmitter = new CapturingUsageEmitter();
    const clock = makeClock(5_000, 120);
    const runner = new RemoteServiceSandboxRunner(
      async () => 'ok',
      () => 'https://api.fake',
    );
    await runner.run(makeInvocation({ usageEmitter, clock, selectedReason: 'capability-router' }));
    expect(usageEmitter.events.length).toBe(1);
    expect(usageEmitter.events[0]).toMatchObject({
      adapterId: 'fake-remote',
      modality: 'video-gen',
      selectedReason: 'capability-router',
      latencyMs: 120,
      outcome: 'success',
    });
  });

  it('emits failed usage event on HTTPS error', async () => {
    const usageEmitter = new CapturingUsageEmitter();
    const clock = makeClock(0, 5);
    const runner = new RemoteServiceSandboxRunner(
      async () => {
        throw new Error('502');
      },
      () => 'https://api.fake',
    );
    await expect(
      runner.run(makeInvocation({ usageEmitter, clock, selectedReason: 'explicit' })),
    ).rejects.toThrow('502');
    expect(usageEmitter.events.length).toBe(1);
    expect(usageEmitter.events[0]).toMatchObject({
      selectedReason: 'explicit',
      outcome: 'failed',
      latencyMs: 5,
    });
  });

  it('does NOT emit usage when usageEmitter seam absent', async () => {
    const clock = makeClock(0, 1);
    const runner = new RemoteServiceSandboxRunner(
      async () => 'ok',
      () => 'https://api.fake',
    );
    // Just clock + reason without emitter — no panic, just no emission.
    await runner.run(makeInvocation({ clock, selectedReason: 'capability-router' }));
    // Reach end with no error.
    expect(true).toBe(true);
  });

  it('rejects descriptors whose sandbox.kind is not remote-service', async () => {
    const wrong: AdapterDescriptor = {
      ...descriptor,
      sandbox: { kind: 'in-process' },
    };
    const runner = new RemoteServiceSandboxRunner(vi.fn(), () => 'https://x');
    await expect(
      runner.run({
        ...makeInvocation(),
        descriptor: wrong,
      }),
    ).rejects.toThrow(/expected sandbox.kind 'remote-service'/);
  });
});

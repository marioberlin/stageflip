// packages/adapter-sandbox/src/sidecar-runner.test.ts
// Tests for SidecarSandboxRunner. Uses a fake `SidecarChildHandle` —
// no real child process is spawned.

import { describe, expect, it, vi } from 'vitest';

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import { InMemoryAuditEmitter } from './audit-emitter.js';
import {
  type SidecarChildHandle,
  SidecarProtocolError,
  SidecarRpcError,
  SidecarSandboxRunner,
} from './sidecar-runner.js';
import type { SandboxInvocation } from './types.js';

interface FakeChild extends SidecarChildHandle {
  emitStdout(line: string): void;
  emitStderr(line: string): void;
  emitExit(code: number | null, signal?: NodeJS.Signals | null): void;
  stdinLines: string[];
  killSignals: (NodeJS.Signals | undefined)[];
}

function makeFakeChild(pid: number | undefined = 12345): FakeChild {
  let stdoutHandler: ((l: string) => void) | undefined;
  let stderrHandler: ((l: string) => void) | undefined;
  let exitHandler: ((c: number | null, s: NodeJS.Signals | null) => void) | undefined;
  const stdinLines: string[] = [];
  const killSignals: (NodeJS.Signals | undefined)[] = [];
  return {
    pid,
    writeStdin(line) {
      stdinLines.push(line);
    },
    onStdoutLine(h) {
      stdoutHandler = h;
    },
    onStderrLine(h) {
      stderrHandler = h;
    },
    onExit(h) {
      exitHandler = h;
    },
    kill(signal) {
      killSignals.push(signal);
    },
    emitStdout(line) {
      stdoutHandler?.(line);
    },
    emitStderr(line) {
      stderrHandler?.(line);
    },
    emitExit(code, signal) {
      exitHandler?.(code, signal ?? null);
    },
    stdinLines,
    killSignals,
  };
}

const sidecarDescriptor: AdapterDescriptor = {
  id: 'fake-sidecar',
  modality: { kind: 'tts' },
  capability: {},
  license: { kind: 'apache-2.0' },
  sandbox: { kind: 'sidecar', runtime: 'python' },
};

function makeInvocation(
  child: FakeChild,
  over: Partial<SandboxInvocation> = {},
): {
  invocation: SandboxInvocation;
  emitter: InMemoryAuditEmitter;
  spawnSidecar: () => SidecarChildHandle;
} {
  const emitter = over.auditEmitter ?? new InMemoryAuditEmitter();
  const spawnSidecar = vi.fn(() => child);
  const invocation: SandboxInvocation = {
    descriptor: sidecarDescriptor,
    tenantId: 't-1',
    credential: null,
    input: { hello: 'world' },
    auditEmitter: emitter,
    ...over,
  };
  return { invocation, emitter: emitter as InMemoryAuditEmitter, spawnSidecar };
}

describe('SidecarSandboxRunner', () => {
  it('writes JSON-RPC init to stdin, parses result line, returns payload', async () => {
    const child = makeFakeChild();
    const { invocation, emitter, spawnSidecar } = makeInvocation(child);
    const runner = new SidecarSandboxRunner({ spawnSidecar });
    const p = runner.run(invocation);
    // Init line should already be written synchronously.
    expect(child.stdinLines).toHaveLength(1);
    const parsed = JSON.parse(child.stdinLines[0] ?? '');
    expect(parsed).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      method: 'init',
      params: {
        adapterId: 'fake-sidecar',
        credential: null,
        input: { hello: 'world' },
      },
    });
    // Sidecar replies with result.
    child.emitStdout(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { ok: true } }));
    await expect(p).resolves.toEqual({ ok: true });
    expect(emitter.events().map((e) => e.kind)).toEqual(['start', 'complete']);
    expect(child.killSignals).toContain('SIGKILL');
  });

  it('forwards credential through the JSON-RPC params', async () => {
    const child = makeFakeChild();
    const { invocation, spawnSidecar } = makeInvocation(child, {
      credential: { apiKey: 'sk-abc', baseUrl: 'https://x' },
    });
    const runner = new SidecarSandboxRunner({ spawnSidecar });
    const p = runner.run(invocation);
    const parsed = JSON.parse(child.stdinLines[0] ?? '');
    expect(parsed.params.credential).toEqual({ apiKey: 'sk-abc', baseUrl: 'https://x' });
    child.emitStdout(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 'ok' }));
    await p;
  });

  it('rejects with SidecarRpcError on RPC error response and emits failed', async () => {
    const child = makeFakeChild();
    const { invocation, emitter, spawnSidecar } = makeInvocation(child);
    const runner = new SidecarSandboxRunner({ spawnSidecar });
    const p = runner.run(invocation);
    child.emitStdout(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32000, message: 'sidecar boom' },
      }),
    );
    await expect(p).rejects.toBeInstanceOf(SidecarRpcError);
    await expect(p).rejects.toThrow('sidecar boom');
    expect(emitter.events().map((e) => e.kind)).toEqual(['start', 'failed']);
  });

  it('rejects with SidecarProtocolError on non-JSON stdout line', async () => {
    const child = makeFakeChild();
    const { invocation, emitter, spawnSidecar } = makeInvocation(child);
    const runner = new SidecarSandboxRunner({ spawnSidecar });
    const p = runner.run(invocation);
    child.emitStdout('not-json');
    await expect(p).rejects.toBeInstanceOf(SidecarProtocolError);
    expect(emitter.events().map((e) => e.kind)).toEqual(['start', 'failed']);
  });

  it('rejects with SidecarProtocolError on premature exit', async () => {
    const child = makeFakeChild();
    const { invocation, emitter, spawnSidecar } = makeInvocation(child);
    const runner = new SidecarSandboxRunner({ spawnSidecar });
    const p = runner.run(invocation);
    child.emitExit(1, 'SIGTERM');
    await expect(p).rejects.toBeInstanceOf(SidecarProtocolError);
    await expect(p).rejects.toThrow(/exited before producing a result/);
    expect(emitter.events().map((e) => e.kind)).toEqual(['start', 'failed']);
  });

  it('enforces maxCpuMs via wall-clock timer; emits killed-for-resource-limit cpu', async () => {
    const child = makeFakeChild();
    let cpuFire: (() => void) | undefined;
    const setWallClockTimer = vi.fn((_ms: number, cb: () => void) => {
      cpuFire = cb;
      return () => {
        cpuFire = undefined;
      };
    });
    const sidecarDescWithCpu: AdapterDescriptor = {
      ...sidecarDescriptor,
      // resourceLimits is a top-level addition on the descriptor; per
      // T-444 AC #1 the type carries it as an optional field. Cast for
      // forward-compat since this test runs alongside the descriptor
      // type widening commit.
      ...({ resourceLimits: { maxCpuMs: 100 } } as { resourceLimits: { maxCpuMs: number } }),
    };
    const emitter = new InMemoryAuditEmitter();
    const runner = new SidecarSandboxRunner({
      spawnSidecar: () => child,
      setWallClockTimer,
    });
    const p = runner.run({
      descriptor: sidecarDescWithCpu,
      tenantId: 't-1',
      credential: null,
      input: {},
      auditEmitter: emitter,
    });
    expect(setWallClockTimer).toHaveBeenCalledWith(100, expect.any(Function));
    expect(cpuFire).toBeTypeOf('function');
    cpuFire?.();
    await expect(p).rejects.toThrow(/cpu/);
    const evs = emitter.events();
    expect(evs.map((e) => e.kind)).toEqual(['start', 'killed-for-resource-limit']);
    expect(evs[1]).toMatchObject({
      kind: 'killed-for-resource-limit',
      dimension: 'cpu',
      sandboxKind: 'sidecar',
    });
    expect(child.killSignals).toContain('SIGKILL');
  });

  it('enforces maxMemoryMb via interval poll; emits killed-for-resource-limit memory', async () => {
    const child = makeFakeChild(99999);
    let memPollFire: (() => void) | undefined;
    const setIntervalSeam = vi.fn((_ms: number, cb: () => void) => {
      memPollFire = cb;
      return () => {
        memPollFire = undefined;
      };
    });
    const readMemoryRssMb = vi.fn(() => 256); // exceeds cap
    const sidecarDescWithMem: AdapterDescriptor = {
      ...sidecarDescriptor,
      ...({ resourceLimits: { maxMemoryMb: 128 } } as {
        resourceLimits: { maxMemoryMb: number };
      }),
    };
    const emitter = new InMemoryAuditEmitter();
    const runner = new SidecarSandboxRunner({
      spawnSidecar: () => child,
      readMemoryRssMb,
      setIntervalSeam,
    });
    const p = runner.run({
      descriptor: sidecarDescWithMem,
      tenantId: 't-1',
      credential: null,
      input: {},
      auditEmitter: emitter,
    });
    expect(setIntervalSeam).toHaveBeenCalled();
    memPollFire?.();
    await expect(p).rejects.toThrow(/memory/);
    const evs = emitter.events();
    expect(evs[1]).toMatchObject({ kind: 'killed-for-resource-limit', dimension: 'memory' });
  });

  it('does not arm memory poll when child.pid is undefined', async () => {
    // Explicitly construct a child with undefined pid (default param
    // applies when passing `undefined`, so we override by direct prop
    // assignment after construction).
    const child = makeFakeChild(123);
    (child as { pid: number | undefined }).pid = undefined;
    const setIntervalSeam = vi.fn();
    const sidecarDescWithMem: AdapterDescriptor = {
      ...sidecarDescriptor,
      ...({ resourceLimits: { maxMemoryMb: 128 } } as {
        resourceLimits: { maxMemoryMb: number };
      }),
    };
    const runner = new SidecarSandboxRunner({
      spawnSidecar: () => child,
      readMemoryRssMb: () => 999,
      setIntervalSeam,
    });
    const emitter = new InMemoryAuditEmitter();
    const p = runner.run({
      descriptor: sidecarDescWithMem,
      tenantId: 't-1',
      credential: null,
      input: {},
      auditEmitter: emitter,
    });
    expect(setIntervalSeam).not.toHaveBeenCalled();
    // Resolve via normal result so test doesn't hang.
    child.emitStdout(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 'ok' }));
    await p;
  });

  it('always kills the child + cancels timers in finally', async () => {
    const child = makeFakeChild();
    const cpuCancel = vi.fn();
    const setWallClockTimer = vi.fn(() => cpuCancel);
    const sidecarDescWithCpu: AdapterDescriptor = {
      ...sidecarDescriptor,
      ...({ resourceLimits: { maxCpuMs: 10000 } } as { resourceLimits: { maxCpuMs: number } }),
    };
    const runner = new SidecarSandboxRunner({
      spawnSidecar: () => child,
      setWallClockTimer,
    });
    const p = runner.run({
      descriptor: sidecarDescWithCpu,
      tenantId: 't-1',
      credential: null,
      input: {},
      auditEmitter: new InMemoryAuditEmitter(),
    });
    child.emitStdout(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 'ok' }));
    await p;
    expect(cpuCancel).toHaveBeenCalled();
    expect(child.killSignals).toContain('SIGKILL');
  });

  it('rejects descriptors whose sandbox.kind is not sidecar', async () => {
    const wrong: AdapterDescriptor = {
      ...sidecarDescriptor,
      sandbox: { kind: 'in-process' },
    };
    const runner = new SidecarSandboxRunner({
      spawnSidecar: () => makeFakeChild(),
    });
    await expect(
      runner.run({
        descriptor: wrong,
        tenantId: 't-1',
        credential: null,
        input: {},
        auditEmitter: new InMemoryAuditEmitter(),
      }),
    ).rejects.toThrow(/expected sandbox.kind 'sidecar'/);
  });
});

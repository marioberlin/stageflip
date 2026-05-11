// packages/adapters-core/src/fallback-executor.test.ts
// FallbackChainExecutor tests — first-success-short-circuits / all-fail-
// aggregates / empty-chain / single-adapter / telemetry-emits-once-per-
// failure / determinism.

import { describe, expect, it, vi } from 'vitest';

import type { AdapterDescriptor } from './adapter-descriptor.js';
import { ADAPTER_FALLBACK_FAILURE_EVENT, FallbackChainExecutor } from './fallback-executor.js';
import type { EmitTelemetry } from './telemetry.js';

function makeAdapter(id: string): AdapterDescriptor {
  return {
    id,
    modality: { kind: 'tts' },
    capability: {},
    license: { kind: 'apache-2.0' },
    sandbox: { kind: 'in-process' },
  };
}

describe('FallbackChainExecutor.execute', () => {
  const executor = new FallbackChainExecutor();

  it('returns ok=false with empty errors on empty chain', async () => {
    const emit = vi.fn();
    const result = await executor.execute([], async () => 'unreached', { emitTelemetry: emit });
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.errors).toEqual([]);
    expect(emit).not.toHaveBeenCalled();
  });

  it('short-circuits on first success', async () => {
    const adapters = [makeAdapter('a'), makeAdapter('b'), makeAdapter('c')];
    const call = vi.fn(async (a: AdapterDescriptor) => `ok-${a.id}`);
    const result = await executor.execute(adapters, call);
    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.result).toBe('ok-a');
      expect(result.adapter.id).toBe('a');
      expect(result.attempts).toBe(1);
    }
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('falls through to next adapter on failure', async () => {
    const adapters = [makeAdapter('a'), makeAdapter('b'), makeAdapter('c')];
    const call = vi.fn(async (adapter: AdapterDescriptor) => {
      if (adapter.id === 'a') throw new Error('boom');
      if (adapter.id === 'b') throw new Error('also boom');
      return 'ok';
    });
    const emit = vi.fn();
    const result = await executor.execute(adapters, call, { emitTelemetry: emit });
    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.result).toBe('ok');
      expect(result.adapter.id).toBe('c');
      expect(result.attempts).toBe(3);
    }
    expect(call).toHaveBeenCalledTimes(3);
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('aggregates all errors when every adapter fails', async () => {
    const adapters = [makeAdapter('a'), makeAdapter('b')];
    const call = async (adapter: AdapterDescriptor) => {
      throw new Error(`fail-${adapter.id}`);
    };
    const result = await executor.execute(adapters, call);
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]?.adapterId).toBe('a');
      expect(result.errors[0]?.errorMessage).toBe('fail-a');
      expect(result.errors[0]?.modality).toBe('tts');
      expect(result.errors[1]?.adapterId).toBe('b');
      expect(result.errors[1]?.errorMessage).toBe('fail-b');
    }
  });

  it('emits exactly one telemetry event per failure with stable shape', async () => {
    const adapters = [makeAdapter('a'), makeAdapter('b')];
    const call = async (adapter: AdapterDescriptor) => {
      throw new Error(`fail-${adapter.id}`);
    };
    const emit: EmitTelemetry = vi.fn();
    await executor.execute(adapters, call, { emitTelemetry: emit });
    expect(emit).toHaveBeenCalledTimes(2);
    expect((emit as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([
      ADAPTER_FALLBACK_FAILURE_EVENT,
      { adapterId: 'a', modality: 'tts', errorMessage: 'fail-a', attempt: 1 },
    ]);
    expect((emit as ReturnType<typeof vi.fn>).mock.calls[1]).toEqual([
      ADAPTER_FALLBACK_FAILURE_EVENT,
      { adapterId: 'b', modality: 'tts', errorMessage: 'fail-b', attempt: 2 },
    ]);
  });

  it('produces deterministic telemetry payloads across runs (no Date.now / no RNG)', async () => {
    const adapters = [makeAdapter('a'), makeAdapter('b')];
    const call = async (adapter: AdapterDescriptor) => {
      throw new Error(`fail-${adapter.id}`);
    };
    const calls1: unknown[][] = [];
    const calls2: unknown[][] = [];
    await executor.execute(adapters, call, {
      emitTelemetry: (event, attrs) => calls1.push([event, attrs]),
    });
    await executor.execute(adapters, call, {
      emitTelemetry: (event, attrs) => calls2.push([event, attrs]),
    });
    expect(calls1).toEqual(calls2);
  });

  it('includes a caller-supplied timestamp when `clock` option is provided', async () => {
    const adapters = [makeAdapter('a')];
    const call = async () => {
      throw new Error('boom');
    };
    let tick = 1000;
    const clock = () => ++tick;
    const calls: unknown[][] = [];
    await executor.execute(adapters, call, {
      emitTelemetry: (event, attrs) => calls.push([event, attrs]),
      clock,
    });
    expect(calls[0]?.[1]).toMatchObject({ timestamp: 1001 });
  });

  it('handles non-Error throws via String(cause)', async () => {
    const adapters = [makeAdapter('a')];
    const call = async () => {
      // biome-ignore lint/suspicious/noExplicitAny: testing non-Error throw on purpose
      throw 42 as any;
    };
    const result = await executor.execute(adapters, call);
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.errors[0]?.errorMessage).toBe('42');
      expect(result.errors[0]?.cause).toBe(42);
    }
  });

  it('captures the original cause for inspection', async () => {
    const adapters = [makeAdapter('a')];
    const original = new Error('original');
    const call = async () => {
      throw original;
    };
    const result = await executor.execute(adapters, call);
    if (result.ok === false) {
      expect(result.errors[0]?.cause).toBe(original);
    }
  });

  it('uses noop telemetry when emitTelemetry is not supplied', async () => {
    const adapters = [makeAdapter('a'), makeAdapter('b')];
    const call = async () => {
      throw new Error('x');
    };
    // No throw / no crash — just exhausts the chain.
    const result = await executor.execute(adapters, call);
    expect(result.ok).toBe(false);
  });
});

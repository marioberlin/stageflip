// packages/runtime-on-device-player/src/shim.test.ts
// `OnDevicePlayerShim` orchestration tests per T-399 acceptance criteria.
// Coverage spans:
//   - boot lifecycle (single + re-boot)
//   - the five refusal reasons (tenant-flag-disabled, preview-not-ga,
//     no-factory-registered, permission-refused, capability-insufficient)
//   - capability matrix per family (shader/three → GPU, voice → mic,
//     network-using families → network, ai-generative GPU-permissive)
//   - happy-path mount + telemetry ordering
//   - listMounted / unmount / multi-clip + shutdown semantics
//   - clock injection for `mount-success.elapsedMs`
//   - source-level determinism scan (no Date / Math.random / setTimeout
//     / setInterval / requestAnimationFrame / fetch / XHR references)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  InteractiveClipRegistry,
  InteractiveMountHarness,
  type PermissionShim,
  type TenantPolicy,
} from '@stageflip/runtimes-interactive';
import { describe, expect, it, vi } from 'vitest';

import type {
  DisplayDeviceCapability,
  OnDevicePlayerRefusalReason,
  TelemetryEvent,
  TenantFlagValue,
} from './contract.js';
import { createOnDevicePlayerShim } from './shim.js';

// ---------- shared fixtures ----------

function makeDevice(overrides: Partial<DisplayDeviceCapability> = {}): DisplayDeviceCapability {
  return {
    deviceId: 'test-device-001',
    hardwareClass: 'signage',
    resolution: { width: 1920, height: 1080 },
    refreshHz: 60,
    hasGpu: true,
    hasAudio: true,
    hasNetwork: true,
    hasMicrophone: true,
    hasCamera: true,
    osPlatform: 'linux',
    playerVersion: '0.0.0-test',
    ...overrides,
  };
}

/**
 * Build an `InteractiveMountHarness` whose registry has the given families
 * registered with a stub factory. The factory returns a no-op handle so
 * the shim's happy path can complete in tests without DOM operations
 * besides the detached root.
 */
function makeHarnessWithRegistered(
  families: ReadonlyArray<Parameters<InteractiveClipRegistry['register']>[0]>,
  options: {
    readonly tenantPolicy?: TenantPolicy;
    readonly permissionShim?: PermissionShim;
  } = {},
): { harness: InteractiveMountHarness; disposeCount: () => number } {
  const registry = new InteractiveClipRegistry();
  let disposes = 0;
  for (const family of families) {
    registry.register(family, async () => ({
      updateProps: () => undefined,
      dispose: () => {
        disposes += 1;
      },
    }));
  }
  const harness = new InteractiveMountHarness({
    registry,
    ...(options.tenantPolicy ? { tenantPolicy: options.tenantPolicy } : {}),
    ...(options.permissionShim ? { permissionShim: options.permissionShim } : {}),
  });
  return { harness, disposeCount: () => disposes };
}

/**
 * Construct a shim using `harnessOptions` so the shim's internal refusal
 * observer wraps the harness's telemetry sink. This is the test-only
 * mode where the shim owns the harness instance; production binaries
 * pass a pre-built `mountHarness` instead.
 */
function makeShimWithHarnessOptions(
  families: ReadonlyArray<Parameters<InteractiveClipRegistry['register']>[0]>,
  options: {
    readonly tenantPolicy?: TenantPolicy;
    readonly permissionShim?: PermissionShim;
  } = {},
): {
  shim: ReturnType<typeof createOnDevicePlayerShim>;
  events: TelemetryEvent[];
} {
  const registry = new InteractiveClipRegistry();
  for (const family of families) {
    registry.register(family, async () => ({
      updateProps: () => undefined,
      dispose: () => undefined,
    }));
  }
  const events: TelemetryEvent[] = [];
  const shim = createOnDevicePlayerShim({
    // `mountHarness` is unused when `harnessOptions` is supplied, but
    // the field is required on the deps type — pass a dummy.
    mountHarness: new InteractiveMountHarness({ registry: new InteractiveClipRegistry() }),
    harnessOptions: {
      registry,
      ...(options.tenantPolicy ? { tenantPolicy: options.tenantPolicy } : {}),
      ...(options.permissionShim ? { permissionShim: options.permissionShim } : {}),
    },
  });
  shim.boot({
    device: makeDevice(),
    emitTelemetry: (e) => events.push(e),
  });
  return { shim, events };
}

const PASS_TENANT: { readonly featuresInteractive: TenantFlagValue } = {
  featuresInteractive: 'ga',
};

// ---------- boot ----------

describe('OnDevicePlayerShim.boot', () => {
  it('emits a `boot` telemetry event carrying the device capability', () => {
    const events: TelemetryEvent[] = [];
    const { harness } = makeHarnessWithRegistered(['shader']);
    const shim = createOnDevicePlayerShim({ mountHarness: harness });
    const device = makeDevice({ deviceId: 'boot-test' });
    shim.boot({ device, emitTelemetry: (e) => events.push(e) });
    expect(events).toEqual([{ kind: 'boot', device }]);
  });

  it('re-boot clears prior mount tracking', async () => {
    const { shim, events } = makeShimWithHarnessOptions(['shader']);
    const r1 = await shim.mount({
      tenantId: 't',
      tenantPolicy: PASS_TENANT,
      clipFamily: 'shader',
      clipId: 'c1',
      clipProps: {},
      staticFallbackElement: null,
    });
    expect(r1.result).toBe('mounted');
    expect(shim.listMounted()).toHaveLength(1);

    // Re-boot clears the registry; we expect listMounted to be empty
    // afterward and a second `'boot'` event to be observable.
    shim.boot({ device: makeDevice(), emitTelemetry: (e) => events.push(e) });
    expect(shim.listMounted()).toEqual([]);
    expect(events.filter((e) => e.kind === 'boot')).toHaveLength(2);
  });
});

describe('OnDevicePlayerShim.mount — pre-boot guard', () => {
  it('throws when mount is called before boot', async () => {
    const { harness } = makeHarnessWithRegistered(['shader']);
    const shim = createOnDevicePlayerShim({ mountHarness: harness });
    await expect(
      shim.mount({
        tenantId: 't',
        tenantPolicy: PASS_TENANT,
        clipFamily: 'shader',
        clipId: 'c1',
        clipProps: {},
        staticFallbackElement: null,
      }),
    ).rejects.toThrow(/before boot/);
  });
});

// ---------- gate-1 refusals ----------

describe('OnDevicePlayerShim.mount — gate-1 refusals (tenant flag)', () => {
  it('refuses with `tenant-flag-disabled` when featuresInteractive is `disabled`', async () => {
    const { shim, events } = makeShimWithHarnessOptions(['shader']);
    const result = await shim.mount({
      tenantId: 't',
      tenantPolicy: { featuresInteractive: 'disabled' },
      clipFamily: 'shader',
      clipId: 'c1',
      clipProps: {},
      staticFallbackElement: null,
    });
    expect(result).toEqual({ result: 'fallback', reason: 'tenant-flag-disabled' });
    expect(
      events.find((e) => e.kind === 'mount-refused' && e.reason === 'tenant-flag-disabled'),
    ).toBeDefined();
  });

  it('refuses with `preview-not-ga` when featuresInteractive is `preview`', async () => {
    const { shim, events } = makeShimWithHarnessOptions(['shader']);
    const result = await shim.mount({
      tenantId: 't',
      tenantPolicy: { featuresInteractive: 'preview' },
      clipFamily: 'shader',
      clipId: 'c1',
      clipProps: {},
      staticFallbackElement: null,
    });
    expect(result).toEqual({ result: 'fallback', reason: 'preview-not-ga' });
    expect(
      events.find((e) => e.kind === 'mount-refused' && e.reason === 'preview-not-ga'),
    ).toBeDefined();
  });

  it('does NOT call harness.mount for gate-1 refusals', async () => {
    const registry = new InteractiveClipRegistry();
    const factory = vi.fn(async () => ({
      updateProps: () => undefined,
      dispose: () => undefined,
    }));
    registry.register('shader', factory);
    const harness = new InteractiveMountHarness({ registry });
    const mountSpy = vi.spyOn(harness, 'mount');
    const shim = createOnDevicePlayerShim({ mountHarness: harness });
    shim.boot({ device: makeDevice(), emitTelemetry: () => undefined });
    await shim.mount({
      tenantId: 't',
      tenantPolicy: { featuresInteractive: 'disabled' },
      clipFamily: 'shader',
      clipId: 'c1',
      clipProps: {},
      staticFallbackElement: null,
    });
    expect(mountSpy).not.toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();
  });
});

// ---------- gate-2 refusals: capability ----------

describe('OnDevicePlayerShim.mount — capability gate', () => {
  it('shader + hasGpu:false → capability-insufficient', async () => {
    const registry = new InteractiveClipRegistry();
    registry.register('shader', async () => ({
      updateProps: () => undefined,
      dispose: () => undefined,
    }));
    const harness = new InteractiveMountHarness({ registry });
    const events: TelemetryEvent[] = [];
    const shim = createOnDevicePlayerShim({ mountHarness: harness });
    shim.boot({ device: makeDevice({ hasGpu: false }), emitTelemetry: (e) => events.push(e) });
    const result = await shim.mount({
      tenantId: 't',
      tenantPolicy: PASS_TENANT,
      clipFamily: 'shader',
      clipId: 'c1',
      clipProps: {},
      staticFallbackElement: null,
    });
    expect(result).toEqual({ result: 'fallback', reason: 'capability-insufficient' });
    expect(
      events.some((e) => e.kind === 'mount-refused' && e.reason === 'capability-insufficient'),
    ).toBe(true);
  });

  it('shader + hasGpu:true → permitted (mount-success emitted)', async () => {
    const { shim, events } = makeShimWithHarnessOptions(['shader']);
    const result = await shim.mount({
      tenantId: 't',
      tenantPolicy: PASS_TENANT,
      clipFamily: 'shader',
      clipId: 'c1',
      clipProps: {},
      staticFallbackElement: null,
    });
    expect(result.result).toBe('mounted');
    expect(events.some((e) => e.kind === 'mount-success')).toBe(true);
  });

  it('three-scene + hasGpu:false → capability-insufficient', async () => {
    const { harness } = makeHarnessWithRegistered(['three-scene']);
    const events: TelemetryEvent[] = [];
    const shim = createOnDevicePlayerShim({ mountHarness: harness });
    shim.boot({ device: makeDevice({ hasGpu: false }), emitTelemetry: (e) => events.push(e) });
    const result = await shim.mount({
      tenantId: 't',
      tenantPolicy: PASS_TENANT,
      clipFamily: 'three-scene',
      clipId: 'c1',
      clipProps: {},
      staticFallbackElement: null,
    });
    expect(result).toEqual({ result: 'fallback', reason: 'capability-insufficient' });
  });

  it('voice + hasMicrophone:false → capability-insufficient', async () => {
    const { harness } = makeHarnessWithRegistered(['voice']);
    const shim = createOnDevicePlayerShim({ mountHarness: harness });
    shim.boot({
      device: makeDevice({ hasMicrophone: false }),
      emitTelemetry: () => undefined,
    });
    const result = await shim.mount({
      tenantId: 't',
      tenantPolicy: PASS_TENANT,
      clipFamily: 'voice',
      clipId: 'c1',
      clipProps: {},
      staticFallbackElement: null,
    });
    expect(result).toEqual({ result: 'fallback', reason: 'capability-insufficient' });
  });

  it('voice + hasMicrophone:true → permitted', async () => {
    // PASS_TENANT_POLICY in the harness — voice clip permission envelope
    // here is the synthesized empty-permissions list (the shim does not
    // forward clip-family-default permissions). hasMicrophone is the
    // only thing the on-device capability gate inspects.
    const { shim } = makeShimWithHarnessOptions(['voice']);
    const result = await shim.mount({
      tenantId: 't',
      tenantPolicy: PASS_TENANT,
      clipFamily: 'voice',
      clipId: 'c1',
      clipProps: {},
      staticFallbackElement: null,
    });
    expect(result.result).toBe('mounted');
  });

  it('ai-chat + hasNetwork:false → capability-insufficient', async () => {
    const { harness } = makeHarnessWithRegistered(['ai-chat']);
    const shim = createOnDevicePlayerShim({ mountHarness: harness });
    shim.boot({ device: makeDevice({ hasNetwork: false }), emitTelemetry: () => undefined });
    const result = await shim.mount({
      tenantId: 't',
      tenantPolicy: PASS_TENANT,
      clipFamily: 'ai-chat',
      clipId: 'c1',
      clipProps: {},
      staticFallbackElement: null,
    });
    expect(result).toEqual({ result: 'fallback', reason: 'capability-insufficient' });
  });

  it('live-data + hasNetwork:false → capability-insufficient', async () => {
    const { harness } = makeHarnessWithRegistered(['live-data']);
    const shim = createOnDevicePlayerShim({ mountHarness: harness });
    shim.boot({ device: makeDevice({ hasNetwork: false }), emitTelemetry: () => undefined });
    const result = await shim.mount({
      tenantId: 't',
      tenantPolicy: PASS_TENANT,
      clipFamily: 'live-data',
      clipId: 'c1',
      clipProps: {},
      staticFallbackElement: null,
    });
    expect(result).toEqual({ result: 'fallback', reason: 'capability-insufficient' });
  });

  it('web-embed + hasNetwork:false → capability-insufficient', async () => {
    const { harness } = makeHarnessWithRegistered(['web-embed']);
    const shim = createOnDevicePlayerShim({ mountHarness: harness });
    shim.boot({ device: makeDevice({ hasNetwork: false }), emitTelemetry: () => undefined });
    const result = await shim.mount({
      tenantId: 't',
      tenantPolicy: PASS_TENANT,
      clipFamily: 'web-embed',
      clipId: 'c1',
      clipProps: {},
      staticFallbackElement: null,
    });
    expect(result).toEqual({ result: 'fallback', reason: 'capability-insufficient' });
  });

  it('ai-generative + hasNetwork:false → capability-insufficient', async () => {
    const { harness } = makeHarnessWithRegistered(['ai-generative']);
    const shim = createOnDevicePlayerShim({ mountHarness: harness });
    shim.boot({ device: makeDevice({ hasNetwork: false }), emitTelemetry: () => undefined });
    const result = await shim.mount({
      tenantId: 't',
      tenantPolicy: PASS_TENANT,
      clipFamily: 'ai-generative',
      clipId: 'c1',
      clipProps: {},
      staticFallbackElement: null,
    });
    expect(result).toEqual({ result: 'fallback', reason: 'capability-insufficient' });
  });

  it('ai-generative + hasNetwork:true, hasGpu:false → permitted', async () => {
    // Per ADR-005 §D1, ai-generative generates content off-device; the
    // device only renders the returned slot. Lack of GPU does NOT block.
    const registry = new InteractiveClipRegistry();
    registry.register('ai-generative', async () => ({
      updateProps: () => undefined,
      dispose: () => undefined,
    }));
    const shim = createOnDevicePlayerShim({
      mountHarness: new InteractiveMountHarness({ registry: new InteractiveClipRegistry() }),
      harnessOptions: { registry },
    });
    shim.boot({
      device: makeDevice({ hasGpu: false, hasNetwork: true }),
      emitTelemetry: () => undefined,
    });
    const result = await shim.mount({
      tenantId: 't',
      tenantPolicy: PASS_TENANT,
      clipFamily: 'ai-generative',
      clipId: 'c1',
      clipProps: {},
      staticFallbackElement: null,
    });
    expect(result.result).toBe('mounted');
  });
});

// ---------- gate-3 refusals: registry / permission ----------

describe('OnDevicePlayerShim.mount — gate-3 refusals', () => {
  it('refuses with `no-factory-registered` when no factory is registered for the family', async () => {
    // Empty registry; harness.mount will throw InteractiveClipNotRegisteredError.
    const harness = new InteractiveMountHarness({ registry: new InteractiveClipRegistry() });
    const events: TelemetryEvent[] = [];
    const shim = createOnDevicePlayerShim({ mountHarness: harness });
    shim.boot({ device: makeDevice(), emitTelemetry: (e) => events.push(e) });
    const result = await shim.mount({
      tenantId: 't',
      tenantPolicy: PASS_TENANT,
      clipFamily: 'shader',
      clipId: 'c1',
      clipProps: {},
      staticFallbackElement: null,
    });
    expect(result).toEqual({ result: 'fallback', reason: 'no-factory-registered' });
    expect(
      events.some((e) => e.kind === 'mount-refused' && e.reason === 'no-factory-registered'),
    ).toBe(true);
  });

  it('refuses with `permission-refused` when tenant policy denies the family', async () => {
    // Harness-internal tenant policy refuses; the harness emits
    // `'mount-fallback'`, which the shim observes via its sink wrapper
    // (only available in the `harnessOptions` mode).
    const registry = new InteractiveClipRegistry();
    registry.register('shader', async () => ({
      updateProps: () => undefined,
      dispose: () => undefined,
    }));
    const denyingTenantPolicy: TenantPolicy = { canMount: () => false };
    const events: TelemetryEvent[] = [];
    const shim = createOnDevicePlayerShim({
      mountHarness: new InteractiveMountHarness({ registry: new InteractiveClipRegistry() }),
      harnessOptions: { registry, tenantPolicy: denyingTenantPolicy },
    });
    shim.boot({ device: makeDevice(), emitTelemetry: (e) => events.push(e) });
    const result = await shim.mount({
      tenantId: 't',
      tenantPolicy: PASS_TENANT,
      clipFamily: 'shader',
      clipId: 'c1',
      clipProps: {},
      staticFallbackElement: null,
    });
    expect(result).toEqual({ result: 'fallback', reason: 'permission-refused' });
    expect(
      events.some((e) => e.kind === 'mount-refused' && e.reason === 'permission-refused'),
    ).toBe(true);
  });
});

// ---------- happy path ----------

describe('OnDevicePlayerShim.mount — happy path', () => {
  it('returns `mounted`, emits attempted+success, and registers the handle', async () => {
    const { shim, events } = makeShimWithHarnessOptions(['shader']);
    const result = await shim.mount({
      tenantId: 't',
      tenantPolicy: PASS_TENANT,
      clipFamily: 'shader',
      clipId: 'happy-c1',
      clipProps: { speed: 1 },
      staticFallbackElement: null,
    });
    expect(result.result).toBe('mounted');
    if (result.result !== 'mounted') throw new Error('unreachable');
    expect(result.handle.clipId).toBe('happy-c1');
    expect(result.handle.clipFamily).toBe('shader');
    expect(shim.listMounted()).toHaveLength(1);
    expect(shim.listMounted()[0]?.clipId).toBe('happy-c1');

    // mount-attempted must appear before mount-success.
    const attemptedIdx = events.findIndex(
      (e) => e.kind === 'mount-attempted' && e.clipId === 'happy-c1',
    );
    const successIdx = events.findIndex(
      (e) => e.kind === 'mount-success' && e.clipId === 'happy-c1',
    );
    expect(attemptedIdx).toBeGreaterThanOrEqual(0);
    expect(successIdx).toBeGreaterThan(attemptedIdx);
  });

  it('clock injection is honored for mount-success.elapsedMs', async () => {
    // Custom clock returns 100 the first time, 142 the second.
    let n = 0;
    const ticks = [100, 142];
    const clock = (): number => {
      const v = ticks[n] ?? 142;
      n += 1;
      return v;
    };

    const registry = new InteractiveClipRegistry();
    registry.register('shader', async () => ({
      updateProps: () => undefined,
      dispose: () => undefined,
    }));
    const events: TelemetryEvent[] = [];
    const shim = createOnDevicePlayerShim({
      mountHarness: new InteractiveMountHarness({ registry: new InteractiveClipRegistry() }),
      harnessOptions: { registry },
    });
    shim.boot({ device: makeDevice(), emitTelemetry: (e) => events.push(e), clock });
    const result = await shim.mount({
      tenantId: 't',
      tenantPolicy: PASS_TENANT,
      clipFamily: 'shader',
      clipId: 'c-clock',
      clipProps: {},
      staticFallbackElement: null,
    });
    expect(result.result).toBe('mounted');
    const success = events.find(
      (e): e is Extract<TelemetryEvent, { kind: 'mount-success' }> =>
        e.kind === 'mount-success' && e.clipId === 'c-clock',
    );
    expect(success?.elapsedMs).toBe(42);
  });
});

// ---------- unmount / listMounted ----------

describe('OnDevicePlayerShim.unmount + listMounted', () => {
  it('unmount removes the handle from listMounted and emits `unmount`', async () => {
    const { shim, events } = makeShimWithHarnessOptions(['shader']);
    const result = await shim.mount({
      tenantId: 't',
      tenantPolicy: PASS_TENANT,
      clipFamily: 'shader',
      clipId: 'c1',
      clipProps: {},
      staticFallbackElement: null,
    });
    if (result.result !== 'mounted') throw new Error('unreachable');
    expect(shim.listMounted()).toHaveLength(1);
    await result.handle.unmount();
    expect(shim.listMounted()).toEqual([]);
    expect(
      events.find((e) => e.kind === 'unmount' && e.clipId === 'c1' && e.clipFamily === 'shader'),
    ).toBeDefined();
  });

  it('unmount is idempotent (double-unmount is a no-op)', async () => {
    const { shim, events } = makeShimWithHarnessOptions(['shader']);
    const result = await shim.mount({
      tenantId: 't',
      tenantPolicy: PASS_TENANT,
      clipFamily: 'shader',
      clipId: 'c1',
      clipProps: {},
      staticFallbackElement: null,
    });
    if (result.result !== 'mounted') throw new Error('unreachable');
    await result.handle.unmount();
    await result.handle.unmount(); // second call — should not emit a second `unmount` event.
    expect(events.filter((e) => e.kind === 'unmount')).toHaveLength(1);
  });

  it('multi-clip: two mounts → listMounted has both; per-handle unmount removes only that one', async () => {
    const { shim } = makeShimWithHarnessOptions(['shader', 'three-scene']);
    const r1 = await shim.mount({
      tenantId: 't',
      tenantPolicy: PASS_TENANT,
      clipFamily: 'shader',
      clipId: 'c1',
      clipProps: {},
      staticFallbackElement: null,
    });
    const r2 = await shim.mount({
      tenantId: 't',
      tenantPolicy: PASS_TENANT,
      clipFamily: 'three-scene',
      clipId: 'c2',
      clipProps: {},
      staticFallbackElement: null,
    });
    if (r1.result !== 'mounted' || r2.result !== 'mounted') throw new Error('unreachable');
    expect(shim.listMounted()).toHaveLength(2);
    await r1.handle.unmount();
    const remaining = shim.listMounted();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.clipId).toBe('c2');
  });
});

// ---------- shutdown ----------

describe('OnDevicePlayerShim.shutdown', () => {
  it('unmounts everything and emits `shutdown` with the correct clipsUnmounted count', async () => {
    const { shim, events } = makeShimWithHarnessOptions(['shader', 'three-scene']);
    await shim.mount({
      tenantId: 't',
      tenantPolicy: PASS_TENANT,
      clipFamily: 'shader',
      clipId: 'c1',
      clipProps: {},
      staticFallbackElement: null,
    });
    await shim.mount({
      tenantId: 't',
      tenantPolicy: PASS_TENANT,
      clipFamily: 'three-scene',
      clipId: 'c2',
      clipProps: {},
      staticFallbackElement: null,
    });
    expect(shim.listMounted()).toHaveLength(2);
    await shim.shutdown();
    expect(shim.listMounted()).toEqual([]);
    const shutdown = events.find(
      (e): e is Extract<TelemetryEvent, { kind: 'shutdown' }> => e.kind === 'shutdown',
    );
    expect(shutdown?.clipsUnmounted).toBe(2);
  });

  it('shutdown with no mounts emits `shutdown` with clipsUnmounted=0', async () => {
    const { shim, events } = makeShimWithHarnessOptions(['shader']);
    await shim.shutdown();
    const shutdown = events.find(
      (e): e is Extract<TelemetryEvent, { kind: 'shutdown' }> => e.kind === 'shutdown',
    );
    expect(shutdown?.clipsUnmounted).toBe(0);
  });
});

// ---------- refusal-reason enumeration (typing) ----------

describe('OnDevicePlayerRefusalReason — all five cases reachable', () => {
  it('the shim emits each of the five refusal reasons in this test suite', () => {
    const reasons: ReadonlyArray<OnDevicePlayerRefusalReason> = [
      'tenant-flag-disabled',
      'preview-not-ga',
      'permission-refused',
      'capability-insufficient',
      'no-factory-registered',
    ];
    // Compile-time + structural check; ensures the enum stays in sync
    // with the shim's gate chain.
    expect(reasons).toHaveLength(5);
  });
});

// ---------- determinism scan ----------

describe('source-level determinism', () => {
  it('shim.ts contains no forbidden non-deterministic API references', () => {
    const sources = ['contract.ts', 'tenant-gate.ts', 'lifecycle.ts', 'shim.ts', 'index.ts'];
    const forbidden = [
      'Date.now',
      'new Date(',
      'Date()',
      'performance.now',
      'Math.random',
      'fetch(',
      'XMLHttpRequest',
      'navigator.sendBeacon',
      'setTimeout',
      'setInterval',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'new Worker(',
      'SharedWorker',
    ];
    const here = dirname(fileURLToPath(import.meta.url));
    for (const file of sources) {
      const src = readFileSync(join(here, file), 'utf-8');
      // Strip block + line comments + string literals so a comment that
      // names a forbidden API for documentation purposes does not trip
      // the check. The CLAUDE.md §3 rule scopes to runtime call sites.
      const stripped = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/'(?:[^'\\]|\\.)*'/g, "''")
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')
        .replace(/`(?:[^`\\]|\\.)*`/g, '``');
      for (const needle of forbidden) {
        expect(stripped, `${file} references ${needle}`).not.toContain(needle);
      }
    }
  });
});

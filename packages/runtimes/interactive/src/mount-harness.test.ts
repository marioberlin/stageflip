// packages/runtimes/interactive/src/mount-harness.test.ts
// T-306 AC #15–#18 — InteractiveMountHarness orchestration. AC #15 is the
// security-critical sequence (tenant → permission → registry → factory).
//
// T-388a — harness dispatches static-path generators via the
// `StaticFallbackGeneratorRegistry`; the family-hardcoded
// `if (clip.family !== 'voice')` literal is gone (AC #11 grep assertion).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { makeInteractiveClip, makeStubFactory } from './contract-tests/fixtures.js';
import type { ClipFactory } from './contract.js';
import { InteractiveClipNotRegisteredError, InteractiveMountHarness } from './mount-harness.js';
import { PermissionShim } from './permission-shim.js';
import { InteractiveClipRegistry } from './registry.js';
import {
  type StaticFallbackGenerator,
  StaticFallbackGeneratorRegistry,
} from './static-fallback-registry.js';

function makeFakeStream(): MediaStream {
  return { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
}

describe('InteractiveMountHarness', () => {
  it('AC #15 — mount calls permission shim, then resolves factory, then invokes it', async () => {
    const order: string[] = [];
    const registry = new InteractiveClipRegistry();
    const factory: ClipFactory = async () => {
      order.push('factory');
      return { updateProps: () => undefined, dispose: () => undefined };
    };
    registry.register('shader', factory);

    const stream = makeFakeStream();
    const permissionShim = new PermissionShim({
      browser: {
        getUserMedia: async (constraints) => {
          order.push(`getUserMedia:${constraints.audio ? 'mic' : 'camera'}`);
          return stream;
        },
      },
      tenantPolicy: {
        canMount: (family) => {
          order.push(`tenant:${family}`);
          return true;
        },
      },
    });
    const harness = new InteractiveMountHarness({ registry, permissionShim });

    await harness.mount(
      makeInteractiveClip({ permissions: ['mic'] }),
      document.createElement('div'),
      new AbortController().signal,
    );

    expect(order).toEqual(['tenant:shader', 'getUserMedia:mic', 'factory']);
  });

  it('AC #15 — granted permissions appear in MountContext', async () => {
    const registry = new InteractiveClipRegistry();
    let observed: ReadonlyArray<string> = [];
    registry.register('shader', async (ctx) => {
      observed = [...ctx.permissions];
      return { updateProps: () => undefined, dispose: () => undefined };
    });
    const harness = new InteractiveMountHarness({ registry });
    await harness.mount(
      makeInteractiveClip({ permissions: ['network'] }),
      document.createElement('div'),
      new AbortController().signal,
    );
    expect(observed).toEqual(['network']);
  });

  it('AC #15 — permission denial routes to static fallback (factory not invoked)', async () => {
    const registry = new InteractiveClipRegistry();
    const factory = vi.fn(makeStubFactory());
    registry.register('shader', factory);
    const permissionShim = new PermissionShim({
      browser: {
        getUserMedia: async () => {
          throw new DOMException('Denied');
        },
      },
    });
    const harness = new InteractiveMountHarness({ registry, permissionShim });
    const root = document.createElement('div');
    const handle = await harness.mount(
      makeInteractiveClip({ permissions: ['mic'] }),
      root,
      new AbortController().signal,
    );
    expect(factory).not.toHaveBeenCalled();
    expect(typeof handle.dispose).toBe('function');
    // Static-path updateProps is a no-op
    expect(() => handle.updateProps({ x: 1 })).not.toThrow();
    handle.dispose();
  });

  it('AC #15 — tenant-denied routes to static fallback (no permission prompt)', async () => {
    const registry = new InteractiveClipRegistry();
    const factory = vi.fn(makeStubFactory());
    registry.register('shader', factory);
    const getUserMedia = vi.fn();
    const permissionShim = new PermissionShim({
      browser: { getUserMedia },
      tenantPolicy: { canMount: () => false },
    });
    const harness = new InteractiveMountHarness({ registry, permissionShim });
    await harness.mount(
      makeInteractiveClip({ permissions: ['mic'] }),
      document.createElement('div'),
      new AbortController().signal,
    );
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();
  });

  it('AC #16 — unregistered family throws InteractiveClipNotRegisteredError', async () => {
    const registry = new InteractiveClipRegistry();
    const harness = new InteractiveMountHarness({ registry });
    await expect(
      harness.mount(
        makeInteractiveClip(),
        document.createElement('div'),
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(InteractiveClipNotRegisteredError);
  });

  it('AC #17 — signal.abort triggers dispose', async () => {
    const onDispose = vi.fn();
    const registry = new InteractiveClipRegistry();
    registry.register('shader', makeStubFactory({ onDispose }));
    const harness = new InteractiveMountHarness({ registry });
    const controller = new AbortController();
    await harness.mount(makeInteractiveClip(), document.createElement('div'), controller.signal);
    expect(onDispose).not.toHaveBeenCalled();
    controller.abort();
    expect(onDispose).toHaveBeenCalledTimes(1);
  });

  it('AC #17 — already-aborted signal disposes immediately', async () => {
    const onDispose = vi.fn();
    const registry = new InteractiveClipRegistry();
    registry.register('shader', makeStubFactory({ onDispose }));
    const harness = new InteractiveMountHarness({ registry });
    const controller = new AbortController();
    controller.abort();
    await harness.mount(makeInteractiveClip(), document.createElement('div'), controller.signal);
    expect(onDispose).toHaveBeenCalledTimes(1);
  });

  it('AC #18 — dispose() is idempotent', async () => {
    const onDispose = vi.fn();
    const registry = new InteractiveClipRegistry();
    registry.register('shader', makeStubFactory({ onDispose }));
    const harness = new InteractiveMountHarness({ registry });
    const controller = new AbortController();
    const handle = await harness.mount(
      makeInteractiveClip(),
      document.createElement('div'),
      controller.signal,
    );
    handle.dispose();
    handle.dispose();
    expect(onDispose).toHaveBeenCalledTimes(1);
  });

  it('AC #18 — abort + manual dispose still single-fire', async () => {
    const onDispose = vi.fn();
    const registry = new InteractiveClipRegistry();
    registry.register('shader', makeStubFactory({ onDispose }));
    const harness = new InteractiveMountHarness({ registry });
    const controller = new AbortController();
    const handle = await harness.mount(
      makeInteractiveClip(),
      document.createElement('div'),
      controller.signal,
    );
    controller.abort();
    handle.dispose();
    expect(onDispose).toHaveBeenCalledTimes(1);
  });

  it('updateProps is forwarded to the factory handle', async () => {
    const onUpdateProps = vi.fn();
    const registry = new InteractiveClipRegistry();
    registry.register('shader', makeStubFactory({ onUpdateProps }));
    const harness = new InteractiveMountHarness({ registry });
    const handle = await harness.mount(
      makeInteractiveClip(),
      document.createElement('div'),
      new AbortController().signal,
    );
    handle.updateProps({ foo: 1 });
    expect(onUpdateProps).toHaveBeenCalledWith({ foo: 1 });
  });

  it('emitTelemetry fires mount-fallback on denial', async () => {
    const emitTelemetry = vi.fn();
    const registry = new InteractiveClipRegistry();
    registry.register('shader', makeStubFactory());
    const permissionShim = new PermissionShim({
      browser: {
        getUserMedia: async () => {
          throw new DOMException('Denied');
        },
      },
    });
    const harness = new InteractiveMountHarness({
      registry,
      permissionShim,
      emitTelemetry,
    });
    await harness.mount(
      makeInteractiveClip({ permissions: ['mic'] }),
      document.createElement('div'),
      new AbortController().signal,
    );
    expect(emitTelemetry).toHaveBeenCalledWith('mount-fallback', {
      family: 'shader',
      reason: 'permission-denied',
    });
  });

  it('static-fallback path: dispose unmounts the React tree', async () => {
    const registry = new InteractiveClipRegistry();
    registry.register('shader', makeStubFactory());
    const permissionShim = new PermissionShim({
      browser: {
        getUserMedia: async () => {
          throw new DOMException('Denied');
        },
      },
    });
    const harness = new InteractiveMountHarness({ registry, permissionShim });
    const root = document.createElement('div');
    const handle = await harness.mount(
      makeInteractiveClip({ permissions: ['mic'] }),
      root,
      new AbortController().signal,
    );
    handle.dispose();
    handle.dispose(); // idempotent
  });

  it('static-fallback path: aborted signal disposes the React tree', async () => {
    const registry = new InteractiveClipRegistry();
    registry.register('shader', makeStubFactory());
    const permissionShim = new PermissionShim({
      browser: {
        getUserMedia: async () => {
          throw new DOMException('Denied');
        },
      },
    });
    const harness = new InteractiveMountHarness({ registry, permissionShim });
    const root = document.createElement('div');
    const controller = new AbortController();
    await harness.mount(makeInteractiveClip({ permissions: ['mic'] }), root, controller.signal);
    controller.abort();
  });

  it('T-385 AC #8 — undefined permissionPrePrompt matches T-306 baseline (no handler invoked)', async () => {
    const handler = vi.fn();
    const registry = new InteractiveClipRegistry();
    registry.register('shader', makeStubFactory());
    const harness = new InteractiveMountHarness({
      registry,
      permissionPrePromptHandler: handler,
    });
    await harness.mount(
      makeInteractiveClip({ permissions: ['network'] }),
      document.createElement('div'),
      new AbortController().signal,
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it('T-385 AC #9 — permissionPrePrompt:true confirm proceeds to factory', async () => {
    const stream = makeFakeStream();
    const handler = vi.fn(async () => 'confirm' as const);
    const registry = new InteractiveClipRegistry();
    const factory = vi.fn(makeStubFactory());
    registry.register('shader', factory);
    const permissionShim = new PermissionShim({
      browser: { getUserMedia: async () => stream },
    });
    const harness = new InteractiveMountHarness({
      registry,
      permissionShim,
      permissionPrePromptHandler: handler,
    });
    await harness.mount(
      makeInteractiveClip({ permissions: ['mic'] }),
      document.createElement('div'),
      new AbortController().signal,
      { permissionPrePrompt: true },
    );
    expect(handler).toHaveBeenCalledWith({ family: 'shader', permission: 'mic' });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('T-385 AC #9 — permissionPrePrompt:true cancel routes to static fallback (factory NOT invoked)', async () => {
    const handler = vi.fn(async () => 'cancel' as const);
    const getUserMedia = vi.fn();
    const registry = new InteractiveClipRegistry();
    const factory = vi.fn(makeStubFactory());
    registry.register('shader', factory);
    const permissionShim = new PermissionShim({ browser: { getUserMedia } });
    const harness = new InteractiveMountHarness({
      registry,
      permissionShim,
      permissionPrePromptHandler: handler,
    });
    const handle = await harness.mount(
      makeInteractiveClip({ permissions: ['mic'] }),
      document.createElement('div'),
      new AbortController().signal,
      { permissionPrePrompt: true },
    );
    expect(handler).toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();
    expect(typeof handle.dispose).toBe('function');
  });

  it('T-385 AC #9 — pre-prompt cancel emits mount-fallback with reason pre-prompt-cancelled', async () => {
    const emitTelemetry = vi.fn();
    const handler = vi.fn(async () => 'cancel' as const);
    const registry = new InteractiveClipRegistry();
    registry.register('shader', makeStubFactory());
    const harness = new InteractiveMountHarness({
      registry,
      emitTelemetry,
      permissionPrePromptHandler: handler,
    });
    await harness.mount(
      makeInteractiveClip({ permissions: ['mic'] }),
      document.createElement('div'),
      new AbortController().signal,
      { permissionPrePrompt: true },
    );
    expect(emitTelemetry).toHaveBeenCalledWith('mount-fallback', {
      family: 'shader',
      reason: 'pre-prompt-cancelled',
    });
  });

  it('T-385 — permissionPrePrompt:true with no permissions skips the handler', async () => {
    const handler = vi.fn();
    const registry = new InteractiveClipRegistry();
    registry.register('shader', makeStubFactory());
    const harness = new InteractiveMountHarness({
      registry,
      permissionPrePromptHandler: handler,
    });
    await harness.mount(
      makeInteractiveClip({ permissions: [] }),
      document.createElement('div'),
      new AbortController().signal,
      { permissionPrePrompt: true },
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it('T-385 — permissionPrePrompt:true without a handler falls back to T-306 baseline', async () => {
    const stream = makeFakeStream();
    const registry = new InteractiveClipRegistry();
    const factory = vi.fn(makeStubFactory());
    registry.register('shader', factory);
    const permissionShim = new PermissionShim({
      browser: { getUserMedia: async () => stream },
    });
    const harness = new InteractiveMountHarness({ registry, permissionShim });
    await harness.mount(
      makeInteractiveClip({ permissions: ['mic'] }),
      document.createElement('div'),
      new AbortController().signal,
      { permissionPrePrompt: true },
    );
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('T-385 — permissionPrePrompt forwards to MountContext when set', async () => {
    let observedFlag: boolean | undefined;
    const stream = makeFakeStream();
    const registry = new InteractiveClipRegistry();
    registry.register('shader', async (ctx) => {
      observedFlag = ctx.permissionPrePrompt;
      return { updateProps: () => undefined, dispose: () => undefined };
    });
    const permissionShim = new PermissionShim({
      browser: { getUserMedia: async () => stream },
    });
    const handler = vi.fn(async () => 'confirm' as const);
    const harness = new InteractiveMountHarness({
      registry,
      permissionShim,
      permissionPrePromptHandler: handler,
    });
    await harness.mount(
      makeInteractiveClip({ permissions: ['mic'] }),
      document.createElement('div'),
      new AbortController().signal,
      { permissionPrePrompt: true },
    );
    expect(observedFlag).toBe(true);
  });

  // ---------- T-388a — static-fallback generator registry ----------

  it('T-388a AC #8 — voice generator registered + empty staticFallback → generator output rendered with routing reason', async () => {
    const registry = new InteractiveClipRegistry();
    registry.register('voice', makeStubFactory());
    const generatorRegistry = new StaticFallbackGeneratorRegistry();
    const calls: Array<{ reason: string; family: string }> = [];
    const generator: StaticFallbackGenerator = ({ clip, reason, emitTelemetry }) => {
      calls.push({ reason, family: clip.family });
      emitTelemetry('voice-clip.static-fallback.rendered', {
        family: clip.family,
        reason,
      });
      return [];
    };
    generatorRegistry.register('voice', generator);
    const events: Array<[string, Record<string, unknown>]> = [];
    const denyingShim = new PermissionShim({
      browser: {
        getUserMedia: async () => {
          throw new DOMException('Denied');
        },
      },
    });
    const harness = new InteractiveMountHarness({
      registry,
      staticFallbackGeneratorRegistry: generatorRegistry,
      permissionShim: denyingShim,
      emitTelemetry: (e, a) => events.push([e, a]),
    });
    const clip = makeInteractiveClip({ family: 'voice', permissions: ['mic'] });
    (clip as unknown as { staticFallback: unknown[] }).staticFallback = [];
    await harness.mount(clip, document.createElement('div'), new AbortController().signal);
    expect(calls).toEqual([{ reason: 'permission-denied', family: 'voice' }]);
    const rendered = events.find((e) => e[0] === 'voice-clip.static-fallback.rendered');
    expect(rendered?.[1]).toMatchObject({ reason: 'permission-denied', family: 'voice' });
  });

  it('T-388a AC #9 / D-T388a-3 — authored staticFallback wins AND generator is still called with reason: authored', async () => {
    const registry = new InteractiveClipRegistry();
    registry.register('voice', makeStubFactory());
    const generatorRegistry = new StaticFallbackGeneratorRegistry();
    const calls: string[] = [];
    const generator: StaticFallbackGenerator = ({ reason, emitTelemetry }) => {
      calls.push(reason);
      // The generator's RETURN is ignored on the authored path; emit
      // telemetry to prove the generator ran.
      emitTelemetry('voice-clip.static-fallback.rendered', { reason });
      // Return a sentinel that, if it leaked into rendering, would be
      // observable; AC #9 pins that it does NOT leak.
      return [
        {
          id: 'sentinel-from-generator',
          type: 'text',
          transform: { x: 0, y: 0, width: 1, height: 1, rotation: 0, opacity: 1 },
          visible: true,
          locked: false,
          animations: [],
          text: 'should-not-render',
        },
      ] as never;
    };
    generatorRegistry.register('voice', generator);
    const events: Array<[string, Record<string, unknown>]> = [];
    const denyingShim = new PermissionShim({
      browser: {
        getUserMedia: async () => {
          throw new DOMException('Denied');
        },
      },
    });
    const harness = new InteractiveMountHarness({
      registry,
      staticFallbackGeneratorRegistry: generatorRegistry,
      permissionShim: denyingShim,
      emitTelemetry: (e, a) => events.push([e, a]),
    });
    const root = document.createElement('div');
    // makeInteractiveClip ships an authored staticFallback (single text
    // 'Static fallback'). The harness MUST use it verbatim while still
    // invoking the generator with reason 'authored'.
    await harness.mount(
      makeInteractiveClip({ family: 'voice', permissions: ['mic'] }),
      root,
      new AbortController().signal,
    );
    expect(calls).toEqual(['authored']);
    const rendered = events.find((e) => e[0] === 'voice-clip.static-fallback.rendered');
    expect(rendered?.[1]).toMatchObject({ reason: 'authored' });
    // Authored array's text — NOT the sentinel — was rendered.
    const span = root.querySelector('span[data-stageflip-fallback="text"]');
    expect(span?.textContent).toBe('Static fallback');
  });

  it('T-388a AC #10 — family with no generator registered + empty staticFallback returns empty array (no throw)', async () => {
    const registry = new InteractiveClipRegistry();
    registry.register('ai-chat', makeStubFactory());
    const generatorRegistry = new StaticFallbackGeneratorRegistry();
    // Intentionally do NOT register an ai-chat generator.
    const denyingShim = new PermissionShim({
      tenantPolicy: { canMount: () => false },
      browser: {
        getUserMedia: async () => {
          throw new DOMException('should-not-be-called');
        },
      },
    });
    const harness = new InteractiveMountHarness({
      registry,
      staticFallbackGeneratorRegistry: generatorRegistry,
      permissionShim: denyingShim,
    });
    const root = document.createElement('div');
    const clip = makeInteractiveClip({ family: 'ai-chat' });
    (clip as unknown as { staticFallback: unknown[] }).staticFallback = [];
    // Tenant-deny → static path. No generator + empty array → no throw,
    // empty render.
    const handle = await harness.mount(clip, root, new AbortController().signal);
    expect(typeof handle.dispose).toBe('function');
    handle.dispose();
  });

  it("T-388a AC #11 — mount-harness.ts source no longer contains the literal `clip.family !== 'voice'`", () => {
    // Anchor on the package's working directory rather than
    // `import.meta.url` — happy-dom does not expose a file:// URL.
    // `pnpm --filter @stageflip/runtimes-interactive test` runs from the
    // package root.
    const sourcePath = resolve(process.cwd(), 'src/mount-harness.ts');
    const source = readFileSync(sourcePath, 'utf8');
    expect(source.includes("clip.family !== 'voice'")).toBe(false);
    // Doubly guard against double-quoted variant.
    expect(source.includes('clip.family !== "voice"')).toBe(false);
  });

  it('static-fallback path: pre-aborted signal disposes immediately', async () => {
    const registry = new InteractiveClipRegistry();
    registry.register('shader', makeStubFactory());
    const permissionShim = new PermissionShim({
      browser: {
        getUserMedia: async () => {
          throw new DOMException('Denied');
        },
      },
    });
    const harness = new InteractiveMountHarness({ registry, permissionShim });
    const controller = new AbortController();
    controller.abort();
    await harness.mount(
      makeInteractiveClip({ permissions: ['mic'] }),
      document.createElement('div'),
      controller.signal,
    );
  });
});

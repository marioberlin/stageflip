// packages/runtimes/interactive/src/mount-harness.test.ts
// T-306 AC #15–#18 — InteractiveMountHarness orchestration. AC #15 is the
// security-critical sequence (tenant → permission → registry → factory).

import { describe, expect, it, vi } from 'vitest';

import { makeInteractiveClip, makeStubFactory } from './contract-tests/fixtures.js';
import type { ClipFactory } from './contract.js';
import { InteractiveClipNotRegisteredError, InteractiveMountHarness } from './mount-harness.js';
import { PermissionShim } from './permission-shim.js';
import { InteractiveClipRegistry } from './registry.js';

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

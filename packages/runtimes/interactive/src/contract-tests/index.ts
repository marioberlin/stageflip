// packages/runtimes/interactive/src/contract-tests/index.ts
// `contractTestSuite(factory)` — the generic Vitest `describe` block that
// every Phase γ frontier-clip family imports + invokes against its own
// factory per T-306 D-T306-6.
//
// The suite asserts the runtime-tier contract — not family-specific
// behavior. Family tests layer additional `describe` blocks on top.

import type { InteractiveClip } from '@stageflip/schema';
import { describe, expect, it, vi } from 'vitest';

import type { ClipFactory } from '../contract.js';
import { InteractiveClipNotRegisteredError, InteractiveMountHarness } from '../mount-harness.js';
import { PermissionShim } from '../permission-shim.js';
import { InteractiveClipRegistry } from '../registry.js';
import { makeInteractiveClip } from './fixtures.js';

/**
 * The fixed permission stub used by the contract suite — denies every
 * live permission so we can exercise the static-fallback path without a
 * real `getUserMedia` mock per Phase γ family.
 */
function makeAlwaysDenyShim(): PermissionShim {
  return new PermissionShim({
    browser: {
      getUserMedia: async () => {
        throw new DOMException('Denied', 'NotAllowedError');
      },
    },
  });
}

/**
 * Run the runtime-tier contract test suite against `factory`. Pass the
 * factory the way Phase γ ships it (e.g., from
 * `import { shaderClipFactory } from '@stageflip/runtimes-interactive-shader'`).
 *
 * Optionally override the clip's `family`; default is `'shader'`.
 */
export function contractTestSuite(
  factory: ClipFactory,
  options: { family?: InteractiveClip['family']; suiteName?: string } = {},
): void {
  const family = options.family ?? 'shader';
  const suiteName = options.suiteName ?? `interactive runtime contract — ${family}`;

  describe(suiteName, () => {
    function makeHarness(): {
      harness: InteractiveMountHarness;
      registry: InteractiveClipRegistry;
    } {
      const registry = new InteractiveClipRegistry();
      registry.register(family, factory);
      const harness = new InteractiveMountHarness({ registry });
      return { harness, registry };
    }

    it('mount returns a MountHandle with updateProps + dispose', async () => {
      const { harness } = makeHarness();
      const clip = makeInteractiveClip({ family });
      const root = document.createElement('div');
      const controller = new AbortController();
      const handle = await harness.mount(clip, root, controller.signal);
      expect(typeof handle.updateProps).toBe('function');
      expect(typeof handle.dispose).toBe('function');
      handle.dispose();
    });

    it('updateProps is callable without throwing', async () => {
      const { harness } = makeHarness();
      const clip = makeInteractiveClip({ family });
      const root = document.createElement('div');
      const controller = new AbortController();
      const handle = await harness.mount(clip, root, controller.signal);
      expect(() => handle.updateProps({ foo: 1 })).not.toThrow();
      handle.dispose();
    });

    it('dispose() is idempotent', async () => {
      const { harness } = makeHarness();
      const clip = makeInteractiveClip({ family });
      const root = document.createElement('div');
      const controller = new AbortController();
      const handle = await harness.mount(clip, root, controller.signal);
      expect(() => {
        handle.dispose();
        handle.dispose();
      }).not.toThrow();
    });

    it('signal.abort triggers dispose', async () => {
      const onDispose = vi.fn();
      const wrapped: ClipFactory = async (ctx) => {
        const inner = await factory(ctx);
        return {
          updateProps: inner.updateProps,
          dispose: () => {
            onDispose();
            inner.dispose();
          },
        };
      };
      const registry = new InteractiveClipRegistry();
      registry.register(family, wrapped);
      const harness = new InteractiveMountHarness({ registry });
      const clip = makeInteractiveClip({ family });
      const root = document.createElement('div');
      const controller = new AbortController();
      await harness.mount(clip, root, controller.signal);
      controller.abort();
      expect(onDispose).toHaveBeenCalled();
    });

    it('permission denial routes to staticFallback', async () => {
      const registry = new InteractiveClipRegistry();
      registry.register(family, factory);
      const harness = new InteractiveMountHarness({
        registry,
        permissionShim: makeAlwaysDenyShim(),
      });
      const clip = makeInteractiveClip({ family, permissions: ['mic'] });
      const root = document.createElement('div');
      const controller = new AbortController();
      const handle = await harness.mount(clip, root, controller.signal);
      // Static path: updateProps no-ops; dispose is callable.
      expect(() => handle.updateProps({ foo: 1 })).not.toThrow();
      handle.dispose();
    });

    it('throws InteractiveClipNotRegisteredError when family is missing', async () => {
      const registry = new InteractiveClipRegistry();
      // Intentionally do NOT register `family`.
      const harness = new InteractiveMountHarness({ registry });
      const clip = makeInteractiveClip({ family });
      const root = document.createElement('div');
      const controller = new AbortController();
      await expect(harness.mount(clip, root, controller.signal)).rejects.toBeInstanceOf(
        InteractiveClipNotRegisteredError,
      );
    });
  });
}

export { makeInteractiveClip, makeStubFactory } from './fixtures.js';

// packages/runtimes/interactive/src/registry.test.ts
// T-306 AC #10–#14 — registry contract.

import { describe, expect, it, vi } from 'vitest';

import type { ClipFactory } from './contract.js';
import {
  InteractiveClipFamilyAlreadyRegisteredError,
  InteractiveClipRegistry,
  interactiveClipRegistry,
} from './registry.js';

const stub: ClipFactory = async () => ({
  updateProps: () => undefined,
  dispose: () => undefined,
});

describe('InteractiveClipRegistry', () => {
  it('register / resolve round-trip', () => {
    const registry = new InteractiveClipRegistry();
    registry.register('shader', stub);
    expect(registry.resolve('shader')).toBe(stub);
  });

  it('re-registering the same family throws', () => {
    const registry = new InteractiveClipRegistry();
    registry.register('shader', stub);
    expect(() => registry.register('shader', stub)).toThrow(
      InteractiveClipFamilyAlreadyRegisteredError,
    );
  });

  it('resolve returns undefined for unknown family', () => {
    const registry = new InteractiveClipRegistry();
    expect(registry.resolve('voice')).toBeUndefined();
  });

  it('list returns sorted family names', () => {
    const registry = new InteractiveClipRegistry();
    registry.register('voice', stub);
    registry.register('shader', stub);
    registry.register('ai-chat', stub);
    expect(registry.list()).toEqual(['ai-chat', 'shader', 'voice']);
  });

  it('unregister + clear are test-only escape hatches', () => {
    const registry = new InteractiveClipRegistry();
    registry.register('shader', stub);
    expect(registry.unregister('shader')).toBe(true);
    expect(registry.unregister('shader')).toBe(false);
    registry.register('voice', stub);
    registry.clear();
    expect(registry.list()).toEqual([]);
  });

  it('singleton is module-level — same instance across imports', async () => {
    const { interactiveClipRegistry: secondImport } = await import('./registry.js');
    expect(secondImport).toBe(interactiveClipRegistry);
  });

  it('error class carries the family name', () => {
    try {
      const registry = new InteractiveClipRegistry();
      registry.register('shader', stub);
      registry.register('shader', stub);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InteractiveClipFamilyAlreadyRegisteredError);
      expect((err as InteractiveClipFamilyAlreadyRegisteredError).family).toBe('shader');
    }
  });

  it('factory is invokable after registration', async () => {
    const registry = new InteractiveClipRegistry();
    const onMount = vi.fn();
    const observed: ClipFactory = async () => {
      onMount();
      return { updateProps: () => undefined, dispose: () => undefined };
    };
    registry.register('shader', observed);
    const resolved = registry.resolve('shader');
    expect(resolved).toBeDefined();
    if (resolved) {
      const root = document.createElement('div');
      const controller = new AbortController();
      await resolved({
        clip: { family: 'shader' } as never,
        root,
        permissions: [],
        tenantPolicy: { canMount: () => true },
        emitTelemetry: () => undefined,
        signal: controller.signal,
      });
      expect(onMount).toHaveBeenCalled();
    }
  });
});

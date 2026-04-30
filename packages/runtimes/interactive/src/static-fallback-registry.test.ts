// packages/runtimes/interactive/src/static-fallback-registry.test.ts
// T-388a ACs #1–#7 — `StaticFallbackGeneratorRegistry` mechanics
// (register / resolve / dup-throws / list / unregister / clear /
// singleton).

import { describe, expect, it, vi } from 'vitest';

import {
  type StaticFallbackGenerator,
  StaticFallbackGeneratorAlreadyRegisteredError,
  StaticFallbackGeneratorRegistry,
  staticFallbackGeneratorRegistry,
} from './static-fallback-registry.js';

const stubGenerator: StaticFallbackGenerator = () => [];

describe('StaticFallbackGeneratorRegistry (T-388a)', () => {
  it('AC #1 — register / resolve round-trip', () => {
    const registry = new StaticFallbackGeneratorRegistry();
    registry.register('voice', stubGenerator);
    expect(registry.resolve('voice')).toBe(stubGenerator);
  });

  it('AC #2 — re-registering the same family throws', () => {
    const registry = new StaticFallbackGeneratorRegistry();
    registry.register('voice', stubGenerator);
    expect(() => registry.register('voice', stubGenerator)).toThrow(
      StaticFallbackGeneratorAlreadyRegisteredError,
    );
  });

  it('AC #2 — error class carries the family name', () => {
    const registry = new StaticFallbackGeneratorRegistry();
    registry.register('voice', stubGenerator);
    try {
      registry.register('voice', stubGenerator);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(StaticFallbackGeneratorAlreadyRegisteredError);
      expect((err as StaticFallbackGeneratorAlreadyRegisteredError).family).toBe('voice');
    }
  });

  it('AC #4 — resolve returns undefined for unregistered family', () => {
    const registry = new StaticFallbackGeneratorRegistry();
    expect(registry.resolve('ai-chat')).toBeUndefined();
  });

  it('AC #5 — list returns sorted family names', () => {
    const registry = new StaticFallbackGeneratorRegistry();
    registry.register('voice', stubGenerator);
    registry.register('ai-chat', stubGenerator);
    registry.register('live-data', stubGenerator);
    expect(registry.list()).toEqual(['ai-chat', 'live-data', 'voice']);
  });

  it('AC #6 — unregister returns true when present, false when absent', () => {
    const registry = new StaticFallbackGeneratorRegistry();
    registry.register('voice', stubGenerator);
    expect(registry.unregister('voice')).toBe(true);
    expect(registry.unregister('voice')).toBe(false);
    expect(registry.resolve('voice')).toBeUndefined();
  });

  it('AC #7 — clear removes all registrations', () => {
    const registry = new StaticFallbackGeneratorRegistry();
    registry.register('voice', stubGenerator);
    registry.register('ai-chat', stubGenerator);
    registry.clear();
    expect(registry.list()).toEqual([]);
    expect(registry.resolve('voice')).toBeUndefined();
  });

  it('singleton is module-level — same instance across imports', async () => {
    const { staticFallbackGeneratorRegistry: secondImport } = await import(
      './static-fallback-registry.js'
    );
    expect(secondImport).toBe(staticFallbackGeneratorRegistry);
  });

  it('generator is invokable after registration', () => {
    const registry = new StaticFallbackGeneratorRegistry();
    const onCalled = vi.fn();
    const generator: StaticFallbackGenerator = (ctx) => {
      onCalled(ctx.reason);
      return [];
    };
    registry.register('voice', generator);
    const resolved = registry.resolve('voice');
    expect(resolved).toBeDefined();
    if (resolved) {
      const result = resolved({
        clip: { family: 'voice' } as never,
        reason: 'permission-denied',
        emitTelemetry: () => undefined,
      });
      expect(onCalled).toHaveBeenCalledWith('permission-denied');
      expect(result).toEqual([]);
    }
  });
});

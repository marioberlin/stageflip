// packages/runtimes/interactive/src/registry.ts
// `InteractiveClipRegistry` per T-306 D-T306-4 — the frontier-family →
// component-loader map. Phase γ clip packages call
// `interactiveClipRegistry.register('shader', shaderFactory)` at module-load
// time. T-306 ships an empty registry; the test suite uses a stub factory.
//
// Browser-safe: no Node-only imports. `Map` only.

import type { InteractiveClipFamily } from '@stageflip/schema';

import type { ClipFactory } from './contract.js';

/**
 * Thrown by `register()` when a second factory attempts to claim a family
 * that already has one. Silent shadowing would let a Phase γ clip package
 * accidentally clobber another's factory at import-order shuffle.
 */
export class InteractiveClipFamilyAlreadyRegisteredError extends Error {
  constructor(public readonly family: InteractiveClipFamily) {
    super(
      `Interactive clip family '${family}' is already registered. Only one factory per family.`,
    );
    this.name = 'InteractiveClipFamilyAlreadyRegisteredError';
  }
}

/**
 * Registry of frontier-clip factories keyed by `InteractiveClipFamily`.
 * Module-level singleton via `interactiveClipRegistry`.
 */
export class InteractiveClipRegistry {
  private readonly factories = new Map<InteractiveClipFamily, ClipFactory>();

  /**
   * Register a factory for `family`. Throws
   * `InteractiveClipFamilyAlreadyRegisteredError` if the family already has
   * a factory registered. Use `unregister` first when intentionally
   * replacing one (test fixtures; never in production).
   */
  register(family: InteractiveClipFamily, factory: ClipFactory): void {
    if (this.factories.has(family)) {
      throw new InteractiveClipFamilyAlreadyRegisteredError(family);
    }
    this.factories.set(family, factory);
  }

  /** Look up a factory. `undefined` if no factory has been registered. */
  resolve(family: InteractiveClipFamily): ClipFactory | undefined {
    return this.factories.get(family);
  }

  /**
   * Sorted list of registered family names. Sorted so callers can rely on
   * order (stable telemetry tags, deterministic UI listings).
   */
  list(): InteractiveClipFamily[] {
    return [...this.factories.keys()].sort();
  }

  /**
   * Remove a factory for `family`. Returns `true` if a factory was removed.
   * Test-only escape hatch for fixtures that re-register; production code
   * should not call this.
   */
  unregister(family: InteractiveClipFamily): boolean {
    return this.factories.delete(family);
  }

  /** Test-only escape hatch: clear all factories. */
  clear(): void {
    this.factories.clear();
  }
}

/**
 * Module-level singleton. Importing `interactiveClipRegistry` from two
 * different modules MUST yield the same instance — verified by the
 * registry contract test.
 */
export const interactiveClipRegistry = new InteractiveClipRegistry();

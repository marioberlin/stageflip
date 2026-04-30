// packages/runtimes/interactive/src/static-fallback-registry.ts
// `StaticFallbackGeneratorRegistry` per T-388a D-T388a-1 — per-family map
// of default-poster generators that the mount-harness consults when
// rendering the static path. Replaces the family-hardcoded
// `if (clip.family !== 'voice')` branch introduced by T-388 / PR #280.
//
// Module-level singleton parallel to `interactiveClipRegistry`. γ-live
// clip packages register their generator at module-load time (side
// effect, same pattern as the clip factory). The harness performs a
// generic `resolve(family)` lookup and dispatches uniformly; a family
// that ships no generator simply has no entry, and the harness passes
// `clip.staticFallback` through unchanged.
//
// Browser-safe: no Node-only imports. `Map` only.

import type { Element, InteractiveClip, InteractiveClipFamily } from '@stageflip/schema';

import type { EmitTelemetry } from './permission-shim.js';

/**
 * Context passed to a {@link StaticFallbackGenerator}. Mirrors the bits
 * of `MountContext` the existing voice generator needs: the clip itself,
 * the routing reason (so generators can shape their telemetry), and a
 * telemetry sink (the harness's `emitTelemetry`, already bound).
 */
export interface StaticFallbackGeneratorContext {
  /** The clip being rendered on the static path. */
  clip: InteractiveClip;
  /**
   * Routing reason — one of `'permission-denied'`, `'tenant-denied'`,
   * `'pre-prompt-cancelled'`, or `'authored'`. The harness invokes the
   * generator with `reason: 'authored'` even when the authored array
   * wins, so per-family telemetry still fires (D-T388a-3).
   */
  reason: string;
  /** Telemetry sink — same shape as `MountContext.emitTelemetry`. */
  emitTelemetry: EmitTelemetry;
}

/**
 * Returns the `Element[]` to render when a clip's authored
 * `staticFallback` is empty (or, on the authored path, ignored — the
 * authored array still wins). Generators MAY emit telemetry as a side
 * effect; their RETURN value is consumed only when the authored array is
 * empty.
 */
export type StaticFallbackGenerator = (
  ctx: StaticFallbackGeneratorContext,
) => ReadonlyArray<Element>;

/**
 * Thrown by `register()` when a second generator attempts to claim a
 * family that already has one. Mirrors
 * `InteractiveClipFamilyAlreadyRegisteredError`; silent shadowing would
 * let two clip packages clobber each other's defaults at import-order
 * shuffle.
 */
export class StaticFallbackGeneratorAlreadyRegisteredError extends Error {
  constructor(public readonly family: InteractiveClipFamily) {
    super(
      `Static-fallback generator for family '${family}' is already registered. Only one generator per family.`,
    );
    this.name = 'StaticFallbackGeneratorAlreadyRegisteredError';
  }
}

/**
 * Registry of per-family default-poster generators keyed by
 * `InteractiveClipFamily`. Module-level singleton via
 * {@link staticFallbackGeneratorRegistry}.
 */
export class StaticFallbackGeneratorRegistry {
  private readonly generators = new Map<InteractiveClipFamily, StaticFallbackGenerator>();

  /**
   * Register a generator for `family`. Throws
   * `StaticFallbackGeneratorAlreadyRegisteredError` if the family
   * already has a generator registered. Use `unregister` first when
   * intentionally replacing one (test fixtures only).
   */
  register(family: InteractiveClipFamily, generator: StaticFallbackGenerator): void {
    if (this.generators.has(family)) {
      throw new StaticFallbackGeneratorAlreadyRegisteredError(family);
    }
    this.generators.set(family, generator);
  }

  /** Look up a generator. `undefined` if no generator has been registered. */
  resolve(family: InteractiveClipFamily): StaticFallbackGenerator | undefined {
    return this.generators.get(family);
  }

  /**
   * Sorted list of registered family names. Sorted so callers can rely
   * on order (stable telemetry tags, deterministic UI listings).
   */
  list(): InteractiveClipFamily[] {
    return [...this.generators.keys()].sort();
  }

  /**
   * Remove a generator for `family`. Returns `true` if a generator was
   * removed. Test-only escape hatch for fixtures that re-register;
   * production code should not call this.
   */
  unregister(family: InteractiveClipFamily): boolean {
    return this.generators.delete(family);
  }

  /** Test-only escape hatch: clear all generators. */
  clear(): void {
    this.generators.clear();
  }
}

/**
 * Module-level singleton. Importing `staticFallbackGeneratorRegistry`
 * from two different modules MUST yield the same instance — verified by
 * the registry contract test.
 */
export const staticFallbackGeneratorRegistry = new StaticFallbackGeneratorRegistry();

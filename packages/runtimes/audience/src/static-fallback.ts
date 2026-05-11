// packages/runtimes/audience/src/static-fallback.ts
// `StaticFallbackRenderer` — reads `AudienceProvenance` and dispatches to
// a per-clip-kind factory hook per ADR-010 §D4 + §D5. T-454 ships the
// dispatcher + the `staticFallback(provenance, ctx) => RenderOutput`
// signature; T-461..T-471 register per-kind factories (LivePoll layout,
// Heatmap raster blend, ReactionStream shader pass, etc.).
//
// Three snapshot-selection policies per ADR-010 §D4:
//   - `final` — default; the snapshot taken at session close.
//   - `peak` — ReactionStream default; the snapshot with the highest
//     aggregate intensity within the session window.
//   - `at-frame` — HeatmapClip pinned; the snapshot taken at a specific
//     composition frame.
// The policy lives on `AudienceProvenance.snapshotPolicy`. T-454's
// dispatcher reads it and forwards to the registered factory; per-kind
// policy interpretation is the factory's concern.
//
// Loss-flag: emits `LF-AUDIENCE-SNAPSHOT-MISSING` (the seventh code,
// shared with the server-side emission site in T-453) when provenance is
// incomplete — i.e., the `aggregation` discriminant does not match the
// declared `clipKind`. Per ADR-009 §D11.
//
// Browser-safe. Pure dispatch; no Date / random / fetch / setTimeout.

import type { AudienceClipKind, AudienceProvenance } from '@stageflip/audience-contract';

import type { AudienceEmitLossFlag } from './contract.js';

/**
 * Per-clip-kind static-fallback factory signature. Takes the provenance
 * + a context object (the per-clip-kind factory determines its own
 * context shape — typed `unknown` here because T-454 ships the
 * dispatcher only). Returns the renderer's output: per-clip-kind a
 * React element, a raster blob, or a shader pass.
 */
export type StaticFallbackFactory<TContext = unknown, TOutput = unknown> = (input: {
  readonly provenance: AudienceProvenance;
  readonly context: TContext;
}) => TOutput;

/**
 * Thrown by `register()` when a second factory attempts to claim a kind
 * that already has one.
 */
export class StaticFallbackFactoryAlreadyRegisteredError extends Error {
  constructor(public readonly kind: AudienceClipKind) {
    super(`Static-fallback factory for '${kind}' is already registered. Only one per kind.`);
    this.name = 'StaticFallbackFactoryAlreadyRegisteredError';
  }
}

/**
 * Thrown by `render()` when no factory is registered for the
 * provenance's `clipKind`. Distinct from `LF-AUDIENCE-SNAPSHOT-MISSING`
 * (which fires when provenance is *incomplete*); this fires when the
 * dispatcher has nothing to dispatch TO.
 */
export class StaticFallbackFactoryNotRegisteredError extends Error {
  constructor(public readonly kind: AudienceClipKind) {
    super(`No static-fallback factory registered for audience-clip kind '${kind}'.`);
    this.name = 'StaticFallbackFactoryNotRegisteredError';
  }
}

/**
 * Outcome of a `render()` call. Discriminated by `state`:
 *  - `'rendered'` — the registered factory produced output.
 *  - `'snapshot-missing'` — the provenance failed integrity checks;
 *    `LF-AUDIENCE-SNAPSHOT-MISSING` was emitted before this returned.
 */
export type StaticFallbackResult<TOutput = unknown> =
  | { readonly state: 'rendered'; readonly output: TOutput }
  | { readonly state: 'snapshot-missing'; readonly reason: string };

/**
 * Validation result for a provenance payload's internal consistency.
 * Used by `render()` to decide whether to dispatch or to emit
 * `LF-AUDIENCE-SNAPSHOT-MISSING`. Exported so per-kind factories can
 * reuse the same integrity contract.
 */
export interface ProvenanceIntegrity {
  readonly ok: boolean;
  readonly reason?: string;
}

/**
 * Check `provenance.aggregation.kind === provenance.clipKind`. If they
 * disagree, the provenance is corrupt or wrong-clip — emit
 * `LF-AUDIENCE-SNAPSHOT-MISSING` rather than dispatching to a factory
 * that would render against a mismatched discriminant.
 */
export function checkProvenanceIntegrity(provenance: AudienceProvenance): ProvenanceIntegrity {
  if (provenance.aggregation.kind !== provenance.clipKind) {
    return {
      ok: false,
      reason: `provenance.clipKind '${provenance.clipKind}' does not match aggregation.kind '${provenance.aggregation.kind}'`,
    };
  }
  return { ok: true };
}

/**
 * Static-fallback dispatcher. One instance per audience-runtime
 * instance (the runtime singleton owns it via `audienceRuntime` /
 * `staticFallbackRenderer`).
 */
export class StaticFallbackRenderer {
  private readonly factories = new Map<AudienceClipKind, StaticFallbackFactory>();

  /**
   * Register a factory for `kind`. Throws
   * `StaticFallbackFactoryAlreadyRegisteredError` if the kind already
   * has one.
   */
  register<TContext, TOutput>(
    kind: AudienceClipKind,
    factory: StaticFallbackFactory<TContext, TOutput>,
  ): void {
    if (this.factories.has(kind)) {
      throw new StaticFallbackFactoryAlreadyRegisteredError(kind);
    }
    this.factories.set(kind, factory as StaticFallbackFactory);
  }

  /** Look up a factory. `undefined` if none registered. */
  resolve(kind: AudienceClipKind): StaticFallbackFactory | undefined {
    return this.factories.get(kind);
  }

  /** Sorted list of registered kinds. */
  list(): AudienceClipKind[] {
    return [...this.factories.keys()].sort();
  }

  /** Test-only escape hatch. */
  unregister(kind: AudienceClipKind): boolean {
    return this.factories.delete(kind);
  }

  /** Test-only escape hatch. */
  clear(): void {
    this.factories.clear();
  }

  /**
   * Render the static fallback for `provenance`. If integrity check
   * fails, emit `LF-AUDIENCE-SNAPSHOT-MISSING` (consumer-side per
   * ADR-009 §D11) and return `state: 'snapshot-missing'`. If no factory
   * is registered for the provenance's kind, throws
   * `StaticFallbackFactoryNotRegisteredError` (a programming error, not
   * a runtime loss-flag — registry drift between T-454 and a downstream
   * clip task surfaces as a thrown exception).
   *
   * `context` is forwarded to the factory; the per-kind factory
   * narrows its type.
   */
  render<TContext = unknown, TOutput = unknown>(input: {
    readonly provenance: AudienceProvenance;
    readonly context: TContext;
    readonly emitLossFlag: AudienceEmitLossFlag;
  }): StaticFallbackResult<TOutput> {
    const integrity = checkProvenanceIntegrity(input.provenance);
    if (!integrity.ok) {
      input.emitLossFlag({
        code: 'LF-AUDIENCE-SNAPSHOT-MISSING',
        message: `Audience static-fallback aborted: ${integrity.reason ?? 'provenance integrity check failed'} (ADR-009 §D11).`,
        location: {},
      });
      return { state: 'snapshot-missing', reason: integrity.reason ?? 'integrity check failed' };
    }
    const factory = this.factories.get(input.provenance.clipKind);
    if (factory === undefined) {
      throw new StaticFallbackFactoryNotRegisteredError(input.provenance.clipKind);
    }
    const output = factory({ provenance: input.provenance, context: input.context }) as TOutput;
    return { state: 'rendered', output };
  }
}

/**
 * Module-level singleton. T-461..T-471 call
 * `staticFallbackRenderer.register('live-poll-multiple-choice', factory)`
 * at clip-package import time. Empty on instantiation per T-454 scope.
 */
export const staticFallbackRenderer = new StaticFallbackRenderer();

/**
 * Free-function wrapper mirroring the registry pattern. Forwards to
 * `staticFallbackRenderer.register(...)`.
 */
export function registerStaticFallback<TContext, TOutput>(
  kind: AudienceClipKind,
  factory: StaticFallbackFactory<TContext, TOutput>,
): void {
  staticFallbackRenderer.register(kind, factory);
}

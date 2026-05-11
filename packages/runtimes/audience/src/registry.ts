// packages/runtimes/audience/src/registry.ts
// `AudienceClipRegistry` per T-454 — the `AudienceClipKind` →
// `AudienceClipFactory` map. Mirrors `InteractiveClipRegistry` from
// T-306 verbatim, swapping the family discriminant.
//
// The nine v1 audience clip families (T-461..T-471) call
// `audienceClipRegistry.register('live-poll-multiple-choice', factory)`
// at module-load time. T-454 ships an empty registry; the test suite
// uses a stub factory.
//
// Browser-safe: `Map` only.

import { AUDIENCE_CLIP_KINDS, type AudienceClipKind } from '@stageflip/audience-contract';

import type { AudienceClipFactory } from './contract.js';

/**
 * Thrown by `register()` when a second factory attempts to claim a kind
 * that already has one. Silent shadowing would let a clip package
 * accidentally clobber another's factory at import-order shuffle.
 */
export class AudienceClipKindAlreadyRegisteredError extends Error {
  constructor(public readonly kind: AudienceClipKind) {
    super(`Audience clip kind '${kind}' is already registered. Only one factory per kind.`);
    this.name = 'AudienceClipKindAlreadyRegisteredError';
  }
}

/**
 * Thrown by `register()` when the supplied `kind` is not in the sealed
 * `AUDIENCE_CLIP_KINDS` inventory. Catches typos at registration time.
 */
export class UnknownAudienceClipKindError extends Error {
  constructor(public readonly kind: string) {
    super(
      `Audience clip kind '${kind}' is not in AUDIENCE_CLIP_KINDS (ADR-009 §D2 / ADR-010 §D1).`,
    );
    this.name = 'UnknownAudienceClipKindError';
  }
}

/**
 * Registry of audience-clip factories keyed by `AudienceClipKind`.
 * Module-level singleton via `audienceClipRegistry`.
 */
export class AudienceClipRegistry {
  private readonly factories = new Map<AudienceClipKind, AudienceClipFactory>();

  /**
   * Register a factory for `kind`. Throws
   * `AudienceClipKindAlreadyRegisteredError` if the kind already has a
   * factory; throws `UnknownAudienceClipKindError` if `kind` is not in
   * the sealed inventory.
   */
  register(kind: AudienceClipKind, factory: AudienceClipFactory): void {
    if (!(AUDIENCE_CLIP_KINDS as readonly string[]).includes(kind)) {
      throw new UnknownAudienceClipKindError(kind);
    }
    if (this.factories.has(kind)) {
      throw new AudienceClipKindAlreadyRegisteredError(kind);
    }
    this.factories.set(kind, factory);
  }

  /** Look up a factory. `undefined` if no factory has been registered. */
  resolve(kind: AudienceClipKind): AudienceClipFactory | undefined {
    return this.factories.get(kind);
  }

  /**
   * Sorted list of registered kind names. Sorted so callers can rely on
   * order (stable telemetry tags, deterministic UI listings).
   */
  list(): AudienceClipKind[] {
    return [...this.factories.keys()].sort();
  }

  /**
   * Remove a factory for `kind`. Returns `true` if a factory was removed.
   * Test-only escape hatch; production code should not call this.
   */
  unregister(kind: AudienceClipKind): boolean {
    return this.factories.delete(kind);
  }

  /** Test-only escape hatch: clear all factories. */
  clear(): void {
    this.factories.clear();
  }
}

/**
 * Module-level singleton. Importing `audienceClipRegistry` from two
 * different modules MUST yield the same instance — verified by the
 * registry contract test.
 */
export const audienceClipRegistry = new AudienceClipRegistry();

/**
 * Convenience wrapper mirroring `registerInteractiveClip` from T-306 so
 * audience clip families call a free function instead of reaching into
 * the singleton. Forwards to `audienceClipRegistry.register(...)`.
 */
export function registerAudienceClip(kind: AudienceClipKind, factory: AudienceClipFactory): void {
  audienceClipRegistry.register(kind, factory);
}

/**
 * Convenience wrapper mirroring the spec's `findAudienceClip(kind)` —
 * returns the factory or `undefined` if no factory has been registered.
 */
export function findAudienceClip(kind: AudienceClipKind): AudienceClipFactory | undefined {
  return audienceClipRegistry.resolve(kind);
}

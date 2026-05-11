// packages/runtimes/audience/src/audience-runtime.ts
// `audienceRuntime` — the `ClipRuntime` (from `@stageflip/runtimes-contract`)
// implementation that wraps the audience registry + static-fallback
// dispatcher + three-state router. `tier: 'live'`, `id: 'audience'`.
//
// T-454 ships an empty `clips` map; T-461..T-471 register their per-kind
// `ClipDefinition` via `registerAudienceClipDefinition(kind, def)`. The
// audience-clip-mount path (T-461..T-471's runtime entrypoint) lives
// behind the `audienceClipRegistry` registered via `registerAudienceClip`;
// this module exposes the `ClipRuntime` plug for `findClip(kind)`
// dispatch from `renderer-core`.

import type { ClipDefinition, ClipRuntime } from '@stageflip/runtimes-contract';

import { audienceClipRegistry } from './registry.js';
import { staticFallbackRenderer } from './static-fallback.js';

/**
 * Internal map of `ClipDefinition`s keyed by audience-clip-kind. The
 * `ClipRuntime` contract expects a `ReadonlyMap<string, ClipDefinition>`
 * — this is a live `Map` instance so per-kind registration during clip
 * package import-time mutates the runtime's exposed `clips` view.
 *
 * T-461..T-471's per-kind module calls `registerAudienceClipDefinition`
 * with the kind + its `ClipDefinition`. The kind string MUST match the
 * `AudienceClipKind` discriminant.
 */
const clipDefinitions = new Map<string, ClipDefinition<unknown>>();

/**
 * Register the `ClipDefinition` plug for `kind`. Throws when the kind is
 * already registered. Separate from `registerAudienceClip` (which
 * registers the `AudienceClipFactory` on the live-mount registry) — a
 * full clip implementation registers BOTH: the live-mount factory on
 * `audienceClipRegistry`, and the `ClipDefinition` here so renderer-core
 * dispatch picks it up.
 */
export function registerAudienceClipDefinition(
  kind: string,
  definition: ClipDefinition<unknown>,
): void {
  if (kind !== definition.kind) {
    throw new Error(
      `registerAudienceClipDefinition: key '${kind}' does not match definition.kind '${definition.kind}'`,
    );
  }
  if (clipDefinitions.has(kind)) {
    throw new Error(`registerAudienceClipDefinition: kind '${kind}' is already registered`);
  }
  clipDefinitions.set(kind, definition);
}

/** Test-only escape hatch: clear the ClipDefinition registry. */
export function __clearAudienceClipDefinitions(): void {
  clipDefinitions.clear();
}

/**
 * The audience `ClipRuntime` per `@stageflip/runtimes-contract`. Wired
 * into the host runtime registry at boot via `registerRuntime(audienceRuntime)`.
 *
 * `tier: 'live'` — every audience clip mounts via the live FrameClock
 * path. The deterministic `staticFallback` branch is exercised at
 * export time per ADR-010 §D4; the `tier` discriminator refers to the
 * editor / preview path.
 *
 * The runtime keeps `clips` as a live view onto `clipDefinitions` so
 * post-import registrations are immediately visible to
 * `findClip(kind)`.
 */
export const audienceRuntime: ClipRuntime = {
  id: 'audience',
  tier: 'live',
  clips: clipDefinitions,
};

/**
 * Re-export the registry + static-fallback singletons so consumers
 * importing only `audience-runtime.ts` get the full surface they need
 * (the per-kind tests in T-461..T-471 import all three).
 */
export { audienceClipRegistry } from './registry.js';
export { staticFallbackRenderer } from './static-fallback.js';

/**
 * Test-only: clear every registry the audience runtime owns. Useful when
 * a test fixture wants a pristine starting state.
 */
export function __resetAudienceRuntime(): void {
  audienceClipRegistry.clear();
  staticFallbackRenderer.clear();
  clipDefinitions.clear();
}

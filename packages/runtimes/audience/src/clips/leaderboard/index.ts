// packages/runtimes/audience/src/clips/leaderboard/index.ts
// T-466 — Barrel + module-load auto-registration for the `leaderboard`
// clip family. Importing this module has THREE side effects:
//
//   1. registers the `leaderboardClipFactory` with `audienceClipRegistry`
//      (the live-mount path);
//   2. registers `renderLeaderboardStaticFallback` with the
//      `staticFallbackRenderer` dispatcher (the static-fallback path);
//   3. registers `leaderboardClipDefinition` with `audienceRuntime` so
//      renderer-core's `findClip(kind)` resolves.
//
// Re-importing throws (per the registry contracts in T-454). Tests that
// need a fresh registration call the matching `__reset…` helper.

import type { ReactElement } from 'react';

import { registerAudienceClipDefinition } from '../../audience-runtime.js';
import { audienceClipRegistry } from '../../registry.js';
import { staticFallbackRenderer } from '../../static-fallback.js';
import { LEADERBOARD_KIND, leaderboardClipDefinition } from './clip-definition.js';
import { leaderboardClipFactory } from './factory.js';
import {
  type LeaderboardStaticFallbackContext,
  renderLeaderboardStaticFallback,
} from './static-fallback.js';

// Side-effect 1: live-mount factory.
audienceClipRegistry.register(LEADERBOARD_KIND, leaderboardClipFactory);

// Side-effect 2: static-fallback factory. The dispatcher's
// `StaticFallbackFactory` signature accepts `(input: { provenance,
// context }) => TOutput`; we narrow the discriminator + adapt the
// context shape to the per-clip context here.
staticFallbackRenderer.register<LeaderboardStaticFallbackContext, ReactElement>(
  LEADERBOARD_KIND,
  ({ provenance, context }) => {
    const aggregation = provenance.aggregation;
    if (aggregation.kind !== LEADERBOARD_KIND) {
      // The dispatcher's integrity check should have caught this; the
      // throw is a defence-in-depth assertion the registry's
      // discriminator contract holds.
      throw new Error(
        `leaderboard static-fallback: aggregation.kind '${aggregation.kind}' did not match expected discriminant`,
      );
    }
    return renderLeaderboardStaticFallback({
      snapshot: aggregation,
      context,
    });
  },
);

// Side-effect 3: ClipDefinition for renderer-core dispatch.
registerAudienceClipDefinition(LEADERBOARD_KIND, leaderboardClipDefinition);

// Re-exports — the public surface of the clip module.
export { LEADERBOARD_KIND, leaderboardClipDefinition } from './clip-definition.js';
export { leaderboardClipFactory } from './factory.js';
export { MANIFEST } from './manifest.js';
export {
  type LeaderboardStaticFallbackContext,
  formatParticipantsLabel,
  medalColorForRank,
  medalForRank,
  renderLeaderboardStaticFallback,
} from './static-fallback.js';

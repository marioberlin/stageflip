// packages/runtimes/audience/src/clips/live-poll-rating/index.ts
// T-463 — Barrel + module-load auto-registration for the
// `live-poll-rating` clip family. Importing this module has THREE
// side effects:
//
//   1. registers the `livePollRatingClipFactory` with
//      `audienceClipRegistry` (the live-mount path);
//   2. registers `renderLivePollRatingStaticFallback` with the
//      `staticFallbackRenderer` dispatcher (the static-fallback path);
//   3. registers `livePollRatingClipDefinition` with `audienceRuntime`
//      so renderer-core's `findClip(kind)` resolves.
//
// Re-importing throws (per the registry contracts in T-454). Tests that
// need a fresh registration call the matching `__reset…` helper.

import type { ReactElement } from 'react';

import { registerAudienceClipDefinition } from '../../audience-runtime.js';
import { audienceClipRegistry } from '../../registry.js';
import { staticFallbackRenderer } from '../../static-fallback.js';
import { LIVE_POLL_RATING_KIND, livePollRatingClipDefinition } from './clip-definition.js';
import { livePollRatingClipFactory } from './factory.js';
import {
  type LivePollRatingStaticFallbackContext,
  renderLivePollRatingStaticFallback,
} from './static-fallback.js';

// Side-effect 1: live-mount factory.
audienceClipRegistry.register(LIVE_POLL_RATING_KIND, livePollRatingClipFactory);

// Side-effect 2: static-fallback factory. The dispatcher's
// `StaticFallbackFactory` signature accepts `(input: { provenance,
// context }) => TOutput`; we narrow the discriminator + adapt the
// context shape to the per-clip context here.
staticFallbackRenderer.register<LivePollRatingStaticFallbackContext, ReactElement>(
  LIVE_POLL_RATING_KIND,
  ({ provenance, context }) => {
    const aggregation = provenance.aggregation;
    if (aggregation.kind !== LIVE_POLL_RATING_KIND) {
      // The dispatcher's integrity check should have caught this; the
      // throw is a defence-in-depth assertion the registry's discriminator
      // contract holds.
      throw new Error(
        `live-poll-rating static-fallback: aggregation.kind '${aggregation.kind}' did not match expected discriminant`,
      );
    }
    return renderLivePollRatingStaticFallback({
      snapshot: aggregation,
      context,
    });
  },
);

// Side-effect 3: ClipDefinition for renderer-core dispatch.
registerAudienceClipDefinition(LIVE_POLL_RATING_KIND, livePollRatingClipDefinition);

// Re-exports — the public surface of the clip module.
export { LIVE_POLL_RATING_KIND, livePollRatingClipDefinition } from './clip-definition.js';
export { livePollRatingClipFactory } from './factory.js';
export { MANIFEST } from './manifest.js';
export {
  type LivePollRatingStaticFallbackContext,
  formatMeanLabel,
  formatTotalLabel,
  meanHighlightIndex,
  renderLivePollRatingStaticFallback,
} from './static-fallback.js';

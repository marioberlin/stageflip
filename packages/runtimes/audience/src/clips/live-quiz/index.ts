// packages/runtimes/audience/src/clips/live-quiz/index.ts
// T-465 — Barrel + module-load auto-registration for the `live-quiz`
// clip family. Importing this module has THREE side effects:
//
//   1. registers the `liveQuizClipFactory` with `audienceClipRegistry`
//      (the live-mount path);
//   2. registers `renderLiveQuizStaticFallback` with the
//      `staticFallbackRenderer` dispatcher (the static-fallback path);
//   3. registers `liveQuizClipDefinition` with `audienceRuntime` so
//      renderer-core's `findClip(kind)` resolves.
//
// Re-importing throws (per the registry contracts in T-454). Tests that
// need a fresh registration call the matching `__reset…` helper.

import type { ReactElement } from 'react';

import { registerAudienceClipDefinition } from '../../audience-runtime.js';
import { audienceClipRegistry } from '../../registry.js';
import { staticFallbackRenderer } from '../../static-fallback.js';
import { LIVE_QUIZ_KIND, liveQuizClipDefinition } from './clip-definition.js';
import { liveQuizClipFactory } from './factory.js';
import {
  type LiveQuizStaticFallbackContext,
  renderLiveQuizStaticFallback,
} from './static-fallback.js';

// Side-effect 1: live-mount factory.
audienceClipRegistry.register(LIVE_QUIZ_KIND, liveQuizClipFactory);

// Side-effect 2: static-fallback factory. The dispatcher's
// `StaticFallbackFactory` signature accepts `(input: { provenance,
// context }) => TOutput`; we narrow the discriminator + adapt the
// context shape to the per-clip context here.
staticFallbackRenderer.register<LiveQuizStaticFallbackContext, ReactElement>(
  LIVE_QUIZ_KIND,
  ({ provenance, context }) => {
    const aggregation = provenance.aggregation;
    if (aggregation.kind !== LIVE_QUIZ_KIND) {
      // The dispatcher's integrity check should have caught this; the
      // throw is a defence-in-depth assertion the registry's discriminator
      // contract holds.
      throw new Error(
        `live-quiz static-fallback: aggregation.kind '${aggregation.kind}' did not match expected discriminant`,
      );
    }
    return renderLiveQuizStaticFallback({
      snapshot: aggregation,
      context,
    });
  },
);

// Side-effect 3: ClipDefinition for renderer-core dispatch.
registerAudienceClipDefinition(LIVE_QUIZ_KIND, liveQuizClipDefinition);

// Re-exports — the public surface of the clip module.
export { LIVE_QUIZ_KIND, liveQuizClipDefinition } from './clip-definition.js';
export { liveQuizClipFactory } from './factory.js';
export { MANIFEST } from './manifest.js';
export {
  type LiveQuizQuestionDef,
  type LiveQuizStaticFallbackContext,
  computeBarFractions,
  formatVotesLabel,
  renderLiveQuizStaticFallback,
} from './static-fallback.js';

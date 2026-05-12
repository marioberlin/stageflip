// packages/runtimes/audience/src/clips/live-qa/index.ts
// T-464 — Barrel + module-load auto-registration for the `live-qa`
// clip family. Importing this module has THREE side effects:
//
//   1. registers the `liveQAClipFactory` with `audienceClipRegistry`
//      (the live-mount path);
//   2. registers `renderLiveQAStaticFallback` with the
//      `staticFallbackRenderer` dispatcher (the static-fallback path);
//   3. registers `liveQAClipDefinition` with `audienceRuntime` so
//      renderer-core's `findClip(kind)` resolves.
//
// Re-importing throws (per the registry contracts in T-454). Tests that
// need a fresh registration call the matching `__reset…` helper.

import type { ReactElement } from 'react';

import { registerAudienceClipDefinition } from '../../audience-runtime.js';
import { audienceClipRegistry } from '../../registry.js';
import { staticFallbackRenderer } from '../../static-fallback.js';
import { LIVE_QA_KIND, liveQAClipDefinition } from './clip-definition.js';
import { liveQAClipFactory } from './factory.js';
import { type LiveQAStaticFallbackContext, renderLiveQAStaticFallback } from './static-fallback.js';

// Side-effect 1: live-mount factory.
audienceClipRegistry.register(LIVE_QA_KIND, liveQAClipFactory);

// Side-effect 2: static-fallback factory. The dispatcher's
// `StaticFallbackFactory` signature accepts `(input: { provenance,
// context }) => TOutput`; we narrow the discriminator + adapt the
// context shape to the per-clip context here.
staticFallbackRenderer.register<LiveQAStaticFallbackContext, ReactElement>(
  LIVE_QA_KIND,
  ({ provenance, context }) => {
    const aggregation = provenance.aggregation;
    if (aggregation.kind !== LIVE_QA_KIND) {
      // The dispatcher's integrity check should have caught this; the
      // throw is a defence-in-depth assertion the registry's discriminator
      // contract holds.
      throw new Error(
        `live-qa static-fallback: aggregation.kind '${aggregation.kind}' did not match expected discriminant`,
      );
    }
    return renderLiveQAStaticFallback({
      snapshot: aggregation,
      context,
    });
  },
);

// Side-effect 3: ClipDefinition for renderer-core dispatch.
registerAudienceClipDefinition(LIVE_QA_KIND, liveQAClipDefinition);

// Re-exports — the public surface of the clip module.
export { LIVE_QA_KIND, liveQAClipDefinition } from './clip-definition.js';
export { liveQAClipFactory } from './factory.js';
export { MANIFEST } from './manifest.js';
export {
  type LiveQAStaticFallbackContext,
  formatRelativeTime,
  formatTotalLabel,
  formatUpvoteLabel,
  renderLiveQAStaticFallback,
  sortQuestions,
} from './static-fallback.js';

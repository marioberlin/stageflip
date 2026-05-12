// packages/runtimes/audience/src/clips/live-poll-multiple-choice/index.ts
// T-461 — Barrel + module-load auto-registration for the
// `live-poll-multiple-choice` clip family. Importing this module has
// THREE side effects:
//
//   1. registers the `livePollMultipleChoiceClipFactory` with
//      `audienceClipRegistry` (the live-mount path);
//   2. registers `renderLivePollMultipleChoiceStaticFallback` with the
//      `staticFallbackRenderer` dispatcher (the static-fallback path);
//   3. registers `livePollMultipleChoiceClipDefinition` with
//      `audienceRuntime` so renderer-core's `findClip(kind)` resolves.
//
// Re-importing throws (per the registry contracts in T-454). Tests that
// need a fresh registration call the matching `__reset…` helper.

import type { ReactElement } from 'react';

import { registerAudienceClipDefinition } from '../../audience-runtime.js';
import { audienceClipRegistry } from '../../registry.js';
import { staticFallbackRenderer } from '../../static-fallback.js';
import {
  LIVE_POLL_MULTIPLE_CHOICE_KIND,
  livePollMultipleChoiceClipDefinition,
} from './clip-definition.js';
import { livePollMultipleChoiceClipFactory } from './factory.js';
import {
  type LivePollMultipleChoiceStaticFallbackContext,
  renderLivePollMultipleChoiceStaticFallback,
} from './static-fallback.js';

// Side-effect 1: live-mount factory.
audienceClipRegistry.register(LIVE_POLL_MULTIPLE_CHOICE_KIND, livePollMultipleChoiceClipFactory);

// Side-effect 2: static-fallback factory. The dispatcher's
// `StaticFallbackFactory` signature accepts `(input: { provenance,
// context }) => TOutput`; we narrow the discriminator + adapt the
// context shape to the per-clip context here.
staticFallbackRenderer.register<LivePollMultipleChoiceStaticFallbackContext, ReactElement>(
  LIVE_POLL_MULTIPLE_CHOICE_KIND,
  ({ provenance, context }) => {
    const aggregation = provenance.aggregation;
    if (aggregation.kind !== LIVE_POLL_MULTIPLE_CHOICE_KIND) {
      // The dispatcher's integrity check should have caught this; the
      // throw is a defence-in-depth assertion the registry's discriminator
      // contract holds.
      throw new Error(
        `live-poll-multiple-choice static-fallback: aggregation.kind '${aggregation.kind}' did not match expected discriminant`,
      );
    }
    return renderLivePollMultipleChoiceStaticFallback({
      snapshot: aggregation,
      context,
    });
  },
);

// Side-effect 3: ClipDefinition for renderer-core dispatch.
registerAudienceClipDefinition(
  LIVE_POLL_MULTIPLE_CHOICE_KIND,
  livePollMultipleChoiceClipDefinition,
);

// Re-exports — the public surface of the clip module.
export {
  LIVE_POLL_MULTIPLE_CHOICE_KIND,
  livePollMultipleChoiceClipDefinition,
} from './clip-definition.js';
export { livePollMultipleChoiceClipFactory } from './factory.js';
export { MANIFEST } from './manifest.js';
export {
  type LivePollMultipleChoiceStaticFallbackContext,
  computeBarFraction,
  computePercent,
  renderLivePollMultipleChoiceStaticFallback,
} from './static-fallback.js';

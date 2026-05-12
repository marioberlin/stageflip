// packages/runtimes/audience/src/clips/live-poll-open-text/index.ts
// T-462 — Barrel + module-load auto-registration for the
// `live-poll-open-text` clip family. Importing this module has THREE
// side effects:
//
//   1. registers the `livePollOpenTextClipFactory` with
//      `audienceClipRegistry` (the live-mount path);
//   2. registers `renderLivePollOpenTextStaticFallback` with the
//      `staticFallbackRenderer` dispatcher (the static-fallback path);
//   3. registers `livePollOpenTextClipDefinition` with `audienceRuntime`
//      so renderer-core's `findClip(kind)` resolves.
//
// Re-importing throws (per the registry contracts in T-454). Tests that
// need a fresh registration call the matching `__reset…` helper.

import type { ReactElement } from 'react';

import { registerAudienceClipDefinition } from '../../audience-runtime.js';
import { audienceClipRegistry } from '../../registry.js';
import { staticFallbackRenderer } from '../../static-fallback.js';
import { LIVE_POLL_OPEN_TEXT_KIND, livePollOpenTextClipDefinition } from './clip-definition.js';
import { livePollOpenTextClipFactory } from './factory.js';
import {
  type LivePollOpenTextStaticFallbackContext,
  renderLivePollOpenTextStaticFallback,
} from './static-fallback.js';

// Side-effect 1: live-mount factory.
audienceClipRegistry.register(LIVE_POLL_OPEN_TEXT_KIND, livePollOpenTextClipFactory);

// Side-effect 2: static-fallback factory. The dispatcher's
// `StaticFallbackFactory` signature accepts `(input: { provenance,
// context }) => TOutput`; we narrow the discriminator + adapt the
// context shape to the per-clip context here.
staticFallbackRenderer.register<LivePollOpenTextStaticFallbackContext, ReactElement>(
  LIVE_POLL_OPEN_TEXT_KIND,
  ({ provenance, context }) => {
    const aggregation = provenance.aggregation;
    if (aggregation.kind !== LIVE_POLL_OPEN_TEXT_KIND) {
      // The dispatcher's integrity check should have caught this; the
      // throw is a defence-in-depth assertion the registry's discriminator
      // contract holds.
      throw new Error(
        `live-poll-open-text static-fallback: aggregation.kind '${aggregation.kind}' did not match expected discriminant`,
      );
    }
    return renderLivePollOpenTextStaticFallback({
      snapshot: aggregation,
      context,
    });
  },
);

// Side-effect 3: ClipDefinition for renderer-core dispatch.
registerAudienceClipDefinition(LIVE_POLL_OPEN_TEXT_KIND, livePollOpenTextClipDefinition);

// Re-exports — the public surface of the clip module.
export {
  LIVE_POLL_OPEN_TEXT_KIND,
  livePollOpenTextClipDefinition,
} from './clip-definition.js';
export { livePollOpenTextClipFactory } from './factory.js';
export { MANIFEST } from './manifest.js';
export {
  type LivePollOpenTextStaticFallbackContext,
  formatCountLabel,
  formatTotalLabel,
  renderLivePollOpenTextStaticFallback,
  sortEntriesByCountDesc,
} from './static-fallback.js';

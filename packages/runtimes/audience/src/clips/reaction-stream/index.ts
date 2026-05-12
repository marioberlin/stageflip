// packages/runtimes/audience/src/clips/reaction-stream/index.ts
// T-470 — Barrel + module-load auto-registration for the
// `reaction-stream` clip family. Importing this module has THREE side
// effects:
//
//   1. registers the `reactionStreamClipFactory` with
//      `audienceClipRegistry` (the live-mount path);
//   2. registers `renderReactionStreamStaticFallback` with the
//      `staticFallbackRenderer` dispatcher (the static-fallback path);
//   3. registers `reactionStreamClipDefinition` with `audienceRuntime`
//      so renderer-core's `findClip(kind)` resolves.
//
// Re-importing throws (per the registry contracts in T-454). Tests
// that need a fresh registration call the matching `__reset…` helper.

import type { ReactElement } from 'react';

import { registerAudienceClipDefinition } from '../../audience-runtime.js';
import { audienceClipRegistry } from '../../registry.js';
import { staticFallbackRenderer } from '../../static-fallback.js';
import { REACTION_STREAM_KIND, reactionStreamClipDefinition } from './clip-definition.js';
import { reactionStreamClipFactory } from './factory.js';
import {
  type ReactionStreamStaticFallbackContext,
  renderReactionStreamStaticFallback,
} from './static-fallback.js';

// Side-effect 1: live-mount factory.
audienceClipRegistry.register(REACTION_STREAM_KIND, reactionStreamClipFactory);

// Side-effect 2: static-fallback factory. The dispatcher's
// `StaticFallbackFactory` signature accepts `(input: { provenance,
// context }) => TOutput`; we narrow the discriminator + adapt the
// context shape to the per-clip context here.
staticFallbackRenderer.register<ReactionStreamStaticFallbackContext, ReactElement>(
  REACTION_STREAM_KIND,
  ({ provenance, context }) => {
    const aggregation = provenance.aggregation;
    if (aggregation.kind !== REACTION_STREAM_KIND) {
      throw new Error(
        `reaction-stream static-fallback: aggregation.kind '${aggregation.kind}' did not match expected discriminant`,
      );
    }
    return renderReactionStreamStaticFallback({
      snapshot: aggregation,
      context,
    });
  },
);

// Side-effect 3: ClipDefinition for renderer-core dispatch.
registerAudienceClipDefinition(REACTION_STREAM_KIND, reactionStreamClipDefinition);

// Re-exports — the public surface of the clip module.
export { REACTION_STREAM_KIND, reactionStreamClipDefinition } from './clip-definition.js';
export { reactionStreamClipFactory } from './factory.js';
export {
  REACTION_STREAM_FRAGMENT,
  REACTION_STREAM_MAX_PALETTE,
  REACTION_STREAM_PARTICLES_PER_EMOJI,
} from './fragment.glsl.js';
export { MANIFEST } from './manifest.js';
export {
  type ReactionStreamStaticFallbackContext,
  formatTotalReactionsLabel,
  renderReactionStreamStaticFallback,
} from './static-fallback.js';
export {
  type ReactionStreamUniforms,
  computeReactionStreamUniforms,
} from './uniforms.js';

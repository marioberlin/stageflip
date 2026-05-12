// packages/runtimes/audience/src/clips/word-cloud/index.ts
// T-467 — Barrel + module-load auto-registration for the `word-cloud`
// clip family. Importing this module has THREE side effects:
//
//   1. registers the `wordCloudClipFactory` with `audienceClipRegistry`
//      (the live-mount path);
//   2. registers `renderWordCloudStaticFallback` with the
//      `staticFallbackRenderer` dispatcher (the static-fallback path);
//   3. registers `wordCloudClipDefinition` with `audienceRuntime` so
//      renderer-core's `findClip(kind)` resolves.
//
// Re-importing throws (per the registry contracts in T-454). Tests that
// need a fresh registration call the matching `__reset…` helper.

import type { ReactElement } from 'react';

import { registerAudienceClipDefinition } from '../../audience-runtime.js';
import { audienceClipRegistry } from '../../registry.js';
import { staticFallbackRenderer } from '../../static-fallback.js';
import { WORD_CLOUD_KIND, wordCloudClipDefinition } from './clip-definition.js';
import { wordCloudClipFactory } from './factory.js';
import {
  type WordCloudStaticFallbackContext,
  renderWordCloudStaticFallback,
} from './static-fallback.js';

// Side-effect 1: live-mount factory.
audienceClipRegistry.register(WORD_CLOUD_KIND, wordCloudClipFactory);

// Side-effect 2: static-fallback factory. The dispatcher's
// `StaticFallbackFactory` signature accepts `(input: { provenance,
// context }) => TOutput`; we narrow the discriminator + adapt the
// context shape to the per-clip context here.
staticFallbackRenderer.register<WordCloudStaticFallbackContext, ReactElement>(
  WORD_CLOUD_KIND,
  ({ provenance, context }) => {
    const aggregation = provenance.aggregation;
    if (aggregation.kind !== WORD_CLOUD_KIND) {
      // The dispatcher's integrity check should have caught this; the
      // throw is a defence-in-depth assertion the registry's
      // discriminator contract holds.
      throw new Error(
        `word-cloud static-fallback: aggregation.kind '${aggregation.kind}' did not match expected discriminant`,
      );
    }
    return renderWordCloudStaticFallback({
      snapshot: aggregation,
      context,
    });
  },
);

// Side-effect 3: ClipDefinition for renderer-core dispatch.
registerAudienceClipDefinition(WORD_CLOUD_KIND, wordCloudClipDefinition);

// Re-exports — the public surface of the clip module.
export { WORD_CLOUD_KIND, wordCloudClipDefinition } from './clip-definition.js';
export { wordCloudClipFactory } from './factory.js';
export { MANIFEST } from './manifest.js';
export {
  type WordCloudStaticFallbackContext,
  fontSizeForWeight,
  formatSubmissionsLabel,
  renderWordCloudStaticFallback,
} from './static-fallback.js';

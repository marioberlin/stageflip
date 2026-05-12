// packages/runtimes/audience/src/clips/survey/index.ts
// T-468 — Barrel + module-load auto-registration for the `survey`
// clip family. Importing this module has THREE side effects:
//
//   1. registers the `surveyClipFactory` with `audienceClipRegistry`
//      (the live-mount path);
//   2. registers `renderSurveyStaticFallback` with the
//      `staticFallbackRenderer` dispatcher (the static-fallback path);
//   3. registers `surveyClipDefinition` with `audienceRuntime` so
//      renderer-core's `findClip(kind)` resolves.
//
// Re-importing throws (per the registry contracts in T-454). Tests
// that need a fresh registration call the matching `__reset…` helper.

import type { ReactElement } from 'react';

import { registerAudienceClipDefinition } from '../../audience-runtime.js';
import { audienceClipRegistry } from '../../registry.js';
import { staticFallbackRenderer } from '../../static-fallback.js';
import { SURVEY_KIND, surveyClipDefinition } from './clip-definition.js';
import { surveyClipFactory } from './factory.js';
import { type SurveyStaticFallbackContext, renderSurveyStaticFallback } from './static-fallback.js';

// Side-effect 1: live-mount factory.
audienceClipRegistry.register(SURVEY_KIND, surveyClipFactory);

// Side-effect 2: static-fallback factory. The dispatcher's
// `StaticFallbackFactory` signature accepts `(input: { provenance,
// context }) => TOutput`; we narrow the discriminator + adapt the
// context shape to the per-clip context here.
staticFallbackRenderer.register<SurveyStaticFallbackContext, ReactElement>(
  SURVEY_KIND,
  ({ provenance, context }) => {
    const aggregation = provenance.aggregation;
    if (aggregation.kind !== SURVEY_KIND) {
      throw new Error(
        `survey static-fallback: aggregation.kind '${aggregation.kind}' did not match expected discriminant`,
      );
    }
    return renderSurveyStaticFallback({
      snapshot: aggregation,
      context,
    });
  },
);

// Side-effect 3: ClipDefinition for renderer-core dispatch.
registerAudienceClipDefinition(SURVEY_KIND, surveyClipDefinition);

// Re-exports — the public surface of the clip module.
export { SURVEY_KIND, surveyClipDefinition } from './clip-definition.js';
export { surveyClipFactory } from './factory.js';
export { MANIFEST } from './manifest.js';
export {
  type SurveyStaticFallbackContext,
  formatMeanLabel,
  formatTotalResponsesLabel,
  renderSurveyStaticFallback,
} from './static-fallback.js';

// packages/runtimes/audience/src/clips/audience-ai-prompt/index.ts
// T-471 — Barrel + module-load auto-registration for the
// `audience-ai-prompt` clip family. Importing this module has THREE
// side effects:
//
//   1. registers the `audienceAiPromptClipFactory` with
//      `audienceClipRegistry` (the live-mount path);
//   2. registers `renderAudienceAiPromptStaticFallback` with the
//      `staticFallbackRenderer` dispatcher (the static-fallback path);
//   3. registers `audienceAiPromptClipDefinition` with `audienceRuntime`
//      so renderer-core's `findClip(kind)` resolves.
//
// Re-importing throws (per the registry contracts in T-454). Tests
// that need a fresh registration call the matching `__reset…` helper.

import type { ReactElement } from 'react';

import { registerAudienceClipDefinition } from '../../audience-runtime.js';
import { audienceClipRegistry } from '../../registry.js';
import { staticFallbackRenderer } from '../../static-fallback.js';
import { AUDIENCE_AI_PROMPT_KIND, audienceAiPromptClipDefinition } from './clip-definition.js';
import { audienceAiPromptClipFactory } from './factory.js';
import {
  type AudienceAiPromptStaticFallbackContext,
  renderAudienceAiPromptStaticFallback,
} from './static-fallback.js';

// Side-effect 1: live-mount factory.
audienceClipRegistry.register(AUDIENCE_AI_PROMPT_KIND, audienceAiPromptClipFactory);

// Side-effect 2: static-fallback factory. The dispatcher's
// `StaticFallbackFactory` signature accepts `(input: { provenance,
// context }) => TOutput`; we narrow the discriminator + adapt the
// context shape to the per-clip context here.
staticFallbackRenderer.register<AudienceAiPromptStaticFallbackContext, ReactElement>(
  AUDIENCE_AI_PROMPT_KIND,
  ({ provenance, context }) => {
    const aggregation = provenance.aggregation;
    if (aggregation.kind !== AUDIENCE_AI_PROMPT_KIND) {
      throw new Error(
        `audience-ai-prompt static-fallback: aggregation.kind '${aggregation.kind}' did not match expected discriminant`,
      );
    }
    return renderAudienceAiPromptStaticFallback({
      snapshot: aggregation,
      context,
      props: { targetModality: context.targetModality },
    });
  },
);

// Side-effect 3: ClipDefinition for renderer-core dispatch.
registerAudienceClipDefinition(AUDIENCE_AI_PROMPT_KIND, audienceAiPromptClipDefinition);

// Re-exports — the public surface of the clip module.
export { AUDIENCE_AI_PROMPT_KIND, audienceAiPromptClipDefinition } from './clip-definition.js';
export { audienceAiPromptClipFactory } from './factory.js';
export { MANIFEST } from './manifest.js';
export {
  type AudienceAiPromptStaticFallbackContext,
  formatTotalPromptsLabel,
  renderAudienceAiPromptStaticFallback,
} from './static-fallback.js';

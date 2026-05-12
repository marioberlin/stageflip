// packages/runtimes/audience/src/clips/audience-ai-prompt/clip-definition.ts
// T-471 — `ClipDefinition` for the `audience-ai-prompt` clip. Bridges
// renderer-core's `findClip(kind)` dispatch to the per-clip React tree.
// Wires `propsSchema` to the schema-package source of truth
// (`audienceAiPromptClipPropsSchema`) so the editor's auto-inspector +
// agent-tool plumbing can introspect the schema without re-declaring
// it here.
//
// The `render(ctx)` path is the renderer-core dispatch — it produces
// the "voting" empty state from `props` only (no live snapshot at
// renderer-core layer; the live data path is the `factory.ts` entry
// for the audience runtime).
//
// Browser-safe — pure React + Zod.

import type { ClipDefinition, ClipRenderContext } from '@stageflip/runtimes-contract';
import { type AudienceAiPromptClipProps, audienceAiPromptClipPropsSchema } from '@stageflip/schema';
import type { ReactElement } from 'react';
import type { ZodType } from 'zod';

import { renderAudienceAiPromptStaticFallback } from './static-fallback.js';

/**
 * Globally-unique kind identifier — must match the `Element.type`
 * discriminator from the schema variant + the `AudienceClipManifest.kind`
 * declaration.
 */
export const AUDIENCE_AI_PROMPT_KIND = 'audience-ai-prompt' as const;

/**
 * `ClipDefinition` plug for the `audience-ai-prompt` audience clip.
 * Registered with `audienceRuntime` via
 * `registerAudienceClipDefinition` at module-load time (see
 * `./index.ts`).
 *
 * `render(ctx)`:
 *   - With ZERO live data and ZERO provenance — renders the empty
 *     voting state (no prompts; no winner; no asset) per the
 *     static-fallback dispatcher.
 *   - The live-mount factory (`./factory.ts`) handles the streaming
 *     subscription path; this `render` is the renderer-core dispatch
 *     entry, used by export pipelines that materialise a single frame.
 */
export const audienceAiPromptClipDefinition: ClipDefinition<AudienceAiPromptClipProps> = {
  kind: AUDIENCE_AI_PROMPT_KIND,
  propsSchema: audienceAiPromptClipPropsSchema as unknown as ZodType<AudienceAiPromptClipProps>,
  render(ctx: ClipRenderContext<AudienceAiPromptClipProps>): ReactElement | null {
    const { props, width, height } = ctx;
    return renderAudienceAiPromptStaticFallback({
      snapshot: {
        kind: AUDIENCE_AI_PROMPT_KIND,
        prompts: [],
        winnerPromptId: null,
        generatedAssetCacheKey: null,
      },
      context: {
        width,
        height,
        prompt: props.prompt,
        targetModality: props.targetModality,
      },
      props: { targetModality: props.targetModality },
    });
  },
};

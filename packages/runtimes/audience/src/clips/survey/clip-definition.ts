// packages/runtimes/audience/src/clips/survey/clip-definition.ts
// T-468 — `ClipDefinition` for the `survey` clip. Bridges
// renderer-core's `findClip(kind)` dispatch to the per-clip React tree.
// Wires `propsSchema` to the schema-package source of truth
// (`surveyClipPropsSchema`) so the editor's auto-inspector +
// agent-tool plumbing can introspect the schema without re-declaring
// it here.
//
// The `render(ctx)` path is the renderer-core dispatch — it produces
// the empty-state / "Waiting for responses…" React tree from
// `props` only (no live snapshot at renderer-core layer; the live data
// path is the `factory.ts` entry for the audience runtime). When
// `ctx.props` carries no provenance the render emits the idle
// placeholder; the live mount path replaces it at subscription time.
//
// Browser-safe — pure React + Zod.

import type { ClipDefinition, ClipRenderContext } from '@stageflip/runtimes-contract';
import { type SurveyClipProps, surveyClipPropsSchema } from '@stageflip/schema';
import type { ReactElement } from 'react';
import type { ZodType } from 'zod';

import { renderSurveyStaticFallback } from './static-fallback.js';

/**
 * Globally-unique kind identifier — must match the `Element.type`
 * discriminator from the schema variant + the `AudienceClipManifest.kind`
 * declaration.
 */
export const SURVEY_KIND = 'survey' as const;

/**
 * `ClipDefinition` plug for the `survey` audience clip. Registered
 * with `audienceRuntime` via `registerAudienceClipDefinition` at
 * module-load time (see `./index.ts`).
 *
 * `render(ctx)`:
 *   - With ZERO live data and ZERO provenance — renders the
 *     "Waiting for responses…" placeholder (per the static-fallback
 *     idle routing).
 *   - The live-mount factory (`./factory.ts`) handles the streaming
 *     subscription path; this `render` is the renderer-core dispatch
 *     entry, used by export pipelines that materialise a single frame.
 */
export const surveyClipDefinition: ClipDefinition<SurveyClipProps> = {
  kind: SURVEY_KIND,
  propsSchema: surveyClipPropsSchema as unknown as ZodType<SurveyClipProps>,
  render(ctx: ClipRenderContext<SurveyClipProps>): ReactElement | null {
    const { props, width, height } = ctx;
    return renderSurveyStaticFallback({
      snapshot: {
        kind: SURVEY_KIND,
        questionAggregations: [],
        totalResponses: 0,
      },
      context: {
        width,
        height,
        questions: props.questions,
      },
    });
  },
};

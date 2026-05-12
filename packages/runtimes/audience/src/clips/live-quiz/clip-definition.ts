// packages/runtimes/audience/src/clips/live-quiz/clip-definition.ts
// T-465 — `ClipDefinition` for the `live-quiz` clip. Bridges
// renderer-core's `findClip(kind)` dispatch to the per-clip React tree.
// Wires `propsSchema` to the schema-package source of truth
// (`liveQuizClipPropsSchema`) so the editor's auto-inspector + agent-
// tool plumbing can introspect the schema without re-declaring it here.
//
// The `render(ctx)` path is the renderer-core dispatch — it produces
// the empty-state / "Waiting for next question…" React tree from
// `props` only (no live snapshot at renderer-core layer; the live data
// path is the `factory.ts` entry for the audience runtime). When
// `ctx.props` carries live data the render uses it; otherwise it
// renders an empty-state scaffold (no question results) that the live
// mount path replaces at subscription time.
//
// Browser-safe — pure React + Zod.

import type { ClipDefinition, ClipRenderContext } from '@stageflip/runtimes-contract';
import { type LiveQuizClipProps, liveQuizClipPropsSchema } from '@stageflip/schema';
import type { ReactElement } from 'react';
import type { ZodType } from 'zod';

import { renderLiveQuizStaticFallback } from './static-fallback.js';

/**
 * Globally-unique kind identifier — must match the `Element.type`
 * discriminator from the schema variant + the `AudienceClipManifest.kind`
 * declaration.
 */
export const LIVE_QUIZ_KIND = 'live-quiz' as const;

/**
 * `ClipDefinition` plug for the `live-quiz` audience clip. Registered
 * with `audienceRuntime` via `registerAudienceClipDefinition` at
 * module-load time (see `./index.ts`).
 *
 * `render(ctx)`:
 *   - With ZERO live data and ZERO provenance — renders the
 *     "Waiting for next question…" placeholder (per the static-fallback
 *     idle routing).
 *   - The live-mount factory (`./factory.ts`) handles the streaming
 *     subscription path; this `render` is the renderer-core dispatch
 *     entry, used by export pipelines that materialise a single frame.
 */
export const liveQuizClipDefinition: ClipDefinition<LiveQuizClipProps> = {
  kind: LIVE_QUIZ_KIND,
  propsSchema: liveQuizClipPropsSchema as unknown as ZodType<LiveQuizClipProps>,
  render(ctx: ClipRenderContext<LiveQuizClipProps>): ReactElement | null {
    const { props, width, height } = ctx;
    const fallbackContext: LiveQuizStaticFallbackContextLocal = {
      width,
      height,
      questions: props.questions.map((q) => ({
        id: q.id,
        text: q.text,
        options: q.options,
      })),
    };
    return renderLiveQuizStaticFallback({
      snapshot: {
        kind: LIVE_QUIZ_KIND,
        activeQuestionId: null,
        questionResults: [],
        totalVoters: 0,
      },
      context: fallbackContext,
    });
  },
};

/**
 * Local alias to keep the conditional-spread-friendly shape ergonomic
 * under `exactOptionalPropertyTypes`. Mirrors the exported context type
 * shape from `static-fallback.ts`.
 */
interface LiveQuizStaticFallbackContextLocal {
  width: number;
  height: number;
  questions?: readonly { id: string; text: string; options: readonly string[] }[];
}

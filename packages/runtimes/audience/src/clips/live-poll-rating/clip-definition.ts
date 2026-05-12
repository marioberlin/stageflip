// packages/runtimes/audience/src/clips/live-poll-rating/clip-definition.ts
// T-463 — `ClipDefinition` for the `live-poll-rating` clip. Bridges
// renderer-core's `findClip(kind)` dispatch to the per-clip React tree.
// Wires `propsSchema` to the schema-package source of truth
// (`livePollRatingClipPropsSchema`) so the editor's auto-inspector +
// agent-tool plumbing can introspect the schema without re-declaring it
// here.
//
// The `render(ctx)` path is the renderer-core dispatch — it produces
// the histogram React tree from `props` only (no live snapshot at
// renderer-core layer; the live data path is the `factory.ts` entry for
// the audience runtime). When `ctx.props` carries live data the render
// uses it; otherwise it renders an empty-state scaffold (zero counts +
// `mean: NaN`) that the live mount path replaces at subscription time.
//
// Browser-safe — pure React + Zod.

import type { ClipDefinition, ClipRenderContext } from '@stageflip/runtimes-contract';
import { type LivePollRatingClipProps, livePollRatingClipPropsSchema } from '@stageflip/schema';
import type { ReactElement } from 'react';
import type { ZodType } from 'zod';

import { renderLivePollRatingStaticFallback } from './static-fallback.js';

/**
 * Globally-unique kind identifier — must match the `Element.type`
 * discriminator from the schema variant + the `AudienceClipManifest.kind`
 * declaration.
 */
export const LIVE_POLL_RATING_KIND = 'live-poll-rating' as const;

/**
 * `ClipDefinition` plug for the `live-poll-rating` audience clip.
 * Registered with `audienceRuntime` via `registerAudienceClipDefinition`
 * at module-load time (see `./index.ts`).
 *
 * `render(ctx)`:
 *   - With ZERO live data and ZERO provenance — renders an empty-state
 *     scaffold (zero counts per score, `mean: NaN`, total 0) using the
 *     question + scaleMax from props.
 *   - The live-mount factory (`./factory.ts`) handles the streaming
 *     subscription path; this `render` is the renderer-core dispatch
 *     entry, used by export pipelines that materialise a single frame.
 */
export const livePollRatingClipDefinition: ClipDefinition<LivePollRatingClipProps> = {
  kind: LIVE_POLL_RATING_KIND,
  propsSchema: livePollRatingClipPropsSchema as unknown as ZodType<LivePollRatingClipProps>,
  render(ctx: ClipRenderContext<LivePollRatingClipProps>): ReactElement | null {
    const { props, width, height } = ctx;
    const emptyCounts = new Array(props.scaleMax).fill(0) as number[];
    const fallbackContext: LivePollRatingStaticFallbackContextLocal = {
      width,
      height,
      question: props.question,
    };
    if (props.labels !== undefined) {
      fallbackContext.labels = props.labels;
    }
    return renderLivePollRatingStaticFallback({
      snapshot: {
        kind: LIVE_POLL_RATING_KIND,
        scoreCounts: emptyCounts,
        totalVotes: 0,
        mean: Number.NaN,
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
interface LivePollRatingStaticFallbackContextLocal {
  width: number;
  height: number;
  question?: string;
  labels?: readonly string[];
}

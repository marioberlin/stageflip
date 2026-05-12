// packages/runtimes/audience/src/clips/live-qa/clip-definition.ts
// T-464 — `ClipDefinition` for the `live-qa` clip. Bridges
// renderer-core's `findClip(kind)` dispatch to the per-clip React tree.
// Wires `propsSchema` to the schema-package source of truth
// (`liveQAClipPropsSchema`) so the editor's auto-inspector + agent-tool
// plumbing can introspect the schema without re-declaring it here.
//
// The `render(ctx)` path is the renderer-core dispatch — it produces
// the empty-state question list React tree from `props` only (no live
// snapshot at renderer-core layer; the live data path is the
// `factory.ts` entry for the audience runtime). When `ctx.props`
// carries live data the render uses it; otherwise it renders an
// empty-state scaffold (zero questions) that the live mount path
// replaces at subscription time.
//
// Browser-safe — pure React + Zod.

import type { ClipDefinition, ClipRenderContext } from '@stageflip/runtimes-contract';
import { type LiveQAClipProps, liveQAClipPropsSchema } from '@stageflip/schema';
import type { ReactElement } from 'react';
import type { ZodType } from 'zod';

import { renderLiveQAStaticFallback } from './static-fallback.js';

/**
 * Globally-unique kind identifier — must match the `Element.type`
 * discriminator from the schema variant + the `AudienceClipManifest.kind`
 * declaration.
 */
export const LIVE_QA_KIND = 'live-qa' as const;

/**
 * `ClipDefinition` plug for the `live-qa` audience clip. Registered
 * with `audienceRuntime` via `registerAudienceClipDefinition` at
 * module-load time (see `./index.ts`).
 *
 * `render(ctx)`:
 *   - With ZERO live data and ZERO provenance — renders an empty-state
 *     scaffold (zero questions, total 0) using the topic from props.
 *   - The live-mount factory (`./factory.ts`) handles the streaming
 *     subscription path; this `render` is the renderer-core dispatch
 *     entry, used by export pipelines that materialise a single frame.
 */
export const liveQAClipDefinition: ClipDefinition<LiveQAClipProps> = {
  kind: LIVE_QA_KIND,
  propsSchema: liveQAClipPropsSchema as unknown as ZodType<LiveQAClipProps>,
  render(ctx: ClipRenderContext<LiveQAClipProps>): ReactElement | null {
    const { props, width, height } = ctx;
    const fallbackContext: LiveQAStaticFallbackContextLocal = {
      width,
      height,
      topic: props.topic,
    };
    return renderLiveQAStaticFallback({
      snapshot: {
        kind: LIVE_QA_KIND,
        questions: [],
        totalQuestions: 0,
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
interface LiveQAStaticFallbackContextLocal {
  width: number;
  height: number;
  topic?: string;
  now?: number;
}

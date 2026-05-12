// packages/runtimes/audience/src/clips/reaction-stream/clip-definition.ts
// T-470 — `ClipDefinition` for the `reaction-stream` clip. Bridges
// renderer-core's `findClip(kind)` dispatch to the per-clip React tree.
// Wires `propsSchema` to the schema-package source of truth
// (`reactionStreamClipPropsSchema`) so the editor's auto-inspector +
// agent-tool plumbing can introspect the schema without re-declaring
// it here.
//
// The `render(ctx)` path is the renderer-core dispatch — it produces
// the empty / "Waiting for reactions…" tree from `props` only (no live
// snapshot at renderer-core layer; the live data path is the
// `factory.ts` entry for the audience runtime).
//
// Browser-safe — pure React + Zod.

import type { ClipDefinition, ClipRenderContext } from '@stageflip/runtimes-contract';
import { type ReactionStreamClipProps, reactionStreamClipPropsSchema } from '@stageflip/schema';
import type { ReactElement } from 'react';
import type { ZodType } from 'zod';

import { renderReactionStreamStaticFallback } from './static-fallback.js';

/**
 * Globally-unique kind identifier — must match the `Element.type`
 * discriminator from the schema variant + the `AudienceClipManifest.kind`
 * declaration.
 */
export const REACTION_STREAM_KIND = 'reaction-stream' as const;

/**
 * `ClipDefinition` plug for the `reaction-stream` audience clip.
 * Registered with `audienceRuntime` via
 * `registerAudienceClipDefinition` at module-load time (see
 * `./index.ts`).
 *
 * `render(ctx)`:
 *   - With ZERO live data and ZERO provenance — renders the
 *     "Waiting for reactions…" placeholder (per the static-fallback
 *     idle routing).
 *   - The live-mount factory (`./factory.ts`) handles the streaming
 *     subscription path; this `render` is the renderer-core dispatch
 *     entry, used by export pipelines that materialise a single frame.
 */
export const reactionStreamClipDefinition: ClipDefinition<ReactionStreamClipProps> = {
  kind: REACTION_STREAM_KIND,
  propsSchema: reactionStreamClipPropsSchema as unknown as ZodType<ReactionStreamClipProps>,
  render(ctx: ClipRenderContext<ReactionStreamClipProps>): ReactElement | null {
    const { props, width, height, fps, frame, clipFrom } = ctx;
    const localFrame = Math.max(0, frame - clipFrom);
    return renderReactionStreamStaticFallback({
      snapshot: {
        kind: REACTION_STREAM_KIND,
        emojiCounts: [],
        totalReactions: 0,
      },
      context: {
        width,
        height,
        prompt: props.prompt,
        palette: props.palette,
        fps,
        localFrame,
      },
    });
  },
};

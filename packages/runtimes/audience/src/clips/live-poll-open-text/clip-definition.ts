// packages/runtimes/audience/src/clips/live-poll-open-text/clip-definition.ts
// T-462 — `ClipDefinition` for the `live-poll-open-text` clip. Bridges
// renderer-core's `findClip(kind)` dispatch to the per-clip React tree.
// Wires `propsSchema` to the schema-package source of truth
// (`livePollOpenTextClipPropsSchema`) so the editor's auto-inspector +
// agent-tool plumbing can introspect the schema without re-declaring it
// here.
//
// The `render(ctx)` path is the renderer-core dispatch — it produces
// the top-N list React tree from `props` only (no live snapshot at
// renderer-core layer; the live data path is the `factory.ts` entry for
// the audience runtime). When `ctx.props` carries live data the render
// uses it; otherwise it renders an empty-state scaffold (zero entries)
// that the live mount path replaces at subscription time.
//
// Browser-safe — pure React + Zod.

import type { ClipDefinition, ClipRenderContext } from '@stageflip/runtimes-contract';
import { type LivePollOpenTextClipProps, livePollOpenTextClipPropsSchema } from '@stageflip/schema';
import type { ReactElement } from 'react';
import type { ZodType } from 'zod';

import { renderLivePollOpenTextStaticFallback } from './static-fallback.js';

/**
 * Globally-unique kind identifier — must match the `Element.type`
 * discriminator from the schema variant + the `AudienceClipManifest.kind`
 * declaration.
 */
export const LIVE_POLL_OPEN_TEXT_KIND = 'live-poll-open-text' as const;

/**
 * `ClipDefinition` plug for the `live-poll-open-text` audience clip.
 * Registered with `audienceRuntime` via `registerAudienceClipDefinition`
 * at module-load time (see `./index.ts`).
 *
 * `render(ctx)`:
 *   - With ZERO live data and ZERO provenance — renders an empty-state
 *     scaffold (zero entries, zero responses) using the question from props.
 *   - The live-mount factory (`./factory.ts`) handles the streaming
 *     subscription path; this `render` is the renderer-core dispatch
 *     entry, used by export pipelines that materialise a single frame.
 */
export const livePollOpenTextClipDefinition: ClipDefinition<LivePollOpenTextClipProps> = {
  kind: LIVE_POLL_OPEN_TEXT_KIND,
  // Cast: the schema's `maxLength` field carries `.default(280)`, so the
  // raw `ZodType.input` includes `maxLength?: number | undefined`; the
  // `ZodType.output` matches `LivePollOpenTextClipProps`. The
  // `ClipDefinition.propsSchema` slot is typed as `ZodType<P>` (input ===
  // output), so we cast to the output-typed view. Runtime behaviour is
  // unchanged — `safeParse(rawProps)` applies defaults and yields a
  // fully-populated `LivePollOpenTextClipProps`.
  propsSchema: livePollOpenTextClipPropsSchema as unknown as ZodType<LivePollOpenTextClipProps>,
  render(ctx: ClipRenderContext<LivePollOpenTextClipProps>): ReactElement | null {
    const { props, width, height } = ctx;
    // Render the empty-state scaffold: zero entries, zero total. The
    // live-mount factory updates state with real snapshots; an export
    // pipeline that runs `render` standalone gets a deterministic
    // empty scaffold rendered from the persisted question.
    return renderLivePollOpenTextStaticFallback({
      snapshot: {
        kind: LIVE_POLL_OPEN_TEXT_KIND,
        entries: [],
        totalVotes: 0,
      },
      context: {
        width,
        height,
        question: props.question,
      },
    });
  },
};

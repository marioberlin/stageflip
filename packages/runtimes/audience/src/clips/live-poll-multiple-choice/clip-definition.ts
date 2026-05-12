// packages/runtimes/audience/src/clips/live-poll-multiple-choice/clip-definition.ts
// T-461 — `ClipDefinition` for the `live-poll-multiple-choice` clip.
// Bridges renderer-core's `findClip(kind)` dispatch to the per-clip
// React tree. Wires `propsSchema` to the schema-package source of truth
// (`livePollMultipleChoiceClipPropsSchema`) so the editor's auto-
// inspector + agent-tool plumbing can introspect the schema without
// re-declaring it here.
//
// The `render(ctx)` path is the renderer-core dispatch — it produces
// the bar-chart React tree from `props` only (no live snapshot at
// renderer-core layer; the live data path is the `factory.ts` entry
// for the audience runtime). When `ctx.props` carries a `provenance`
// snapshot the render uses it; otherwise it renders an empty-state
// scaffold that the live mount path replaces at subscription time.
//
// Browser-safe — pure React + Zod.

import type { ClipDefinition, ClipRenderContext } from '@stageflip/runtimes-contract';
import {
  type LivePollMultipleChoiceClipProps,
  livePollMultipleChoiceClipPropsSchema,
} from '@stageflip/schema';
import type { ReactElement } from 'react';

import { renderLivePollMultipleChoiceStaticFallback } from './static-fallback.js';

/**
 * Globally-unique kind identifier — must match the `Element.type`
 * discriminator from the schema variant + the `AudienceClipManifest.kind`
 * declaration.
 */
export const LIVE_POLL_MULTIPLE_CHOICE_KIND = 'live-poll-multiple-choice' as const;

/**
 * `ClipDefinition` plug for the `live-poll-multiple-choice` audience
 * clip. Registered with `audienceRuntime` via `registerAudienceClipDefinition`
 * at module-load time (see `./index.ts`).
 *
 * `render(ctx)`:
 *   - With ZERO live data and ZERO provenance — renders an empty-state
 *     scaffold (zero-bar tree) using the question + options from props.
 *   - The live-mount factory (`./factory.ts`) handles the streaming
 *     subscription path; this `render` is the renderer-core dispatch
 *     entry, used by export pipelines that materialise a single frame.
 */
export const livePollMultipleChoiceClipDefinition: ClipDefinition<LivePollMultipleChoiceClipProps> =
  {
    kind: LIVE_POLL_MULTIPLE_CHOICE_KIND,
    propsSchema: livePollMultipleChoiceClipPropsSchema,
    render(ctx: ClipRenderContext<LivePollMultipleChoiceClipProps>): ReactElement | null {
      const { props, width, height } = ctx;
      // Render the empty-state scaffold: zero counts, zero total. The
      // live-mount factory updates state with real snapshots; an export
      // pipeline that runs `render` standalone gets a deterministic
      // empty scaffold rendered from the persisted question + options.
      return renderLivePollMultipleChoiceStaticFallback({
        snapshot: {
          kind: LIVE_POLL_MULTIPLE_CHOICE_KIND,
          optionCounts: props.options.map(() => 0),
          totalVotes: 0,
        },
        context: {
          width,
          height,
          optionLabels: props.options,
          question: props.question,
        },
      });
    },
  };

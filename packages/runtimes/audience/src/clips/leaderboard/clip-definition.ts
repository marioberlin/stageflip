// packages/runtimes/audience/src/clips/leaderboard/clip-definition.ts
// T-466 — `ClipDefinition` for the `leaderboard` clip. Bridges
// renderer-core's `findClip(kind)` dispatch to the per-clip React tree.
// Wires `propsSchema` to the schema-package source of truth
// (`leaderboardClipPropsSchema`) so the editor's auto-inspector +
// agent-tool plumbing can introspect the schema without re-declaring
// it here.
//
// The `render(ctx)` path is the renderer-core dispatch — it produces
// the empty-state / "Waiting for participants…" React tree from
// `props` only (no live snapshot at renderer-core layer; the live data
// path is the `factory.ts` entry for the audience runtime). When
// `ctx.props` carries no provenance the render emits the idle
// placeholder; the live mount path replaces it at subscription time.
//
// Browser-safe — pure React + Zod.

import type { ClipDefinition, ClipRenderContext } from '@stageflip/runtimes-contract';
import { type LeaderboardClipProps, leaderboardClipPropsSchema } from '@stageflip/schema';
import type { ReactElement } from 'react';
import type { ZodType } from 'zod';

import { renderLeaderboardStaticFallback } from './static-fallback.js';

/**
 * Globally-unique kind identifier — must match the `Element.type`
 * discriminator from the schema variant + the `AudienceClipManifest.kind`
 * declaration.
 */
export const LEADERBOARD_KIND = 'leaderboard' as const;

/**
 * `ClipDefinition` plug for the `leaderboard` audience clip. Registered
 * with `audienceRuntime` via `registerAudienceClipDefinition` at
 * module-load time (see `./index.ts`).
 *
 * `render(ctx)`:
 *   - With ZERO live data and ZERO provenance — renders the
 *     "Waiting for participants…" placeholder (per the static-fallback
 *     idle routing).
 *   - The live-mount factory (`./factory.ts`) handles the streaming
 *     subscription path; this `render` is the renderer-core dispatch
 *     entry, used by export pipelines that materialise a single frame.
 */
export const leaderboardClipDefinition: ClipDefinition<LeaderboardClipProps> = {
  kind: LEADERBOARD_KIND,
  propsSchema: leaderboardClipPropsSchema as unknown as ZodType<LeaderboardClipProps>,
  render(ctx: ClipRenderContext<LeaderboardClipProps>): ReactElement | null {
    const { props, width, height } = ctx;
    const context: LeaderboardStaticFallbackContextLocal = {
      width,
      height,
      ...(props.title !== undefined ? { title: props.title } : {}),
    };
    return renderLeaderboardStaticFallback({
      snapshot: {
        kind: LEADERBOARD_KIND,
        quizId: props.quizId,
        ranking: [],
        totalParticipants: 0,
      },
      context,
    });
  },
};

/**
 * Local alias to keep the conditional-spread-friendly shape ergonomic
 * under `exactOptionalPropertyTypes`. Mirrors the exported context type
 * shape from `static-fallback.ts`.
 */
interface LeaderboardStaticFallbackContextLocal {
  width: number;
  height: number;
  title?: string;
}

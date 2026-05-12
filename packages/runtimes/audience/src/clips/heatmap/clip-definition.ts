// packages/runtimes/audience/src/clips/heatmap/clip-definition.ts
// T-469 — `ClipDefinition` for the `heatmap` clip. Bridges
// renderer-core's `findClip(kind)` dispatch to the per-clip React tree.
// Wires `propsSchema` to the schema-package source of truth
// (`heatmapClipPropsSchema`) so the editor's auto-inspector +
// agent-tool plumbing can introspect the schema without re-declaring
// it here.
//
// The `render(ctx)` path is the renderer-core dispatch — it produces
// the empty / "Waiting for taps…" tree from `props` only (no live
// snapshot at renderer-core layer; the live data path is the
// `factory.ts` entry for the audience runtime).
//
// Browser-safe — pure React + Zod.

import type { ClipDefinition, ClipRenderContext } from '@stageflip/runtimes-contract';
import { type HeatmapClipProps, heatmapClipPropsSchema } from '@stageflip/schema';
import type { ReactElement } from 'react';
import type { ZodType } from 'zod';

import { renderHeatmapStaticFallback } from './static-fallback.js';

/**
 * Globally-unique kind identifier — must match the `Element.type`
 * discriminator from the schema variant + the `AudienceClipManifest.kind`
 * declaration.
 */
export const HEATMAP_KIND = 'heatmap' as const;

/**
 * `ClipDefinition` plug for the `heatmap` audience clip. Registered
 * with `audienceRuntime` via `registerAudienceClipDefinition` at
 * module-load time (see `./index.ts`).
 *
 * `render(ctx)`:
 *   - With ZERO live data and ZERO provenance — renders the
 *     "Waiting for taps…" placeholder (per the static-fallback idle
 *     routing).
 *   - The live-mount factory (`./factory.ts`) handles the streaming
 *     subscription path; this `render` is the renderer-core dispatch
 *     entry, used by export pipelines that materialise a single frame.
 */
export const heatmapClipDefinition: ClipDefinition<HeatmapClipProps> = {
  kind: HEATMAP_KIND,
  propsSchema: heatmapClipPropsSchema as unknown as ZodType<HeatmapClipProps>,
  render(ctx: ClipRenderContext<HeatmapClipProps>): ReactElement | null {
    const { props, width, height } = ctx;
    return renderHeatmapStaticFallback({
      snapshot: {
        kind: HEATMAP_KIND,
        taps: [],
        totalTaps: 0,
        gridResolution: props.gridResolution,
      },
      context: {
        width,
        height,
        prompt: props.prompt,
        imageRef: props.imageRef,
      },
    });
  },
};

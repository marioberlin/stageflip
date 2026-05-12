// packages/runtimes/audience/src/clips/word-cloud/clip-definition.ts
// T-467 — `ClipDefinition` for the `word-cloud` clip. Bridges
// renderer-core's `findClip(kind)` dispatch to the per-clip React tree.
// Wires `propsSchema` to the schema-package source of truth
// (`wordCloudClipPropsSchema`) so the editor's auto-inspector +
// agent-tool plumbing can introspect the schema without re-declaring
// it here.
//
// The `render(ctx)` path is the renderer-core dispatch — it produces
// the empty-state / "Waiting for submissions…" React tree from
// `props` only (no live snapshot at renderer-core layer; the live data
// path is the `factory.ts` entry for the audience runtime). When
// `ctx.props` carries no provenance the render emits the idle
// placeholder; the live mount path replaces it at subscription time.
//
// Browser-safe — pure React + Zod.

import type { ClipDefinition, ClipRenderContext } from '@stageflip/runtimes-contract';
import { type WordCloudClipProps, wordCloudClipPropsSchema } from '@stageflip/schema';
import type { ReactElement } from 'react';
import type { ZodType } from 'zod';

import { renderWordCloudStaticFallback } from './static-fallback.js';

/**
 * Globally-unique kind identifier — must match the `Element.type`
 * discriminator from the schema variant + the `AudienceClipManifest.kind`
 * declaration.
 */
export const WORD_CLOUD_KIND = 'word-cloud' as const;

/**
 * `ClipDefinition` plug for the `word-cloud` audience clip. Registered
 * with `audienceRuntime` via `registerAudienceClipDefinition` at
 * module-load time (see `./index.ts`).
 *
 * `render(ctx)`:
 *   - With ZERO live data and ZERO provenance — renders the
 *     "Waiting for submissions…" placeholder (per the static-fallback
 *     idle routing).
 *   - The live-mount factory (`./factory.ts`) handles the streaming
 *     subscription path; this `render` is the renderer-core dispatch
 *     entry, used by export pipelines that materialise a single frame.
 */
export const wordCloudClipDefinition: ClipDefinition<WordCloudClipProps> = {
  kind: WORD_CLOUD_KIND,
  propsSchema: wordCloudClipPropsSchema as unknown as ZodType<WordCloudClipProps>,
  render(ctx: ClipRenderContext<WordCloudClipProps>): ReactElement | null {
    const { props, width, height } = ctx;
    const context: WordCloudStaticFallbackContextLocal = {
      width,
      height,
      prompt: props.prompt,
    };
    return renderWordCloudStaticFallback({
      snapshot: {
        kind: WORD_CLOUD_KIND,
        words: [],
        totalSubmissions: 0,
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
interface WordCloudStaticFallbackContextLocal {
  width: number;
  height: number;
  prompt?: string;
}

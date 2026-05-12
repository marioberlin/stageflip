// packages/runtimes/audience/src/clips/heatmap/index.ts
// T-469 — Barrel + module-load auto-registration for the `heatmap`
// clip family. Importing this module has THREE side effects:
//
//   1. registers the `heatmapClipFactory` with `audienceClipRegistry`
//      (the live-mount path);
//   2. registers `renderHeatmapStaticFallback` with the
//      `staticFallbackRenderer` dispatcher (the static-fallback path);
//   3. registers `heatmapClipDefinition` with `audienceRuntime` so
//      renderer-core's `findClip(kind)` resolves.
//
// Re-importing throws (per the registry contracts in T-454). Tests
// that need a fresh registration call the matching `__reset…` helper.

import type { ReactElement } from 'react';

import { registerAudienceClipDefinition } from '../../audience-runtime.js';
import { audienceClipRegistry } from '../../registry.js';
import { staticFallbackRenderer } from '../../static-fallback.js';
import { HEATMAP_KIND, heatmapClipDefinition } from './clip-definition.js';
import { heatmapClipFactory } from './factory.js';
import {
  type HeatmapStaticFallbackContext,
  renderHeatmapStaticFallback,
} from './static-fallback.js';

// Side-effect 1: live-mount factory.
audienceClipRegistry.register(HEATMAP_KIND, heatmapClipFactory);

// Side-effect 2: static-fallback factory. The dispatcher's
// `StaticFallbackFactory` signature accepts `(input: { provenance,
// context }) => TOutput`; we narrow the discriminator + adapt the
// context shape to the per-clip context here.
staticFallbackRenderer.register<HeatmapStaticFallbackContext, ReactElement>(
  HEATMAP_KIND,
  ({ provenance, context }) => {
    const aggregation = provenance.aggregation;
    if (aggregation.kind !== HEATMAP_KIND) {
      throw new Error(
        `heatmap static-fallback: aggregation.kind '${aggregation.kind}' did not match expected discriminant`,
      );
    }
    return renderHeatmapStaticFallback({
      snapshot: aggregation,
      context,
    });
  },
);

// Side-effect 3: ClipDefinition for renderer-core dispatch.
registerAudienceClipDefinition(HEATMAP_KIND, heatmapClipDefinition);

// Re-exports — the public surface of the clip module.
export { HEATMAP_KIND, heatmapClipDefinition } from './clip-definition.js';
export { heatmapClipFactory } from './factory.js';
export { MANIFEST } from './manifest.js';
export {
  type RasterizeGridResolution,
  type RasterizeTap,
  rasterizeHeatmap,
} from './rasterize.js';
export {
  type HeatmapStaticFallbackContext,
  formatTotalTapsLabel,
  renderHeatmapStaticFallback,
} from './static-fallback.js';

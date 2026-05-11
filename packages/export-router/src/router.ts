// packages/export-router/src/router.ts
// `routeExport(target, document)` — pure dispatcher consuming `EXPORT_MATRIX`
// from `@stageflip/schema` (ADR-003 §D3) and producing a typed
// `RoutingDecision` naming the per-target exporter package + render mode.
//
// The router does NOT invoke the exporters — that remains the caller's
// responsibility. The router is a routing TABLE, not an orchestrator.
//
// BROWSER-SAFE: pure function; no I/O; no Node-only imports.

import { type Document, EXPORT_MATRIX, type ExportTarget } from '@stageflip/schema';

import { detectLiveClips } from './detect-live-clips.js';
import type { ExporterPackage, RoutingDecision } from './types.js';

/**
 * Per-target exporter package mapping. The ONLY new lookup table this layer
 * defines (the static/live discriminator comes from `EXPORT_MATRIX`).
 *
 * Notes:
 *  - `mp4` + `image-sequence` share `@stageflip/export-video`.
 *  - `display-pre-rendered` + `display-interactive` + `on-device-player` +
 *    `html-slides` all flow through `@stageflip/export-html5-zip` (its
 *    orchestrator handles raster fallback + interactive bundles internally).
 *  - `live-presentation` flows through `@stageflip/export-google-slides`.
 *  - `pptx-flat` is the only PPTX target.
 *  - The three stub packages (`@stageflip/export-pdf`,
 *    `@stageflip/export-marp`, `@stageflip/export-loss-flags`) are referenced
 *    in the union type for forward-compat but no current `ExportTarget` maps
 *    to them — adding `pdf` / `marp` to the matrix later wires them in here.
 */
const EXPORTER_BY_TARGET: Readonly<Record<ExportTarget, ExporterPackage>> = {
  mp4: '@stageflip/export-video',
  'image-sequence': '@stageflip/export-video',
  'pptx-flat': '@stageflip/export-pptx',
  'html-slides': '@stageflip/export-html5-zip',
  'live-presentation': '@stageflip/export-google-slides',
  'display-pre-rendered': '@stageflip/export-html5-zip',
  'display-interactive': '@stageflip/export-html5-zip',
  'on-device-player': '@stageflip/export-html5-zip',
};

/**
 * Resolve the exporter + render mode for a `(target, document)` pair.
 *
 * Pure function. Deterministic. No I/O. The returned `RoutingDecision`
 * names which `@stageflip/export-*` package the caller should invoke and
 * which mode (`'live'` vs `'static'`) it must run in. The caller is
 * responsible for the actual `import()` / dispatch.
 *
 * The three branches:
 *  - Live target → `{ kind: 'route', mode: 'live', reason:
 *    'target_is_live_capable' }` regardless of document contents.
 *  - Static target + no live clips → `{ kind: 'route', mode: 'static',
 *    reason: 'target_is_static_only_no_live_clips' }`. Same render path as
 *    the fallback branch but no live behavior is being dropped, so no
 *    pre-export warning is needed.
 *  - Static target + live clips → `{ kind: 'fallback', mode: 'static',
 *    reason: 'target_is_static_only', liveClipsOmitted: [...] }`. The
 *    caller should surface a pre-export warning.
 */
export function routeExport(target: ExportTarget, document: Document): RoutingDecision {
  const matrixMode = EXPORT_MATRIX[target];
  const exporterPackage = EXPORTER_BY_TARGET[target];

  if (matrixMode === 'live') {
    return {
      kind: 'route',
      target,
      mode: 'live',
      exporterPackage,
      reason: 'target_is_live_capable',
    };
  }

  // matrixMode === 'static'
  const liveClipsOmitted = detectLiveClips(document);
  if (liveClipsOmitted.length === 0) {
    return {
      kind: 'route',
      target,
      mode: 'static',
      exporterPackage,
      // Target is intrinsically static; no live clips present so nothing is
      // being dropped. Same render path as the fallback branch but without a
      // pre-export warning.
      reason: 'target_is_static_only_no_live_clips',
    };
  }

  return {
    kind: 'fallback',
    target,
    mode: 'static',
    exporterPackage,
    reason: 'target_is_static_only',
    liveClipsOmitted,
  };
}

export { detectLiveClips };

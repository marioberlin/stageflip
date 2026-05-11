// packages/export-router/src/types.ts
// Public types for `@stageflip/export-router`. The `RoutingDecision` is a
// discriminated union; consumers branch on `kind` to decide what to surface
// to the user (a "live render" path, a normal "static render" path, or a
// "static fallback because target is static-only" path with the list of
// live clips that will be omitted).
//
// BROWSER-SAFE: types only; no I/O, no Node-only imports.

import type { ExportTarget, InteractiveClipFamily } from '@stageflip/schema';

/**
 * The seven exporter packages the router can dispatch to. The mapping from
 * `ExportTarget` to `ExporterPackage` is defined in `router.ts`. This union
 * is widened ahead of two stub exporter packages (export-pdf, export-marp,
 * export-loss-flags) so that adding a `pdf` / `marp` `ExportTarget` later is
 * a coordinated edit at one site (the matrix in `@stageflip/schema`) and one
 * lookup in the router — not a `RoutingDecision` shape change.
 */
export type ExporterPackage =
  | '@stageflip/export-video'
  | '@stageflip/export-pptx'
  | '@stageflip/export-html5-zip'
  | '@stageflip/export-google-slides'
  | '@stageflip/export-pdf'
  | '@stageflip/export-marp'
  | '@stageflip/export-loss-flags';

/**
 * One live (interactive) clip that the router observed inside a Document.
 * Used by the `'fallback'` branch to enumerate clips that the chosen
 * exporter will render via their `staticFallback` path because the export
 * target cannot mount live components.
 */
export interface OmittedLiveClip {
  readonly id: string;
  readonly family: InteractiveClipFamily;
}

/**
 * Routing decision for a `(target, document)` pair. Discriminated by `kind`:
 *
 * - `'route'` + `mode: 'live'` — target is live-capable per `EXPORT_MATRIX`;
 *   exporter mounts `liveMount` components. Document may or may not contain
 *   live clips; either way the live render path applies.
 *
 * - `'route'` + `mode: 'static'` — either the target is static-only AND the
 *   document has no live clips (so no fallback semantics need surfacing), or
 *   the document has no live clips and the target happens to be static. The
 *   exporter renders the document as-is.
 *
 * - `'fallback'` + `mode: 'static'` — target is static-only AND the document
 *   contains at least one live clip. The exporter is invoked but only the
 *   `staticFallback` of every interactive clip is rendered. The
 *   `liveClipsOmitted` array names every clip whose live behavior is dropped
 *   so the caller can surface a pre-export warning.
 */
export type RoutingDecision =
  | {
      readonly kind: 'route';
      readonly target: ExportTarget;
      readonly mode: 'live';
      readonly exporterPackage: ExporterPackage;
      readonly reason: 'target_is_live_capable';
    }
  | {
      readonly kind: 'route';
      readonly target: ExportTarget;
      readonly mode: 'static';
      readonly exporterPackage: ExporterPackage;
      readonly reason: 'target_is_static_only_no_live_clips';
    }
  | {
      readonly kind: 'fallback';
      readonly target: ExportTarget;
      readonly mode: 'static';
      readonly exporterPackage: ExporterPackage;
      readonly reason: 'target_is_static_only';
      readonly liveClipsOmitted: ReadonlyArray<OmittedLiveClip>;
    };

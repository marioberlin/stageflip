// packages/schema/src/clips/export-targets.ts
// ExportTarget enum + EXPORT_MATRIX + resolveClipPath — pins ADR-003 §D3
// routing so every consumer of the export matrix (per-target exporters,
// renderer-cdp interactive host, on-device player) routes interactive
// clips identically.
//
// BROWSER-SAFE: pure Zod + a constant lookup. No I/O. No `fs` / `path` /
// `child_process`. Per `feedback_t304_lessons.md`, this surface is bundled
// into browser apps via `@stageflip/schema`.
//
// `resolveClipPath(target, clip)` accepts the clip parameter for
// forward-compat: a future per-clip override could short-circuit the matrix
// (e.g., a specific family that cannot run on `display-interactive`). The
// v1 implementation is target-only — see the function body.

import { z } from 'zod';

import type { InteractiveClip } from './interactive.js';

/**
 * The eight export targets the matrix routes. Closed enum; adding a target
 * is an ADR-003 §D3 amendment plus a coordinated change to every per-target
 * exporter.
 *
 * Per ADR-003 §D3:
 * - `mp4` / `image-sequence` / `pptx-flat` / `display-pre-rendered` — render
 *   the deterministic `staticFallback` via frame-runtime.
 * - `html-slides` / `live-presentation` / `display-interactive` /
 *   `on-device-player` — mount the live `liveMount` component via the
 *   interactive runtime tier.
 */
export const exportTargetSchema = z.enum([
  'mp4',
  'image-sequence',
  'pptx-flat',
  'html-slides',
  'live-presentation',
  'display-pre-rendered',
  'display-interactive',
  'on-device-player',
]);
export type ExportTarget = z.infer<typeof exportTargetSchema>;

/** Which path of the InteractiveClip the export pipeline must render. */
export type ResolvedClipPath = 'static' | 'live';

/**
 * The export matrix per ADR-003 §D3 — pinned. Every member of
 * `exportTargetSchema.options` must have an entry; the test suite asserts
 * coverage. Adding a target requires updating both the enum and this table
 * in the same change.
 */
export const EXPORT_MATRIX: Readonly<Record<ExportTarget, ResolvedClipPath>> = {
  mp4: 'static',
  'image-sequence': 'static',
  'pptx-flat': 'static',
  'html-slides': 'live',
  'live-presentation': 'live',
  'display-pre-rendered': 'static',
  'display-interactive': 'live',
  'on-device-player': 'live',
};

/**
 * Resolve an `InteractiveClip` to its `static` or `live` path for the given
 * export `target`. v1 is target-only; the `clip` parameter is reserved for a
 * future per-clip override (e.g., a family that cannot run live on a
 * specific target). Such an override is an ADR-003 §D3 amendment.
 */
export function resolveClipPath(target: ExportTarget, _clip: InteractiveClip): ResolvedClipPath {
  return EXPORT_MATRIX[target];
}

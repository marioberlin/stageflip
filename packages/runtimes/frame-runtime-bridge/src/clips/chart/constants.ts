// packages/runtimes/frame-runtime-bridge/src/clips/chart/constants.ts
// Shared constants for the T-406 chart clip family. ALL hex literals
// for default palette colors live here; per-kind renderer files
// import from this module so the AC #16 grep test (which scans the
// renderer files only) stays clean.

import { cubicBezier } from '@stageflip/frame-runtime';

/**
 * Per-bar / per-slice / per-point / per-series stagger frames. Same
 * value used across all 7 chart kinds per T-406 D-T406-4 + AC #15.
 * The T-396-class spec authors `STAGGER_FRAMES` as a single shared
 * export; per-renderer redeclaration is rejected.
 */
export const STAGGER_FRAMES = 5;

/**
 * Fraction of the clip duration over which the entrance animation
 * runs. Animations complete by `floor(ENTRANCE_FRACTION × durationInFrames)`
 * per AC #13. Same value used across all 7 chart kinds. Matches the
 * existing `chart-build.tsx` precedent (T-131b.1).
 */
export const ENTRANCE_FRACTION = 0.6;

/**
 * Easing function shared with `chart-build.tsx` (T-131b.1). The
 * `EASE_OUT_EXPO` constant is re-exported here rather than imported
 * from `chart-build.tsx` because that module declares it as a
 * file-local const (not an export). Re-declaring the same
 * `cubicBezier` arguments in this shared module is the cleanest path.
 */
export const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);

/**
 * Canonical chart canvas dimensions. The renderers compute SVG
 * coordinates against this canvas and the clip is rendered into a
 * container whose width/height come from `useVideoConfig()`. The SVG
 * is scaled via `viewBox` so it adapts to the actual clip size.
 */
export const CANVAS_W = 1920;
export const CANVAS_H = 1080;

/** Standard inner padding for axes / charts with axes. */
export const PADDING = { top: 80, right: 60, bottom: 80, left: 90 };

/**
 * Palette type — what every renderer expects. 8 series colors, plus
 * axis / gridline / text colors. Per AC #17 the `themeSlots` on
 * `chartClip` enumerates all 11 keys.
 */
export interface Palette {
  /** Series colors. Indexed by `seriesIndex % 8`. */
  series: readonly [string, string, string, string, string, string, string, string];
  /** Axis-line color. */
  axis: string;
  /** Gridline color. */
  gridline: string;
  /** Text / label color. */
  text: string;
}

/**
 * Default palette used when no `themeTokens` resolution overrides
 * the values. The `defineFrameClip` `themeSlots` mechanism resolves
 * theme tokens at render time; this palette is the fallback when
 * the document has no theme applied (or when a slot is unresolved).
 *
 * All hex literals for the chart family live in this file; renderer
 * files contain no hex strings (pinned by AC #16 grep test).
 */
export const DEFAULT_PALETTE: Palette = {
  series: ['#0072e5', '#ff6b35', '#22c55e', '#a855f7', '#eab308', '#ec4899', '#06b6d4', '#84cc16'],
  axis: '#999999',
  gridline: '#f0f0f0',
  text: '#ebf1fa',
};

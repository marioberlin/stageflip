// packages/pack-trial/src/watermark.ts
// T-505 — Watermark policy library. Ships the canonical text + the
// `WatermarkRequest` interface consumers (renderer-core, downstream)
// honour. The visual rendering itself is OUT OF SCOPE — this module
// declares the data shape only.

/**
 * Canonical watermark text emitted for every trial-mode pack. Renderer
 * integrations must use exactly this string (no localisation today;
 * the trial UX is publisher-facing in en-US only per the T-505 spec).
 */
export const WATERMARK_TEXT = 'StageFlip trial — purchase for production use';

/**
 * Watermark anchor on the rendered frame. Renderer integrations
 * translate this to absolute coordinates based on canvas size.
 */
export type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * Data shape downstream renderers consume to draw the trial watermark.
 * Frozen — callers must not mutate the returned object; obtain a new
 * one via `defaultWatermarkRequest()` if you need to override.
 */
export interface WatermarkRequest {
  readonly text: string;
  /** Alpha channel for the watermark text, in [0, 1]. */
  readonly opacity: number;
  readonly position: WatermarkPosition;
}

/** Default opacity — subtle but legible at 1080p. */
const DEFAULT_OPACITY = 0.18;

/** Default anchor — bottom-right is the convention for trial overlays. */
const DEFAULT_POSITION: WatermarkPosition = 'bottom-right';

/**
 * Build the default trial-mode watermark request. Returns a frozen
 * object so callers cannot accidentally mutate the policy. Each call
 * returns a fresh frozen object — safe to retain across frames.
 */
export function defaultWatermarkRequest(): WatermarkRequest {
  return Object.freeze({
    text: WATERMARK_TEXT,
    opacity: DEFAULT_OPACITY,
    position: DEFAULT_POSITION,
  });
}

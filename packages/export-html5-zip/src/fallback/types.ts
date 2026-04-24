// packages/export-html5-zip/src/fallback/types.ts
// T-204 — fallback-generator contracts. The generator produces the
// static PNG + animated GIF that satisfy the IAB backup-image
// requirement (see concepts/display-budget §"Fallback asset"); the
// actual pixel-level rendering is delegated to a pluggable
// `FrameRenderer`. T-204 ships a mock renderer + (future) a renderer-
// cdp adapter wires the real rendering pipeline.

import type { BannerSize } from '../types.js';

/** One frame's raw RGBA pixel data. */
export interface RgbaFrame {
  readonly width: number;
  readonly height: number;
  /**
   * Tight RGBA buffer. Length must equal `width * height * 4`. Byte
   * order is R, G, B, A per pixel — matches the 8-bit RGBA8 Canvas +
   * PNG conventions.
   */
  readonly bytes: Uint8Array;
}

/**
 * Pluggable per-frame renderer. The fallback generator asks for one
 * frame at the midpoint for the static PNG and N frames evenly spaced
 * for the animated GIF. Implementations decide how to produce RGBA:
 * the real adapter drives a CDP session; the test mock returns a
 * pre-built buffer.
 */
export interface FrameRenderer {
  /**
   * Render one frame of the composition at `size` and `frameIndex`.
   * `frameIndex` is 0-based against the composition's frame count
   * (durationMs × fps / 1000).
   */
  renderFrame(size: BannerSize, frameIndex: number): Promise<RgbaFrame>;
}

/** Options for the fallback generator. */
export interface FallbackGeneratorOptions {
  /**
   * Frames per second used when translating the composition's
   * `durationMs` into frame indices. Defaults to 30 — matches the
   * implicit 30fps timeline RIR uses for display compositions.
   */
  readonly fps?: number;
  /**
   * How many frames to sample for the animated GIF. Default 8. Set to
   * 0 to skip the GIF entirely (static PNG only).
   */
  readonly gifFrameCount?: number;
  /**
   * Frame-indices for the GIF as a fraction of the composition: 0
   * skips the first frame, 1 includes the last. Default covers [0.125,
   * 0.875] so the loop feels centred.
   */
  readonly gifStartFraction?: number;
  readonly gifEndFraction?: number;
  /**
   * GIF frame delay in milliseconds. Default 250 (4 fps) — low enough
   * to loop politely without flicker.
   */
  readonly gifFrameDelayMs?: number;
}

// apps/stageflip-slide/src/components/timeline/timeline-math.ts
// Frame ↔ pixel conversion + snap + tick-spacing helpers (T-126).

/**
 * The timeline renders a linear layout where the x-axis is frames and
 * 1 second == `pxPerSecond` pixels. All component-level math routes
 * through these pure functions so the panel / ruler / scrubber / track
 * components stay dumb and deterministic.
 */

export interface TimelineScale {
  /** Frames per second on the composition timeline. */
  fps: number;
  /** Pixels per second on screen. */
  pxPerSecond: number;
}

/** Convert an absolute frame number to a pixel offset from the ruler start. */
export function frameToPx(frame: number, scale: TimelineScale): number {
  return (frame / scale.fps) * scale.pxPerSecond;
}

/** Convert a pixel offset (relative to the ruler start) to an integer frame. */
export function pxToFrame(px: number, scale: TimelineScale): number {
  const exact = (px / scale.pxPerSecond) * scale.fps;
  return Math.max(0, Math.round(exact));
}

/**
 * Snap a frame to the nearest increment. `snapFrames` is typically the
 * per-tick frame count (e.g. 15 = quarter-second at 60fps). A value
 * of 0 or 1 disables snap and returns the frame unchanged.
 */
export function snapFrame(frame: number, snapFrames: number): number {
  if (snapFrames <= 1) return Math.round(frame);
  return Math.round(frame / snapFrames) * snapFrames;
}

/**
 * Return the tick-mark interval in frames for the current scale. Used
 * by the ruler to pick sensible label spacing at different zooms:
 *
 *   very wide (>= 200 px/sec)  → every quarter second
 *   normal   (>=  80 px/sec)   → every second
 *   narrow   (>=  30 px/sec)   → every 2 seconds
 *   very narrow                → every 5 seconds
 */
export function rulerTickFrames(scale: TimelineScale): number {
  if (scale.pxPerSecond >= 200) return Math.max(1, Math.round(scale.fps / 4));
  if (scale.pxPerSecond >= 80) return scale.fps;
  if (scale.pxPerSecond >= 30) return scale.fps * 2;
  return scale.fps * 5;
}

/**
 * Format a frame number as a human label for ruler ticks and the
 * scrubber read-out. Returns seconds when the value falls on an
 * integer second (`1.0s`) and otherwise pads to one decimal
 * (`0.5s`, `2.3s`).
 */
export function formatFrameLabel(frame: number, fps: number): string {
  if (fps <= 0 || !Number.isFinite(fps)) return `${frame}f`;
  const seconds = frame / fps;
  if (Math.abs(seconds - Math.round(seconds)) < 1e-6) return `${Math.round(seconds)}s`;
  return `${seconds.toFixed(1)}s`;
}

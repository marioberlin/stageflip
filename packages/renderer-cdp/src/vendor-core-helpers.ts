// packages/renderer-cdp/src/vendor-core-helpers.ts
// Reimpl of the two @hyperframes/core helpers that the vendored engine
// (packages/renderer-cdp/vendor/engine/) re-exports. The engine itself uses
// them in frame-capture (quantization) and screenshot-injection (the CSS
// property whitelist). We reimplement here so T-080's vendored engine has
// a working @hyperframes/core substitute without a second vendor payload.
//
// Escalation: docs/escalation-T-083.md §B3 option (a).
// Modification protocol: THIRD_PARTY.md §2.
// Upstream studied (Apache-2.0): reference/hyperframes/packages 2/core/src/
//   inline-scripts/parityContract.ts — algorithm and property set are the
//   public CSS spec + the standard floor-with-epsilon frame-quantization
//   math; reimplemented from that spec, not copied.

/**
 * CSS property names the vendored engine's screenshot injector copies from
 * a live <video>/<audio> node to a captured image. Mirrors the set the
 * upstream engine expects so its `copyMediaVisualStyles` call-site works
 * unchanged when linked against this module.
 */
export const MEDIA_VISUAL_STYLE_PROPERTIES = [
  'width',
  'height',
  'top',
  'left',
  'right',
  'bottom',
  'inset',
  'object-fit',
  'object-position',
  'z-index',
  'opacity',
  'visibility',
  'filter',
  'mix-blend-mode',
  'backdrop-filter',
  'border-radius',
  'overflow',
  'clip-path',
  'mask',
  'mask-image',
  'mask-size',
  'mask-position',
  'mask-repeat',
  'transform',
  'transform-origin',
  'box-sizing',
] as const;

export type MediaVisualStyleProperty = (typeof MEDIA_VISUAL_STYLE_PROPERTIES)[number];

/**
 * Snap a time in seconds to the nearest frame boundary for `fps`. Returns
 * seconds (the frame's start time). NaN / non-finite / non-positive inputs
 * are clamped: `fps` falls back to 30; `timeSeconds` floors to 0. The `1e-9`
 * epsilon absorbs floating-point drift so `t = k/fps` round-trips exactly
 * when `t` is already frame-aligned.
 *
 * Must stay behaviourally identical to the vendored engine's call sites
 * (frameCapture.ts line 13) — an off-by-one here shifts every captured
 * frame.
 */
export function quantizeTimeToFrame(timeSeconds: number, fps: number): number {
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30;
  const safeTime = Number.isFinite(timeSeconds) && timeSeconds > 0 ? timeSeconds : 0;
  const frameIndex = Math.floor(safeTime * safeFps + 1e-9);
  return frameIndex / safeFps;
}

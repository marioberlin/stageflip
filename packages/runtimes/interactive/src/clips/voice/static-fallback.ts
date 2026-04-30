// packages/runtimes/interactive/src/clips/voice/static-fallback.ts
// `defaultVoiceStaticFallback` — deterministic Element[] generator for the
// `family: 'voice'` clip's `staticFallback` default per T-388 D-T388-2 +
// D-T388-3. When the harness routes to the static path AND the clip's
// authored `staticFallback` is empty, the harness substitutes the result
// of this function: an SVG-waveform-silhouette ImageElement plus an
// optional centred TextElement carrying the host-supplied `posterText`.
//
// DETERMINISM (AC #4 / #15): byte-for-byte equality across calls is the
// architectural floor. The function uses ONLY:
//   - The seeded PRNG primitive at `../../prng.js` (T-388 D-T388-3) for
//     bar-height variation. Same seed → same sequence by construction
//     (xorshift32, pinned by the regression fingerprint in `prng.test.ts`).
//   - String concatenation + `encodeURIComponent` for the data URL.
// No `Math.random`, no `Date.now`, no `performance.now`. Path lives at
// `clips/voice/**`, outside the shader sub-rule's matched prefixes; the
// broad §3 rule's interactive-tier exemption applies but the generator
// chooses to comply anyway because byte-for-byte equality is the
// architectural floor.
//
// Browser-safe AND Node-safe: pure string + integer arithmetic. No DOM,
// no canvas. Node imports are absent.

import type { Element, ImageElement, TextElement, Transform } from '@stageflip/schema';

import { createSeededPRNG } from '../../prng.js';
import type { StaticFallbackGenerator } from '../../static-fallback-registry.js';

/**
 * Args to {@link defaultVoiceStaticFallback}. Width/height are required;
 * `posterText` and `silhouetteSeed` are optional.
 */
export interface DefaultVoiceStaticFallbackArgs {
  /** Image bounding box width (canvas px). */
  width: number;
  /** Image bounding box height (canvas px). */
  height: number;
  /**
   * Optional overlay copy. When present, a centred TextElement is
   * appended to the returned Element[]; absent → image-only.
   */
  posterText?: string;
  /**
   * PRNG seed driving bar-height variation. Default 0; pinned so the
   * "no-args" output is byte-stable.
   */
  silhouetteSeed?: number;
}

/** Number of bars across the silhouette. Pinned for determinism. */
const BAR_COUNT = 32;
/** Bar fill colour — neutral grey, theme-agnostic. */
const BAR_FILL = '#888888';
/** SVG background colour — light grey. */
const BACKGROUND_FILL = '#f0f0f0';
/** Maximum bar-height fraction of the canvas height (0..1). */
const BAR_MAX_HEIGHT_FRACTION = 0.4;
/** Minimum bar-height fraction of the canvas height (0..1). Floor for the PRNG draw. */
const BAR_MIN_HEIGHT_FRACTION = 0.1;

/**
 * Build the default `staticFallback` Element[] for a `family: 'voice'`
 * clip. See file header for the determinism contract.
 *
 * Returns an Element[] (typed at the TypeScript layer) — NOT round-tripped
 * through Zod. The harness's `renderStaticFallback` consumes the array
 * directly. Author-supplied schemas validate at clip-creation time;
 * this default runs at mount time and bypasses the same path.
 */
export function defaultVoiceStaticFallback(args: DefaultVoiceStaticFallbackArgs): Element[] {
  const width = args.width;
  const height = args.height;
  const seed = args.silhouetteSeed ?? 0;
  const posterText = args.posterText;

  // 1. Build the SVG silhouette (string concatenation; no DOM).
  const svg = buildSilhouetteSvg({ width, height, seed });
  const dataUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;

  // 2. Build the ImageElement. Transform spans the full bounding box.
  const imageTransform: Transform = {
    x: 0,
    y: 0,
    width,
    height,
    rotation: 0,
    opacity: 1,
  };
  const image: ImageElement = {
    id: 'voice-static-fallback-image',
    transform: imageTransform,
    visible: true,
    locked: false,
    animations: [],
    type: 'image',
    src: dataUrl as ImageElement['src'],
    fit: 'cover',
  };

  if (posterText === undefined) {
    return [image];
  }

  // 3. Build the centred TextElement. Width/height of the text bounding
  //    box are heuristic — we don't ship a font metrics engine here; the
  //    actual glyph rendering is the renderer's job. We pick a reasonable
  //    overlay band (60% of width, 20% of height) and centre it. AC #9
  //    only pins centre alignment within ±1 px, which the maths below
  //    satisfies for any positive width/height.
  const textWidth = width * 0.6;
  const textHeight = height * 0.2;
  const textTransform: Transform = {
    x: (width - textWidth) / 2,
    y: (height - textHeight) / 2,
    width: textWidth,
    height: textHeight,
    rotation: 0,
    opacity: 1,
  };
  const text: TextElement = {
    id: 'voice-static-fallback-text',
    transform: textTransform,
    visible: true,
    locked: false,
    animations: [],
    type: 'text',
    text: posterText,
    align: 'center',
  };

  return [image, text];
}

/**
 * Build the SVG markup string. Pure string concatenation; deterministic
 * given the same `(width, height, seed)`.
 */
function buildSilhouetteSvg(args: {
  width: number;
  height: number;
  seed: number;
}): string {
  const { width, height, seed } = args;
  const prng = createSeededPRNG(seed);
  const barWidth = width / BAR_COUNT;
  const innerWidthFraction = 0.6; // bar fills 60% of its slot, gap = 40%.
  const renderedBarWidth = barWidth * innerWidthFraction;
  const barOffsetWithinSlot = (barWidth - renderedBarWidth) / 2;
  const centerY = height / 2;

  const rects: string[] = [];
  for (let i = 0; i < BAR_COUNT; i += 1) {
    const draw = prng.random();
    const fraction = clamp(draw, BAR_MIN_HEIGHT_FRACTION, 1) * BAR_MAX_HEIGHT_FRACTION;
    const barHeight = height * fraction;
    const x = i * barWidth + barOffsetWithinSlot;
    const y = centerY - barHeight / 2;
    // Numbers are formatted via `toFixed(3)` so different floating-point
    // representations (e.g., 0.1 + 0.2 quirks) cannot drift the markup
    // across runs. The fixed precision is well within sub-pixel accuracy
    // at the supported resolution range (≤ 8K).
    rects.push(
      `<rect x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${renderedBarWidth.toFixed(3)}" height="${barHeight.toFixed(3)}" fill="${BAR_FILL}" />`,
    );
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="${BACKGROUND_FILL}" />`,
    ...rects,
    '</svg>',
  ].join('');
}

/** Standard scalar clamp (no Math.random involved). */
function clamp(value: number, lo: number, hi: number): number {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

/**
 * `StaticFallbackGenerator` wrapper for `family: 'voice'` per T-388a
 * D-T388a-2. Reads `posterText` from `clip.liveMount.props`, calls
 * `defaultVoiceStaticFallback` with the clip's transform-derived
 * dimensions, and emits the `voice-clip.static-fallback.rendered`
 * telemetry event with the same shape T-388 pinned (AC #14 privacy:
 * `posterTextLength` is the integer length, never the body).
 *
 * Exported so `clips/voice/index.ts` (the production side-effect
 * registration site) and tests share the same wrapper — no drift between
 * the registered behaviour and what tests assert against.
 */
export const voiceStaticFallbackGenerator: StaticFallbackGenerator = ({
  clip,
  reason,
  emitTelemetry,
}) => {
  const props = (clip.liveMount.props ?? {}) as { posterText?: unknown };
  const posterText = typeof props.posterText === 'string' ? props.posterText : undefined;
  const generated = defaultVoiceStaticFallback({
    width: clip.transform.width,
    height: clip.transform.height,
    ...(posterText !== undefined ? { posterText } : {}),
  });
  emitTelemetry('voice-clip.static-fallback.rendered', {
    family: clip.family,
    reason,
    width: clip.transform.width,
    height: clip.transform.height,
    // Privacy posture (T-388 AC #14): integer length, never the body.
    posterTextLength: posterText !== undefined ? posterText.length : 0,
  });
  return generated;
};

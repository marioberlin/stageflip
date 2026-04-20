// packages/frame-runtime/src/interpolate-colors.ts
// interpolateColors(input, inputRange, outputColors, opts?): string
// Maps an input scalar from a monotonic input range to a color string,
// interpolating between the paired outputColors in a chosen color space
// (rgb, hsl, oklch). Pure, deterministic — scanned by check-determinism.
//
// Parsing is delegated to `culori` (MIT, 4.0.2). All format output is emitted
// by this module with a stable shape (lowercase #rrggbb or
// `rgba(R, G, B, A)`) so snapshot tests are not at the mercy of culori's
// formatter choices. Alpha is always linear regardless of the colorSpace.

import { converter, parse } from 'culori';

import { type EasingFn, linear } from './easings.js';
import type { ExtrapolationMode, InterpolateOptions } from './interpolate.js';

/** Color spaces supported for interpolation. */
export type ColorSpace = 'rgb' | 'hsl' | 'oklch';

export interface InterpolateColorsOptions extends InterpolateOptions {
  /** Color space in which channel interpolation is performed. Default 'rgb'. */
  colorSpace?: ColorSpace;
}

/** Internal representation — everything is mixed as rgb-gamut plus separate alpha. */
interface Rgba {
  r: number;
  g: number;
  b: number;
  alpha: number;
}

/** The intermediate mix-space representation. Hue-carrying spaces use h/s/l or l/c/h. */
interface ChannelColor {
  /** First channel: r for rgb, h for hsl, l for oklch. */
  c0: number;
  /** Second channel: g for rgb, s for hsl, c for oklch. */
  c1: number;
  /** Third channel: b for rgb, l for hsl, h for oklch. */
  c2: number;
  alpha: number;
}

const VALID_SPACES: ReadonlySet<ColorSpace> = new Set(['rgb', 'hsl', 'oklch']);

/**
 * Map `input` to a color string by interpolating between `outputColors`.
 *
 * @param input The value to map.
 * @param inputRange Strictly monotonic ascending array of at least 2 numbers.
 * @param outputColors Parseable color strings (hex, named, rgb(), hsl(), etc.).
 *   Same length as `inputRange`.
 * @param options Optional easing, extrapolation, and color-space settings.
 *
 * @returns `#rrggbb` when the interpolated alpha is 1, else `rgba(R, G, B, A)`.
 *
 * @throws If inputs are invalid, any color cannot be parsed, or the color
 *   space is not one of `'rgb' | 'hsl' | 'oklch'`.
 */
export function interpolateColors(
  input: number,
  inputRange: readonly number[],
  outputColors: readonly string[],
  options: InterpolateColorsOptions = {},
): string {
  if (inputRange.length < 2) {
    throw new Error('interpolateColors: inputRange must have at least 2 points');
  }
  if (inputRange.length !== outputColors.length) {
    throw new Error(
      `interpolateColors: inputRange.length (${inputRange.length}) must equal outputColors.length (${outputColors.length})`,
    );
  }
  for (let i = 1; i < inputRange.length; i++) {
    const prev = inputRange[i - 1];
    const cur = inputRange[i];
    if (prev === undefined || cur === undefined || prev >= cur) {
      throw new Error(
        `interpolateColors: inputRange must be strictly ascending (failed at index ${i})`,
      );
    }
  }
  if (Number.isNaN(input)) {
    throw new Error('interpolateColors: input must not be NaN');
  }

  const colorSpace = options.colorSpace ?? 'rgb';
  if (!VALID_SPACES.has(colorSpace)) {
    throw new Error(
      `interpolateColors: colorSpace must be one of 'rgb' | 'hsl' | 'oklch' (got ${String(colorSpace)})`,
    );
  }

  const easing: EasingFn = options.easing ?? linear;
  const extrapolateLeft: ExtrapolationMode = options.extrapolateLeft ?? 'extend';
  const extrapolateRight: ExtrapolationMode = options.extrapolateRight ?? 'extend';

  rejectIdentity(extrapolateLeft, 'extrapolateLeft');
  rejectIdentity(extrapolateRight, 'extrapolateRight');

  const parsed = outputColors.map((c, i) => {
    const p = parse(c);
    if (!p) {
      throw new Error(`interpolateColors: could not parse color at index ${i}: ${c}`);
    }
    return toChannelColor(p, colorSpace);
  });

  const firstIn = inputRange[0] as number;
  const lastIn = inputRange[inputRange.length - 1] as number;

  // Extrapolation — clamp is trivial; extend walks off the nearest segment
  // using the same per-segment fraction math as an interior point, which
  // naturally yields t < 0 (left) or t > 1 (right). Gamut clamping happens at
  // formatting time.
  if (input < firstIn) {
    if (extrapolateLeft === 'clamp') {
      return formatRgba(toRgba(parsed[0] as ChannelColor, colorSpace));
    }
    const secondIn = inputRange[1] as number;
    const t = (input - firstIn) / (secondIn - firstIn);
    return mixAtFraction(parsed, 0, t, colorSpace);
  }
  if (input > lastIn) {
    if (extrapolateRight === 'clamp') {
      return formatRgba(toRgba(parsed[parsed.length - 1] as ChannelColor, colorSpace));
    }
    const last = inputRange.length - 1;
    const secondLastIn = inputRange[last - 1] as number;
    const t = (input - secondLastIn) / (lastIn - secondLastIn);
    return mixAtFraction(parsed, last - 1, t, colorSpace);
  }

  // Find the segment containing input.
  let segmentIndex = 0;
  for (let i = 0; i < inputRange.length - 1; i++) {
    const nextIn = inputRange[i + 1] as number;
    if (input <= nextIn) {
      segmentIndex = i;
      break;
    }
  }

  const a = inputRange[segmentIndex] as number;
  const b = inputRange[segmentIndex + 1] as number;
  const fraction = (input - a) / (b - a);
  const eased = easing(fraction);
  return mixAtFraction(parsed, segmentIndex, eased, colorSpace);
}

function rejectIdentity(mode: ExtrapolationMode, name: string): void {
  if (mode === 'identity') {
    throw new Error(`interpolateColors: ${name}='identity' is not valid for colors`);
  }
}

const toRgbConverter = converter('rgb');
const toHslConverter = converter('hsl');
const toOklchConverter = converter('oklch');

/**
 * Convert a parsed culori color into a {c0,c1,c2,alpha} representation in the
 * chosen color space. Undefined hue is substituted with 0 (culori returns
 * `undefined` for hue on achromatic colors).
 */
function toChannelColor(color: ReturnType<typeof parse>, space: ColorSpace): ChannelColor {
  if (color === undefined) {
    throw new Error('interpolateColors: internal — parse returned undefined after guard');
  }
  const alpha = typeof color.alpha === 'number' ? color.alpha : 1;
  if (space === 'rgb') {
    const rgb = toRgbConverter(color);
    return { c0: rgb.r, c1: rgb.g, c2: rgb.b, alpha };
  }
  if (space === 'hsl') {
    const hsl = toHslConverter(color);
    return { c0: typeof hsl.h === 'number' ? hsl.h : 0, c1: hsl.s, c2: hsl.l, alpha };
  }
  // oklch
  const ok = toOklchConverter(color);
  return { c0: ok.l, c1: ok.c, c2: typeof ok.h === 'number' ? ok.h : 0, alpha };
}

/** Linear lerp for non-hue channels. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-path hue lerp (degrees). */
function lerpHue(a: number, b: number, t: number): number {
  let dh = b - a;
  if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const raw = a + dh * t;
  // Normalise to [0, 360).
  return ((raw % 360) + 360) % 360;
}

/** Mix two channel-space colors at fraction t using space-aware hue handling. */
function mixChannel(a: ChannelColor, b: ChannelColor, t: number, space: ColorSpace): ChannelColor {
  if (space === 'hsl') {
    return {
      c0: lerpHue(a.c0, b.c0, t),
      c1: lerp(a.c1, b.c1, t),
      c2: lerp(a.c2, b.c2, t),
      alpha: lerp(a.alpha, b.alpha, t),
    };
  }
  if (space === 'oklch') {
    return {
      c0: lerp(a.c0, b.c0, t),
      c1: lerp(a.c1, b.c1, t),
      c2: lerpHue(a.c2, b.c2, t),
      alpha: lerp(a.alpha, b.alpha, t),
    };
  }
  // rgb
  return {
    c0: lerp(a.c0, b.c0, t),
    c1: lerp(a.c1, b.c1, t),
    c2: lerp(a.c2, b.c2, t),
    alpha: lerp(a.alpha, b.alpha, t),
  };
}

/** Convert a channel-space color back to rgb (for formatting). */
function toRgba(color: ChannelColor, space: ColorSpace): Rgba {
  if (space === 'rgb') {
    return { r: color.c0, g: color.c1, b: color.c2, alpha: color.alpha };
  }
  if (space === 'hsl') {
    const rgb = toRgbConverter({ mode: 'hsl', h: color.c0, s: color.c1, l: color.c2 });
    return { r: rgb.r, g: rgb.g, b: rgb.b, alpha: color.alpha };
  }
  // oklch
  const rgb = toRgbConverter({ mode: 'oklch', l: color.c0, c: color.c1, h: color.c2 });
  return { r: rgb.r, g: rgb.g, b: rgb.b, alpha: color.alpha };
}

function mixAtFraction(
  parsed: readonly ChannelColor[],
  segmentIndex: number,
  t: number,
  space: ColorSpace,
): string {
  const a = parsed[segmentIndex] as ChannelColor;
  const b = parsed[segmentIndex + 1] as ChannelColor;
  const mixed = mixChannel(a, b, t, space);
  return formatRgba(toRgba(mixed, space));
}

/** Clamp n to [lo, hi]. */
function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function channelToByte(n: number): number {
  return Math.round(clamp01(n) * 255);
}

function byteToHex(n: number): string {
  return n.toString(16).padStart(2, '0');
}

function roundAlpha(n: number): number {
  return Math.round(clamp01(n) * 1000) / 1000;
}

/**
 * Stable formatter: `#rrggbb` when alpha ≥ 1, else `rgba(R, G, B, A)` with
 * integer channels and alpha rounded to 3 decimals.
 */
function formatRgba(c: Rgba): string {
  const r = channelToByte(c.r);
  const g = channelToByte(c.g);
  const b = channelToByte(c.b);
  const a = roundAlpha(c.alpha);
  if (a >= 1) {
    return `#${byteToHex(r)}${byteToHex(g)}${byteToHex(b)}`;
  }
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

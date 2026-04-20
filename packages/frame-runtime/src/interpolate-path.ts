// packages/frame-runtime/src/interpolate-path.ts
// interpolatePath(input, inputRange, outputPaths, opts?): string
// Morphs between SVG path strings by delegating 2-point interpolation to
// flubber (MIT, 0.4.2). Pure, deterministic — scanned by check-determinism.
//
// Scope:
// - Multi-point ranges work piecewise; the per-segment interpolator is
//   built on demand for the active segment only.
// - Extrapolation supports 'clamp' only. 'extend' and 'identity' are
//   rejected because there is no coherent way to extrapolate a morph
//   (flubber's interpolator clamps t internally and the geometric
//   continuation has no natural shape).

import flubber from 'flubber';

import { type EasingFn, linear } from './easings.js';
import type { ExtrapolationMode, InterpolateOptions } from './interpolate.js';

export interface InterpolatePathOptions extends InterpolateOptions {
  /**
   * Forwarded to `flubber.interpolate`. `maxSegmentLength` controls the
   * smoothness of the morph; lower values produce smoother shapes at the
   * cost of CPU. Default follows flubber's own default.
   */
  flubberOptions?: Parameters<typeof flubber.interpolate>[2];
}

/**
 * Map `input` to an SVG path string by morphing between `outputPaths`.
 *
 * @param input The value to map.
 * @param inputRange Strictly monotonic ascending array of at least 2 numbers.
 * @param outputPaths Parseable SVG path strings; same length as `inputRange`.
 * @param options Optional easing, extrapolation, and flubber settings.
 *
 * @throws If inputs fail the range/length/monotonicity check, the chosen
 *   extrapolation mode is not `'clamp'`, or any path is unparseable.
 */
export function interpolatePath(
  input: number,
  inputRange: readonly number[],
  outputPaths: readonly string[],
  options: InterpolatePathOptions = {},
): string {
  if (inputRange.length < 2) {
    throw new Error('interpolatePath: inputRange must have at least 2 points');
  }
  if (inputRange.length !== outputPaths.length) {
    throw new Error(
      `interpolatePath: inputRange.length (${inputRange.length}) must equal outputPaths.length (${outputPaths.length})`,
    );
  }
  for (let i = 1; i < inputRange.length; i++) {
    const prev = inputRange[i - 1];
    const cur = inputRange[i];
    if (prev === undefined || cur === undefined || prev >= cur) {
      throw new Error(
        `interpolatePath: inputRange must be strictly ascending (failed at index ${i})`,
      );
    }
  }
  if (Number.isNaN(input)) {
    throw new Error('interpolatePath: input must not be NaN');
  }

  const easing: EasingFn = options.easing ?? linear;
  const extrapolateLeft: ExtrapolationMode = options.extrapolateLeft ?? 'clamp';
  const extrapolateRight: ExtrapolationMode = options.extrapolateRight ?? 'clamp';

  rejectNonClamp(extrapolateLeft, 'extrapolateLeft');
  rejectNonClamp(extrapolateRight, 'extrapolateRight');

  const firstIn = inputRange[0] as number;
  const lastIn = inputRange[inputRange.length - 1] as number;

  if (input <= firstIn) {
    return buildSegment(
      outputPaths[0] as string,
      outputPaths[1] as string,
      options.flubberOptions,
    )(input < firstIn ? 0 : 0);
  }
  if (input >= lastIn) {
    const last = outputPaths.length - 1;
    return buildSegment(
      outputPaths[last - 1] as string,
      outputPaths[last] as string,
      options.flubberOptions,
    )(input > lastIn ? 1 : 1);
  }

  // Find segment containing input.
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

  const interp = buildSegment(
    outputPaths[segmentIndex] as string,
    outputPaths[segmentIndex + 1] as string,
    options.flubberOptions,
  );
  return interp(eased);
}

function rejectNonClamp(mode: ExtrapolationMode, name: string): void {
  if (mode === 'clamp') return;
  if (mode === 'identity') {
    throw new Error(`interpolatePath: ${name}='identity' is not valid for paths`);
  }
  // 'extend' and anything else fall here.
  throw new Error(
    `interpolatePath: ${name}='${mode}' is not supported — only 'clamp' works for path morphing`,
  );
}

function buildSegment(
  from: string,
  to: string,
  flubberOptions?: Parameters<typeof flubber.interpolate>[2],
): (t: number) => string {
  try {
    return flubber.interpolate(from, to, flubberOptions);
  } catch (err) {
    throw new Error(
      `interpolatePath: could not build morph interpolator (${(err as Error).message ?? String(err)})`,
    );
  }
}

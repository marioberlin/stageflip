// packages/frame-runtime/src/interpolate.ts
// interpolate(input, inputRange, outputRange, opts?): number
// Maps an input scalar from a monotonic input range to a corresponding output
// range, with configurable easing and extrapolation. Pure, deterministic —
// scanned by check-determinism.
//
// Design mirrors the shape documented in https://remotion.dev/docs/interpolate
// (per CLAUDE.md §7 rules: read public docs, reimplement from scratch).

import { type EasingFn, linear } from './easings.js';

export type ExtrapolationMode = 'extend' | 'clamp' | 'identity';

export interface InterpolateOptions {
  /** Easing applied to the per-segment fraction before output interpolation. */
  easing?: EasingFn;
  /** What to do when input is below the first inputRange point. Default 'extend'. */
  extrapolateLeft?: ExtrapolationMode;
  /** What to do when input is above the last inputRange point. Default 'extend'. */
  extrapolateRight?: ExtrapolationMode;
}

/**
 * Map `input` from `inputRange` to `outputRange`.
 *
 * @param input The value to map.
 * @param inputRange Strictly monotonic ascending array of at least 2 numbers.
 * @param outputRange Same length as `inputRange`.
 * @param options Optional easing + extrapolation settings.
 *
 * @throws If inputRange and outputRange lengths differ or inputRange isn't
 *         strictly ascending.
 */
export function interpolate(
  input: number,
  inputRange: readonly number[],
  outputRange: readonly number[],
  options: InterpolateOptions = {},
): number {
  if (inputRange.length < 2) {
    throw new Error('interpolate: inputRange must have at least 2 points');
  }
  if (inputRange.length !== outputRange.length) {
    throw new Error(
      `interpolate: inputRange.length (${inputRange.length}) must equal outputRange.length (${outputRange.length})`,
    );
  }
  for (let i = 1; i < inputRange.length; i++) {
    const prev = inputRange[i - 1];
    const cur = inputRange[i];
    if (prev === undefined || cur === undefined || prev >= cur) {
      throw new Error(`interpolate: inputRange must be strictly ascending (failed at index ${i})`);
    }
  }
  if (Number.isNaN(input)) {
    throw new Error('interpolate: input must not be NaN');
  }

  const easing = options.easing ?? linear;
  const extrapolateLeft = options.extrapolateLeft ?? 'extend';
  const extrapolateRight = options.extrapolateRight ?? 'extend';

  const firstIn = inputRange[0] as number;
  const firstOut = outputRange[0] as number;
  const lastIn = inputRange[inputRange.length - 1] as number;
  const lastOut = outputRange[outputRange.length - 1] as number;

  if (input < firstIn) {
    return applyExtrapolation(
      input,
      firstIn,
      firstOut,
      inputRange[1] as number,
      outputRange[1] as number,
      extrapolateLeft,
    );
  }
  if (input > lastIn) {
    return applyExtrapolation(
      input,
      lastIn,
      lastOut,
      inputRange[inputRange.length - 2] as number,
      outputRange[outputRange.length - 2] as number,
      extrapolateRight,
    );
  }

  // Find the segment (i, i+1) containing input.
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
  const outA = outputRange[segmentIndex] as number;
  const outB = outputRange[segmentIndex + 1] as number;

  const fraction = (input - a) / (b - a);
  const eased = easing(fraction);
  return outA + eased * (outB - outA);
}

function applyExtrapolation(
  input: number,
  nearIn: number,
  nearOut: number,
  farIn: number,
  farOut: number,
  mode: ExtrapolationMode,
): number {
  switch (mode) {
    case 'clamp':
      return nearOut;
    case 'identity':
      return input;
    case 'extend': {
      // Extrapolate linearly along the nearest segment.
      const fraction = (input - nearIn) / (farIn - nearIn);
      return nearOut + fraction * (farOut - nearOut);
    }
    default: {
      const never: never = mode;
      void never;
      return nearOut;
    }
  }
}

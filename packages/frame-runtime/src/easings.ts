// packages/frame-runtime/src/easings.ts
// 25 named easing functions. Each takes t in [0, 1] and returns a value
// that passes through (0, 0) and (1, 1). Implementations are standard
// Penner formulas; no wall-clock or random sources. Determinism gate
// scans this file.
//
// The name set matches `namedEasingSchema` in @stageflip/schema so any
// easing a clip declares in its schema resolves to a function here.

/** An easing function. Input t is normalized 0..1. Output is typically 0..1 but some overshoot. */
export type EasingFn = (t: number) => number;

const clamp01 = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t);

// ----- linear -----

export const linear: EasingFn = (t) => clamp01(t);

// ----- cubic-bezier style aliases used by CSS -----

export const ease: EasingFn = cubicBezier(0.25, 0.1, 0.25, 1.0);
export const easeIn: EasingFn = cubicBezier(0.42, 0, 1.0, 1.0);
export const easeOut: EasingFn = cubicBezier(0, 0, 0.58, 1.0);
export const easeInOut: EasingFn = cubicBezier(0.42, 0, 0.58, 1.0);

// ----- Penner family: quad / cubic / quart / quint / expo / circ -----

export const quadIn: EasingFn = (t) => t * t;
export const quadOut: EasingFn = (t) => 1 - (1 - t) * (1 - t);
export const quadInOut: EasingFn = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export const cubicIn: EasingFn = (t) => t * t * t;
export const cubicOut: EasingFn = (t) => 1 - (1 - t) ** 3;
export const cubicInOut: EasingFn = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export const quartIn: EasingFn = (t) => t ** 4;
export const quartOut: EasingFn = (t) => 1 - (1 - t) ** 4;
export const quartInOut: EasingFn = (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);

export const quintIn: EasingFn = (t) => t ** 5;
export const quintOut: EasingFn = (t) => 1 - (1 - t) ** 5;
export const quintInOut: EasingFn = (t) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2);

export const expoIn: EasingFn = (t) => (t === 0 ? 0 : 2 ** (10 * t - 10));
export const expoOut: EasingFn = (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t));
export const expoInOut: EasingFn = (t) => {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2;
};

export const circIn: EasingFn = (t) => 1 - Math.sqrt(1 - t * t);
export const circOut: EasingFn = (t) => Math.sqrt(1 - (t - 1) ** 2);
export const circInOut: EasingFn = (t) =>
  t < 0.5 ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2 : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2;

// ----- back (overshoots slightly) -----

const BACK_C1 = 1.70158;
const BACK_C3 = BACK_C1 + 1;

export const backIn: EasingFn = (t) => BACK_C3 * t * t * t - BACK_C1 * t * t;
export const backOut: EasingFn = (t) => 1 + BACK_C3 * (t - 1) ** 3 + BACK_C1 * (t - 1) ** 2;

// ----- cubic-bezier factory (used by CSS ease aliases above) -----

/**
 * Build an easing from a cubic bezier with control points (x1, y1), (x2, y2).
 * Matches the CSS spec. Uses Newton's method + binary search fallback to
 * invert x(t) = tBezier, then returns y(t). Deterministic.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  // Guard: control points' x components must be in [0, 1] for a valid easing.
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
    throw new Error(`cubicBezier: x1 and x2 must be in [0, 1]; got x1=${x1}, x2=${x2}`);
  }
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleCurveX = (t: number): number => ((ax * t + bx) * t + cx) * t;
  const sampleCurveY = (t: number): number => ((ay * t + by) * t + cy) * t;
  const sampleDerivX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx;

  const solveCurveX = (x: number, eps = 1e-6): number => {
    // Newton's method, up to 8 iterations.
    let t = x;
    for (let i = 0; i < 8; i++) {
      const fx = sampleCurveX(t) - x;
      if (Math.abs(fx) < eps) return t;
      const dfx = sampleDerivX(t);
      if (Math.abs(dfx) < 1e-12) break;
      t -= fx / dfx;
    }
    // Fallback: bisection on [0, 1].
    let lo = 0;
    let hi = 1;
    t = x;
    while (lo < hi) {
      const cx2 = sampleCurveX(t);
      if (Math.abs(cx2 - x) < eps) return t;
      if (x > cx2) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };

  return (input: number): number => {
    const x = clamp01(input);
    if (x === 0) return 0;
    if (x === 1) return 1;
    return sampleCurveY(solveCurveX(x));
  };
}

// ----- named-easing registry -----

export const NAMED_EASINGS = [
  'linear',
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'quad-in',
  'quad-out',
  'quad-in-out',
  'cubic-in',
  'cubic-out',
  'cubic-in-out',
  'quart-in',
  'quart-out',
  'quart-in-out',
  'quint-in',
  'quint-out',
  'quint-in-out',
  'expo-in',
  'expo-out',
  'expo-in-out',
  'circ-in',
  'circ-out',
  'circ-in-out',
  'back-in',
  'back-out',
] as const;

export type NamedEasing = (typeof NAMED_EASINGS)[number];

/** Lookup table from name -> function. Alphabetical-ish order for readability. */
export const EASINGS: Readonly<Record<NamedEasing, EasingFn>> = {
  linear,
  ease,
  'ease-in': easeIn,
  'ease-out': easeOut,
  'ease-in-out': easeInOut,
  'quad-in': quadIn,
  'quad-out': quadOut,
  'quad-in-out': quadInOut,
  'cubic-in': cubicIn,
  'cubic-out': cubicOut,
  'cubic-in-out': cubicInOut,
  'quart-in': quartIn,
  'quart-out': quartOut,
  'quart-in-out': quartInOut,
  'quint-in': quintIn,
  'quint-out': quintOut,
  'quint-in-out': quintInOut,
  'expo-in': expoIn,
  'expo-out': expoOut,
  'expo-in-out': expoInOut,
  'circ-in': circIn,
  'circ-out': circOut,
  'circ-in-out': circInOut,
  'back-in': backIn,
  'back-out': backOut,
};

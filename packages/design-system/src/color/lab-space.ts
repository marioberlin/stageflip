// packages/design-system/src/color/lab-space.ts
// RGB↔Lab conversion. Hand-rolled per ISO/CIE 11664-4 (D65 reference white).
// No external color libraries — keeps the package determinism-clean and
// dep-free per T-249's "no new TS deps" gate.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Lab {
  L: number;
  a: number;
  b: number;
}

/** Parse a hex literal (#rgb / #rrggbb / #rrggbbaa) to Rgb in 0..255. Alpha is ignored. */
export function parseHex(hex: string): Rgb {
  if (!hex.startsWith('#')) {
    throw new Error(`expected leading "#": ${hex}`);
  }
  const raw = hex.slice(1).toLowerCase();
  let r = 0;
  let g = 0;
  let b = 0;
  if (raw.length === 3) {
    const r3 = raw[0];
    const g3 = raw[1];
    const b3 = raw[2];
    if (r3 === undefined || g3 === undefined || b3 === undefined) {
      throw new Error(`malformed hex: ${hex}`);
    }
    r = Number.parseInt(`${r3}${r3}`, 16);
    g = Number.parseInt(`${g3}${g3}`, 16);
    b = Number.parseInt(`${b3}${b3}`, 16);
  } else if (raw.length === 6 || raw.length === 8) {
    r = Number.parseInt(raw.slice(0, 2), 16);
    g = Number.parseInt(raw.slice(2, 4), 16);
    b = Number.parseInt(raw.slice(4, 6), 16);
  } else {
    throw new Error(`hex must be 3, 6, or 8 chars after "#": ${hex}`);
  }
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    throw new Error(`invalid hex digits: ${hex}`);
  }
  return { r, g, b };
}

/** Format an Rgb (0..255 ints) as `#rrggbb`. */
export function toHex(rgb: Rgb): string {
  const r = clamp255(Math.round(rgb.r));
  const g = clamp255(Math.round(rgb.g));
  const b = clamp255(Math.round(rgb.b));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function clamp255(n: number): number {
  if (n < 0) return 0;
  if (n > 255) return 255;
  return n;
}

/**
 * sRGB (0..1) → linear-RGB (0..1) per IEC 61966-2-1.
 */
function srgbToLinear(c: number): number {
  if (c <= 0.04045) return c / 12.92;
  return ((c + 0.055) / 1.055) ** 2.4;
}

/** Linear-RGB → sRGB (0..1). */
function linearToSrgb(c: number): number {
  if (c <= 0.0031308) return 12.92 * c;
  return 1.055 * c ** (1 / 2.4) - 0.055;
}

/** D65 reference white in XYZ (per ISO/CIE 11664). */
const Xn = 0.95047;
const Yn = 1.0;
const Zn = 1.08883;

/** RGB (0..255) → XYZ (D65, 0..1). */
function rgbToXyz(rgb: Rgb): { x: number; y: number; z: number } {
  const r = srgbToLinear(rgb.r / 255);
  const g = srgbToLinear(rgb.g / 255);
  const b = srgbToLinear(rgb.b / 255);
  // sRGB → XYZ (D65) — standard 3×3 matrix from ISO/CIE 11664-4.
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;
  return { x, y, z };
}

/** XYZ (D65, 0..1) → sRGB (0..255). */
function xyzToRgb(xyz: { x: number; y: number; z: number }): Rgb {
  const { x, y, z } = xyz;
  const rl = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  const gl = x * -0.969266 + y * 1.8760108 + z * 0.041556;
  const bl = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;
  return {
    r: clamp01(linearToSrgb(rl)) * 255,
    g: clamp01(linearToSrgb(gl)) * 255,
    b: clamp01(linearToSrgb(bl)) * 255,
  };
}

function clamp01(c: number): number {
  if (c < 0) return 0;
  if (c > 1) return 1;
  return c;
}

/** XYZ → Lab. */
function fLab(t: number): number {
  const epsilon = 216 / 24389;
  const kappa = 24389 / 27;
  if (t > epsilon) return Math.cbrt(t);
  return (kappa * t + 16) / 116;
}

function fLabInverse(t: number): number {
  const epsilon = 6 / 29;
  if (t > epsilon) return t * t * t;
  return 3 * epsilon * epsilon * (t - 4 / 29);
}

/** Convert RGB (0..255) → Lab. */
export function rgbToLab(rgb: Rgb): Lab {
  const { x, y, z } = rgbToXyz(rgb);
  const fx = fLab(x / Xn);
  const fy = fLab(y / Yn);
  const fz = fLab(z / Zn);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/** Convert Lab → RGB (0..255). */
export function labToRgb(lab: Lab): Rgb {
  const fy = (lab.L + 16) / 116;
  const fx = fy + lab.a / 500;
  const fz = fy - lab.b / 200;
  const x = Xn * fLabInverse(fx);
  const y = Yn * fLabInverse(fy);
  const z = Zn * fLabInverse(fz);
  return xyzToRgb({ x, y, z });
}

/** Hex literal → Lab. */
export function hexToLab(hex: string): Lab {
  return rgbToLab(parseHex(hex));
}

/**
 * ΔE76 — straight Euclidean distance in Lab. The simplest perceptual metric;
 * sufficient for cluster matching at the threshold T-249 picks (ΔE < 5 for
 * literal-to-cluster matching during writeback).
 */
export function deltaE(a: Lab, b: Lab): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/** Normalized lightness (0..1). Used for background/foreground heuristics in step 7. */
export function lightness(lab: Lab): number {
  return Math.max(0, Math.min(1, lab.L / 100));
}

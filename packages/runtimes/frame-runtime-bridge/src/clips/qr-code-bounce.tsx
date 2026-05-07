// packages/runtimes/frame-runtime-bridge/src/clips/qr-code-bounce.tsx
// T-319 — `qr-code-bounce` runtime-clip primitive: serves Cluster G's
// Coinbase Super Bowl DVD-screensaver QR canon — a square QR-code
// rectangle traversing the screen with continuous reflective-rebound
// bounce physics + uniform rainbow hue cycling across all dark modules
// on a pure-black backdrop. NO platform enum (QR is platform-agnostic),
// NO font surface, NO phase enum (always-moving / always-cycling
// register). Single Zod object schema (strict mode); the
// `coinbase-dvd-qr` preset is the v1 consumer. Frame-deterministic
// closed-form physics: `x_t = fold(x0 + vx*t, 2*(W-rectW))`,
// `y_t = fold(y0 + vy*t, 2*(H-rectH))`; uniform HSL hue
// `h(f) = (f % cycleFrames) / cycleFrames * 360` rotated to RGB at
// integer channel resolution. Pre-rendered QR matrix in v1 (live
// URL→matrix encoding deferred to T-319a; branded variant T-319b;
// custom palettes T-319c). No `Date.now` / `Math.random` /
// `crypto.randomUUID` / `setTimeout` / `setInterval` / `fetch` /
// `requestAnimationFrame`.

import { useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { CSSProperties, ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// ─── schema ──────────────────────────────────────────────────────────────

/** A QR matrix row: '0' / '1' chars only ('1' = dark module). */
const qrMatrixRowSchema = z.string().regex(/^[01]+$/);

/**
 * QR matrix shape: a non-empty array of equal-length row strings.
 * Width MUST equal height (square). The smallest QR-spec version is
 * 21×21; we accept synthetic 7×7 matrices upward to support unit
 * tests. The largest QR-spec version is 177×177 (version 40).
 */
const qrMatrixSchema = z
  .array(qrMatrixRowSchema)
  .min(7)
  .max(177)
  .refine((rows) => rows.every((row) => row.length === (rows[0]?.length ?? 0)), {
    message: 'qrMatrix rows must all have equal length (square matrix)',
  })
  .refine((rows) => rows.length === (rows[0]?.length ?? 0), {
    message: 'qrMatrix must be square (rows.length === rows[0].length)',
  });

const positionSchema = z
  .object({
    /** Absolute pixel x within the canvas. */
    x: z.number(),
    /** Absolute pixel y within the canvas. */
    y: z.number(),
  })
  .strict();

const velocitySchema = z
  .object({
    /** Pixels per frame in the x-axis. Sign indicates direction. */
    vx: z.number(),
    /** Pixels per frame in the y-axis. Sign indicates direction. */
    vy: z.number(),
  })
  .strict();

const bounceSchema = z
  .object({
    /** Initial top-left position of the QR rectangle (px from canvas top-left). */
    startPosition: positionSchema,
    /** Initial velocity vector (px/frame). */
    startVelocity: velocitySchema,
  })
  .strict();

/**
 * Color-cycle config. v1 sealed at `palette: 'rainbow'` — uniform HSL
 * hue rotation across all dark QR modules. Future palettes (`'mono'`,
 * `'theme'`, custom arrays) are deferred to T-319c.
 */
const colorCycleSchema = z
  .object({
    palette: z.literal('rainbow'),
    /**
     * Cycle period in frames. Default `ceil(fps * 7)` — 7 s mid-range
     * of the 6–8 s canon (`coinbase-dvd-qr.md` line 26). 7 is coprime
     * with most commercial-spot durations to avoid visible loop-points.
     */
    cycleFrames: z.number().int().positive().optional(),
  })
  .strict();

export const qrCodeBouncePropsSchema = z
  .object({
    /** Square QR matrix as '0'/'1' row strings. '1' = dark module. */
    qrMatrix: qrMatrixSchema,
    /** Bounce physics config (start position + velocity). */
    bounce: bounceSchema,
    /**
     * Rendered rectangle size as a percent of the canvas's smaller
     * dimension. Default 22 (mid-range of 20–25 % per
     * `coinbase-dvd-qr.md` line 27).
     */
    sizePercent: z.number().positive().min(5).max(80).optional(),
    /** Color-cycle config; default rainbow with `cycleFrames = ceil(fps * 7)`. */
    colorCycle: colorCycleSchema.optional(),
    /**
     * Backdrop color hex. Default `'#000000'` (zero-brand canon per
     * `coinbase-dvd-qr.md` line 25). The default dominates theme — the
     * consumer must explicitly pass `background` to override.
     */
    background: z.string().regex(HEX_COLOR_RE).optional(),
    /**
     * Light-module color (the QR rectangle's canvas color, behind the
     * dark modules). Default `'#FFFFFF'` — the QR-spec canonical light.
     * NOT theme-bound — overriding via theme could break QR scan
     * reliability (per D-T319-7).
     */
    lightModuleColor: z.string().regex(HEX_COLOR_RE).optional(),
  })
  .strict();

export type QRCodeBounceProps = z.infer<typeof qrCodeBouncePropsSchema>;

// ─── constants ───────────────────────────────────────────────────────────

const DEFAULT_SIZE_PERCENT = 22;
const DEFAULT_BACKGROUND = '#000000';
const DEFAULT_LIGHT_MODULE_COLOR = '#FFFFFF';

// ─── pure helpers — bounce physics ───────────────────────────────────────

/**
 * Fold a coordinate into a triangle-wave with period `2 * span`,
 * mapping any real number onto `[0, span]` via reflective rebound.
 * Closed-form, deterministic, no iterative collision detection.
 */
function fold(value: number, span: number): number {
  if (span <= 0) return 0;
  const period = 2 * span;
  // Standard "wrap into [0, period)" — JS `%` keeps sign so add+mod.
  const wrapped = ((value % period) + period) % period;
  return wrapped <= span ? wrapped : period - wrapped;
}

interface BouncePosition {
  x: number;
  y: number;
}

/**
 * Compute the integer-pixel rendered position of the QR rectangle at
 * `frame`, given the canvas dimensions, the rectangle size, and the
 * starting position + velocity (per D-T319-4). Pure function.
 */
export function computeBouncePosition(
  frame: number,
  startPos: { x: number; y: number },
  startVel: { vx: number; vy: number },
  canvasW: number,
  canvasH: number,
  rectSize: number,
): BouncePosition {
  const spanX = Math.max(0, canvasW - rectSize);
  const spanY = Math.max(0, canvasH - rectSize);
  const naiveX = startPos.x + startVel.vx * frame;
  const naiveY = startPos.y + startVel.vy * frame;
  const foldedX = fold(naiveX, spanX);
  const foldedY = fold(naiveY, spanY);
  return {
    x: Math.round(foldedX),
    y: Math.round(foldedY),
  };
}

// ─── pure helpers — HSL → RGB ────────────────────────────────────────────

/**
 * Standard HSL → RGB conversion. `h` in [0, 360); `s`, `l` in [0, 1].
 * Returns integer channels in [0, 255]. Pure function.
 */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hh < 60) {
    r1 = c;
    g1 = x;
    b1 = 0;
  } else if (hh < 120) {
    r1 = x;
    g1 = c;
    b1 = 0;
  } else if (hh < 180) {
    r1 = 0;
    g1 = c;
    b1 = x;
  } else if (hh < 240) {
    r1 = 0;
    g1 = x;
    b1 = c;
  } else if (hh < 300) {
    r1 = x;
    g1 = 0;
    b1 = c;
  } else {
    r1 = c;
    g1 = 0;
    b1 = x;
  }
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

/**
 * Frame-derived hue at uniform HSL(h, 100%, 50%) per D-T319-5.
 * `h(f) = (f % cycleFrames) / cycleFrames * 360`.
 */
export function currentHue(frame: number, cycleFrames: number): number {
  if (cycleFrames <= 0) return 0;
  const phaseFrame = ((frame % cycleFrames) + cycleFrames) % cycleFrames;
  return (phaseFrame / cycleFrames) * 360;
}

/** Format an RGB triple as a 6-char `#RRGGBB` hex string. */
function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const toHex = (n: number): string => {
    const clamped = Math.max(0, Math.min(255, n));
    const hex = clamped.toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
}

// ─── component ───────────────────────────────────────────────────────────

/**
 * `<QRCodeBounce>` — the public component. Renders a square QR-code
 * matrix bouncing across a pure-black canvas with rainbow hue cycling
 * on the dark modules. Frame-derived; v1 is single-register
 * (no platform / mode dispatch). Always-moving, always-cycling.
 */
export function QRCodeBounce(props: QRCodeBounceProps): ReactElement {
  const frame = useCurrentFrame();
  const { width: canvasW, height: canvasH, fps } = useVideoConfig();

  const sizePercent = props.sizePercent ?? DEFAULT_SIZE_PERCENT;
  const background = props.background ?? DEFAULT_BACKGROUND;
  const lightModuleColor = props.lightModuleColor ?? DEFAULT_LIGHT_MODULE_COLOR;
  const cycleFrames = props.colorCycle?.cycleFrames ?? Math.ceil(fps * 7);

  const matrixSize = props.qrMatrix.length;
  const rectSize = Math.round((Math.min(canvasW, canvasH) * sizePercent) / 100);
  const moduleSize = rectSize / matrixSize;

  const { x, y } = computeBouncePosition(
    frame,
    props.bounce.startPosition,
    props.bounce.startVelocity,
    canvasW,
    canvasH,
    rectSize,
  );

  const hue = currentHue(frame, cycleFrames);
  const darkRgb = hslToRgb(hue, 1, 0.5);
  const darkColor = rgbToHex(darkRgb);

  const outerStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    backgroundColor: background,
    overflow: 'hidden',
  };

  const rectStyle: CSSProperties = {
    position: 'absolute',
    left: x,
    top: y,
    width: rectSize,
    height: rectSize,
    backgroundColor: lightModuleColor,
  };

  return (
    <div data-testid="qr-code-bounce" style={outerStyle}>
      <div
        data-testid="qr-code-bounce-rect"
        data-rect-size={rectSize}
        data-dark-color={darkColor}
        style={rectStyle}
      >
        {renderModules(props.qrMatrix, moduleSize, darkColor)}
      </div>
    </div>
  );
}

/**
 * Iterate the matrix in row-major order; render only dark modules
 * (`'1'`) as absolutely-positioned `<div>` cells. Light modules
 * (`'0'`) are skipped — the rectangle's outer `backgroundColor`
 * (`lightModuleColor`) covers them, saving DOM nodes.
 */
function renderModules(
  matrix: readonly string[],
  moduleSize: number,
  darkColor: string,
): ReactElement[] {
  const cells: ReactElement[] = [];
  for (let row = 0; row < matrix.length; row += 1) {
    const rowStr = matrix[row];
    if (rowStr === undefined) continue;
    for (let col = 0; col < rowStr.length; col += 1) {
      if (rowStr.charCodeAt(col) !== 49 /* '1' */) continue;
      const style: CSSProperties = {
        position: 'absolute',
        left: col * moduleSize,
        top: row * moduleSize,
        width: moduleSize,
        height: moduleSize,
        backgroundColor: darkColor,
      };
      cells.push(
        <div
          key={`m-${row}-${col}`}
          data-testid="qr-code-bounce-module"
          data-row={row}
          data-col={col}
          style={style}
        />,
      );
    }
  }
  return cells;
}

/**
 * `qrCodeBounceClip` clip definition — registered as
 * `kind: 'qr-code-bounce'` in the frame-runtime bridge. Theme slots
 * map only `background` → `palette.background`; `lightModuleColor` is
 * intentionally NOT theme-bound to preserve the dark-on-light
 * scannability invariant (per D-T319-7). NO `fontRequirements` (per
 * D-T319-8 — QR has zero text content).
 */
export const qrCodeBounceClip: ClipDefinition<unknown> = defineFrameClip<QRCodeBounceProps>({
  kind: 'qr-code-bounce',
  component: QRCodeBounce,
  propsSchema: qrCodeBouncePropsSchema,
  themeSlots: {
    background: { kind: 'palette', role: 'background' },
  },
});

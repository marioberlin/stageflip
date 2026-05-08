// packages/runtimes/frame-runtime-bridge/src/clips/photographic-overlay.tsx
// T-321d — `photographic-overlay` runtime-clip primitive: static
// film-grade tonal overlay rendered via SVG `<filter>` primitives
// (`<feColorMatrix>` / `<feComponentTransfer>`). Sealed flat enum
// `mode: 'sepia' | 'cross-process' | 'cinematic-lut' | 'fade'` with
// canonical pre-tuned color matrices/curves embedded as static
// constants (no theme slots — photographic registers are tonal CANON
// per D-T321d-9). Last new-primitive carve-out from the T-321 roadmap
// (T-321a grain shipped; T-321b lightLeak superseded by T-131b.2;
// T-321c particles superseded by T-131d.1; T-321d photographic-overlay
// here). Renders deterministically across CDP per SVG 1.1 §15.3
// (Filter Effects spec): `<feColorMatrix type="matrix">` and
// `<feComponentTransfer>` are pure pixel-level functions of input
// pixel × static matrix/curve — no randomness, no time-dependent
// state, byte-identical output across CDP versions. Pinned
// `color-interpolation-filters="sRGB"` on every filter element.
// Static (no frame counter, no animation in v1) per D-T321d-8;
// optional `intensity` ∈ [0, 1] alpha-blends the filter onto the
// underlying via `<feMerge>` chain per D-T321d-10; optional `position`
// for partial-frame application (defaults to full-canvas via
// `useVideoConfig().width × .height`). Single Zod `object().strict()`
// schema (NOT `discriminatedUnion` — all 4 modes share identical prop
// surface; only the underlying SVG filter primitives differ; mirrors
// T-319 qr-code-bounce single-schema posture). Frame-deterministic —
// no `Math.random` / `Date.now` / `crypto.randomUUID` / `setTimeout` /
// `setInterval` / `fetch` / `requestAnimationFrame` /
// `addEventListener`. Stable static filter IDs; no
// `crypto.randomUUID()`. Primary consumer T-351
// `true-detective-double-exposure` (compass canon "photographic clip"
// register); secondary T-348 `stranger-things-benguiat` (may layer
// fade/cinematic-LUT atop existing grain + light-leak compositions).

import { useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { CSSProperties, ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

// ─── schema ──────────────────────────────────────────────────────────────

const positionSchema = z
  .object({
    /** Absolute pixel x within the canvas (top-left of overlay region). */
    x: z.number(),
    /** Absolute pixel y within the canvas (top-left of overlay region). */
    y: z.number(),
    /** Width of the overlay region in canvas pixels (1..1920). */
    width: z.number().positive().min(1).max(1920),
    /** Height of the overlay region in canvas pixels (1..1080). */
    height: z.number().positive().min(1).max(1080),
  })
  .strict();

export const photographicOverlayPropsSchema = z
  .object({
    /**
     * Sealed photographic mode. Each mode binds to a canonical pre-
     * tuned SVG filter primitive (matrix or curve) per D-T321d-7.
     * No theme slots — modes are tonal canon, not brand canvas.
     */
    mode: z.enum(['sepia', 'cross-process', 'cinematic-lut', 'fade']),
    /**
     * Filter intensity ∈ [0, 1]. 1 = full filter; 0 = no effect.
     * Implemented via alpha-blend `<feMerge>` chain mixing the
     * filtered result with the source graphic per D-T321d-10.
     * Default 1 (full filter).
     */
    intensity: z.number().min(0).max(1).optional(),
    /**
     * Optional region. When absent, defaults at runtime to the full
     * canvas (`{ x: 0, y: 0, width: useVideoConfig().width, height:
     * useVideoConfig().height }`).
     */
    position: positionSchema.optional(),
  })
  .strict();

export type PhotographicOverlayProps = z.infer<typeof photographicOverlayPropsSchema>;

export type PhotographicOverlayMode = PhotographicOverlayProps['mode'];

// ─── constants ───────────────────────────────────────────────────────────

const DEFAULT_INTENSITY = 1;

/**
 * Canonical sepia 5×4 affine color matrix (per D-T321d-7). Widely
 * cited; warm-yellow tonal shift. Applied via `<feColorMatrix
 * type="matrix">`.
 */
export const SEPIA_MATRIX = `
  0.393 0.769 0.189 0 0
  0.349 0.686 0.168 0 0
  0.272 0.534 0.131 0 0
  0     0     0     1 0
`.trim();

/**
 * Canonical cinematic-LUT 5×4 affine color matrix (per D-T321d-7).
 * Teal-and-orange contrast bias: boosts R/B (orange/teal),
 * suppresses cross-channel mixing. Applied via `<feColorMatrix
 * type="matrix">`.
 */
export const CINEMATIC_LUT_MATRIX = `
  1.10  0.05 -0.05 0 0
  0.00  1.05  0.05 0 0
 -0.05  0.05  1.10 0 0
  0     0     0    1 0
`.trim();

/**
 * Canonical cross-process per-channel curve tables (per D-T321d-7).
 * Cyan-shadows + magenta-highlights: lifts shadows on R/B, suppresses
 * G mid-tones. Applied via `<feComponentTransfer>` with `<feFuncR>`
 * / `<feFuncG>` / `<feFuncB>` `type="table"` `tableValues`.
 */
export const CROSS_PROCESS_R_TABLE = '0.1 0.2 0.5 0.8 1.0';
export const CROSS_PROCESS_G_TABLE = '0.0 0.3 0.5 0.7 1.0';
export const CROSS_PROCESS_B_TABLE = '0.2 0.4 0.6 0.7 0.9';

/**
 * Canonical fade per-channel linear coefficients (per D-T321d-7).
 * Lifted blacks + lowered highlights: black → 0.10, white → 0.95.
 * Applied via `<feComponentTransfer>` with `<feFuncR>` / `<feFuncG>`
 * / `<feFuncB>` `type="linear"` `slope` + `intercept`.
 */
export const FADE_SLOPE = 0.85;
export const FADE_INTERCEPT = 0.1;

// ─── pure helpers — stable filter ID derivation ──────────────────────────

/**
 * Build a stable filter ID from the mode + intensity-bucket. The
 * intensity is bucketed into 4-decimal precision so identical
 * (mode, intensity) inputs produce identical IDs across renders; no
 * `crypto.randomUUID()` per CLAUDE.md §3 determinism.
 */
export function filterId(mode: PhotographicOverlayMode, intensity: number): string {
  const bucket = Math.round(intensity * 10000);
  return `photographic-overlay-${mode}-${bucket}`;
}

// ─── component ───────────────────────────────────────────────────────────

interface FilterPrimitives {
  /** SVG filter primitives that produce the filtered result. */
  primitives: ReactElement;
}

/**
 * Build the per-mode SVG filter primitives. Pure function — same
 * mode → same JSX subtree. Each primitive pins
 * `color-interpolation-filters="sRGB"` per D-T321d-6 to avoid linear-
 * RGB drift across CDP versions. The output is named `'filtered'` via
 * a `result` attribute so the alpha-blend `<feMerge>` chain can
 * reference it.
 */
function buildFilterPrimitives(mode: PhotographicOverlayMode): FilterPrimitives {
  switch (mode) {
    case 'sepia':
      return {
        primitives: (
          <feColorMatrix
            type="matrix"
            values={SEPIA_MATRIX}
            colorInterpolationFilters="sRGB"
            result="filtered"
          />
        ),
      };
    case 'cinematic-lut':
      return {
        primitives: (
          <feColorMatrix
            type="matrix"
            values={CINEMATIC_LUT_MATRIX}
            colorInterpolationFilters="sRGB"
            result="filtered"
          />
        ),
      };
    case 'cross-process':
      return {
        primitives: (
          <feComponentTransfer colorInterpolationFilters="sRGB" result="filtered">
            <feFuncR type="table" tableValues={CROSS_PROCESS_R_TABLE} />
            <feFuncG type="table" tableValues={CROSS_PROCESS_G_TABLE} />
            <feFuncB type="table" tableValues={CROSS_PROCESS_B_TABLE} />
          </feComponentTransfer>
        ),
      };
    case 'fade':
      return {
        primitives: (
          <feComponentTransfer colorInterpolationFilters="sRGB" result="filtered">
            <feFuncR type="linear" slope={FADE_SLOPE} intercept={FADE_INTERCEPT} />
            <feFuncG type="linear" slope={FADE_SLOPE} intercept={FADE_INTERCEPT} />
            <feFuncB type="linear" slope={FADE_SLOPE} intercept={FADE_INTERCEPT} />
          </feComponentTransfer>
        ),
      };
  }
}

/**
 * `<PhotographicOverlay>` — the public component. Renders a static
 * SVG `<filter>` overlay applying one of four canonical photographic
 * modes (`'sepia'` / `'cross-process'` / `'cinematic-lut'` /
 * `'fade'`). Static — no frame counter, no animation in v1. The
 * filter is a constant per `(mode, intensity)`; same inputs →
 * byte-identical SVG markup.
 *
 * The component renders an SVG positioned absolutely inside the
 * configured `position` region (default full-canvas). The SVG hosts
 * a `<defs><filter>...</filter></defs>` block plus a single `<rect>`
 * sized to the region with `filter="url(#...)"`. Rendering is purely
 * declarative — no canvas, no `useEffect`, no per-pixel processing.
 */
export function PhotographicOverlay(props: PhotographicOverlayProps): ReactElement {
  const { width: canvasW, height: canvasH } = useVideoConfig();
  const intensity = props.intensity ?? DEFAULT_INTENSITY;
  const region = props.position ?? {
    x: 0,
    y: 0,
    width: canvasW,
    height: canvasH,
  };

  const id = filterId(props.mode, intensity);
  const { primitives } = buildFilterPrimitives(props.mode);

  // Alpha-blend chain (per D-T321d-10): when intensity < 1 the
  // filtered result's alpha is multiplied by `intensity`, then
  // `<feMerge>` composites SourceGraphic UNDER the partially-
  // transparent filtered result so the underlying still shows through.
  // When intensity == 1 we skip the merge entirely (the filtered
  // result fully replaces the source).
  const mergeChain =
    intensity < 1 ? (
      <>
        <feColorMatrix
          in="filtered"
          type="matrix"
          values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${intensity} 0`}
          colorInterpolationFilters="sRGB"
          result="blended"
        />
        <feMerge>
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="blended" />
        </feMerge>
      </>
    ) : null;

  const style: CSSProperties = {
    position: 'absolute',
    left: region.x,
    top: region.y,
    width: region.width,
    height: region.height,
    pointerEvents: 'none',
  };

  return (
    <svg
      data-testid="photographic-overlay"
      data-mode={props.mode}
      data-intensity={intensity}
      width={region.width}
      height={region.height}
      viewBox={`0 0 ${region.width} ${region.height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      <title>{`Photographic overlay: ${props.mode}`}</title>
      <defs>
        <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          {primitives}
          {mergeChain}
        </filter>
      </defs>
      <rect
        x="0"
        y="0"
        width={region.width}
        height={region.height}
        fill="rgba(255,255,255,1)"
        filter={`url(#${id})`}
      />
    </svg>
  );
}

/**
 * `photographicOverlayClip` clip definition — registered as
 * `kind: 'photographic-overlay'` in the frame-runtime bridge. NO theme
 * slots (per D-T321d-9 — modes are tonal canon, not brand canvas).
 * NO `fontRequirements` (no text surface).
 */
export const photographicOverlayClip: ClipDefinition<unknown> =
  defineFrameClip<PhotographicOverlayProps>({
    kind: 'photographic-overlay',
    component: PhotographicOverlay,
    propsSchema: photographicOverlayPropsSchema,
    themeSlots: {},
  });

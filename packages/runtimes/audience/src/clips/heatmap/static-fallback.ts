// packages/runtimes/audience/src/clips/heatmap/static-fallback.ts
// T-469 — Static-fallback renderer for the `heatmap` clip. Returns a
// React tree that paints a `<canvas>` overlay on top of the underlying
// `<img>` using the pure `rasterizeHeatmap` helper. The actual
// `putImageData` call happens inside a React effect on the canvas ref;
// the determinism perimeter (CLAUDE.md §3) is on the rasterise step
// (pure), the canvas mutation is a host concern.
//
// Layout (per T-469 spec + ADR-010 §D4):
//   - Outer panel (`<div data-stageflip-clip="heatmap">`) carries the
//     prompt label + the total-taps counter.
//   - Below the prompt: a `<div>` positioning context. The `<img>`
//     renders below (`position: absolute`, full bleed); the `<canvas>`
//     renders above (`position: absolute`, full bleed, `opacity: 0.7`).
//   - Empty-snapshot routing: zero `taps` renders a placeholder image
//     + transparent canvas (`Waiting for taps…` status line).
//
// Browser-safe — pure JSX (createElement). `useEffect` + `useRef`
// imports from React; the React renderer (the host) materialises the
// tree + runs the effect.

import type { HeatmapAggregation } from '@stageflip/audience-contract';
import { type ReactElement, createElement, useEffect, useRef } from 'react';

import { rasterizeHeatmap } from './rasterize.js';

/**
 * Visual context for the static-fallback render. Width / height in CSS
 * px. `prompt` + `imageRef` propagate to the rendered DOM (the prompt
 * label + the underlying image's `src`).
 */
export interface HeatmapStaticFallbackContext {
  /** Bounding-box width in CSS px. Positive integer. */
  readonly width: number;
  /** Bounding-box height in CSS px. Positive integer. */
  readonly height: number;
  /** Question text shown above the image. */
  readonly prompt: string;
  /** Underlying image URL or `cacheKey:` reference. */
  readonly imageRef: string;
}

/** Default panel background colour. */
const PANEL_BG = '#ffffff';
/** Default text colour. */
const TEXT_COLOR = '#111827';
/** Secondary text colour. */
const SECONDARY_TEXT_COLOR = '#6b7280';

/**
 * Format the total-taps label. Matches the `${n} taps` / `1 tap`
 * singular-plural precedent from the prior families.
 */
export function formatTotalTapsLabel(totalTaps: number): string {
  return `${totalTaps} ${totalTaps === 1 ? 'tap' : 'taps'}`;
}

/**
 * Canvas overlay component. Internal: owns the canvas ref + the
 * `useEffect` that paints the rasterised heatmap into the 2D context.
 * Re-paints whenever the `aggregation` reference changes.
 */
function HeatmapCanvasOverlay(props: {
  readonly aggregation: HeatmapAggregation;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
}): ReactElement {
  const { aggregation, canvasWidth, canvasHeight } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    const imageData = rasterizeHeatmap(
      aggregation.taps,
      aggregation.gridResolution,
      canvasWidth,
      canvasHeight,
    );
    try {
      ctx.putImageData(imageData, 0, 0);
    } catch {
      // Test environments (happy-dom) without a real 2D backend may
      // throw on `putImageData`. Non-actionable here; the canvas
      // element + dimensions remain asserted by §13 tests.
    }
  }, [aggregation, canvasWidth, canvasHeight]);

  return createElement('canvas', {
    ref: canvasRef,
    width: canvasWidth,
    height: canvasHeight,
    'data-testid': 'heatmap-canvas',
    'data-tap-count': aggregation.totalTaps,
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      opacity: 0.7,
      pointerEvents: 'none',
    },
  });
}

/**
 * Render the static-fallback React tree from a frozen aggregation
 * snapshot + visual context. The tree includes the underlying image,
 * a canvas overlay, and a total-taps counter. The canvas is painted
 * via a React effect inside `<HeatmapCanvasOverlay>`.
 *
 * Routing:
 *   - `aggregation.taps.length === 0` AND `aggregation.totalTaps === 0`
 *     → renders the `Waiting for taps…` placeholder over the image.
 *   - otherwise → renders the canvas overlay with the heatmap raster.
 */
export function renderHeatmapStaticFallback(input: {
  readonly snapshot: HeatmapAggregation;
  readonly context: HeatmapStaticFallbackContext;
}): ReactElement {
  const { snapshot, context } = input;
  const { width, height, prompt, imageRef } = context;
  const isIdle = snapshot.taps.length === 0 && snapshot.totalTaps === 0;

  const promptLabel = createElement(
    'h4',
    {
      key: 'prompt',
      'data-role': 'prompt',
      'data-testid': 'heatmap-prompt',
      style: {
        margin: '0 0 8px 0',
        color: TEXT_COLOR,
        fontSize: '16px',
        fontWeight: 600,
      },
    },
    prompt,
  );

  const image = createElement('img', {
    key: 'image',
    src: imageRef,
    alt: prompt,
    'data-testid': 'heatmap-image',
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      objectFit: 'contain',
    },
  });

  // Inner positioning context — fills the remaining panel space.
  const innerChildren: ReactElement[] = [image];
  if (!isIdle) {
    innerChildren.push(
      createElement(HeatmapCanvasOverlay, {
        key: 'canvas',
        aggregation: snapshot,
        canvasWidth: width,
        canvasHeight: Math.max(1, height - 64),
      }),
    );
  }
  if (isIdle) {
    innerChildren.push(
      createElement(
        'div',
        {
          key: 'waiting',
          'data-role': 'waiting-overlay',
          'data-testid': 'heatmap-waiting',
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: SECONDARY_TEXT_COLOR,
            fontSize: '14px',
            background: 'rgba(255, 255, 255, 0.6)',
          },
        },
        'Waiting for taps…',
      ),
    );
  }

  const inner = createElement(
    'div',
    {
      key: 'inner',
      'data-role': 'image-stage',
      'data-testid': 'heatmap-stage',
      style: {
        position: 'relative',
        width: '100%',
        flex: '1 1 auto',
        overflow: 'hidden',
      },
    },
    innerChildren,
  );

  const totalLabel = createElement(
    'div',
    {
      key: 'total',
      'data-role': 'total-taps',
      'data-testid': 'heatmap-total',
      'data-total-taps': snapshot.totalTaps,
      style: {
        marginTop: '8px',
        color: SECONDARY_TEXT_COLOR,
        fontSize: '13px',
      },
    },
    formatTotalTapsLabel(snapshot.totalTaps),
  );

  return createElement(
    'div',
    {
      'data-stageflip-clip': 'heatmap',
      'data-testid': 'heatmap-root',
      'data-state': isIdle ? 'waiting' : 'aggregated',
      style: {
        width: `${width}px`,
        height: `${height}px`,
        boxSizing: 'border-box',
        padding: '16px',
        background: PANEL_BG,
        color: TEXT_COLOR,
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
      },
    },
    [promptLabel, inner, totalLabel],
  );
}

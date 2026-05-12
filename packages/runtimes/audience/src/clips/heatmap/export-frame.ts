// packages/runtimes/audience/src/clips/heatmap/export-frame.ts
// T-472 — SVG export-frame emitter for the `heatmap` clip. Pure
// function: `(snapshot, element) → AudienceExportFrame`. Low-fidelity
// approximation of the canvas-based static-fallback: one `<circle>`
// per tap, radius proportional to intensity, color from the same
// 4-bucket blue→red colormap used by `rasterize.ts`.

import type { HeatmapAggregation } from '@stageflip/audience-contract';
import type { HeatmapClipElement } from '@stageflip/schema';

import {
  type AudienceExportFrame,
  escapeSvgText,
  resolveExportFrameDimensions,
} from '../../export-frame.js';

const TEXT_COLOR = '#111827';
const SECONDARY_TEXT_COLOR = '#6b7280';
const FONT_FAMILY = 'sans-serif';

/** Format the bottom total-taps label. */
export function formatTotalTapsLabel(total: number): string {
  return `${total} ${total === 1 ? 'tap' : 'taps'}`;
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/**
 * Colormap a normalised value `v ∈ [0, 1]` via the same 4-bucket
 * piecewise-linear ramp used by `rasterize.ts`. Output as a `rgb(...)`
 * CSS function string suitable for inline SVG fill attributes.
 */
export function colormap(v: number): string {
  let r: number;
  let g: number;
  let b: number;
  if (v <= 0) {
    r = 0;
    g = 0;
    b = 0;
  } else if (v >= 1) {
    r = 255;
    g = 0;
    b = 0;
  } else if (v < 0.25) {
    const t = v / 0.25;
    r = 0;
    g = lerp(0, 255, t);
    b = lerp(255, 0, t);
  } else if (v < 0.5) {
    const t = (v - 0.25) / 0.25;
    r = lerp(0, 255, t);
    g = 255;
    b = 0;
  } else if (v < 0.75) {
    const t = (v - 0.5) / 0.25;
    r = 255;
    g = lerp(255, 0, t);
    b = 0;
  } else {
    r = 255;
    g = 0;
    b = 0;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

export function renderHeatmapExportFrame(
  snapshot: HeatmapAggregation,
  element: HeatmapClipElement,
): AudienceExportFrame {
  const { width, height } = resolveExportFrameDimensions(element);
  const { prompt } = element.props;

  const padding = 48;
  const headerY = padding + 32;
  const stageTop = headerY + 32;
  const stageBottom = height - padding - 32;
  const stageHeight = Math.max(0, stageBottom - stageTop);
  const stageLeft = padding;
  const stageRight = width - padding;
  const stageWidth = Math.max(0, stageRight - stageLeft);

  let maxIntensity = 0;
  for (const t of snapshot.taps) if (t.intensity > maxIntensity) maxIntensity = t.intensity;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
  );
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

  parts.push(
    `<text x="${padding}" y="${headerY}" font-family="${FONT_FAMILY}" font-size="22" font-weight="700" fill="${TEXT_COLOR}">${escapeSvgText(prompt)}</text>`,
  );

  // Stage rectangle.
  parts.push(
    `<rect x="${stageLeft}" y="${stageTop}" width="${stageWidth}" height="${stageHeight}" fill="#f3f4f6" stroke="#e5e7eb" stroke-width="1"/>`,
  );

  if (snapshot.taps.length === 0) {
    parts.push(
      `<text x="${stageLeft + stageWidth / 2}" y="${stageTop + stageHeight / 2}" font-family="${FONT_FAMILY}" font-size="16" fill="${SECONDARY_TEXT_COLOR}" text-anchor="middle">Waiting for taps…</text>`,
    );
  } else {
    const baseRadius = Math.max(6, Math.floor(Math.min(stageWidth, stageHeight) / 80));
    for (const tap of snapshot.taps) {
      const cx = stageLeft + Math.round(tap.x * stageWidth);
      const cy = stageTop + Math.round(tap.y * stageHeight);
      const normalized = maxIntensity > 0 ? tap.intensity / maxIntensity : 0;
      const radius = baseRadius + Math.round(normalized * baseRadius * 2);
      const color = colormap(normalized);
      parts.push(
        `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}" fill-opacity="0.7"/>`,
      );
    }
  }

  parts.push(
    `<text x="${padding}" y="${height - padding}" font-family="${FONT_FAMILY}" font-size="14" fill="${SECONDARY_TEXT_COLOR}">${escapeSvgText(formatTotalTapsLabel(snapshot.totalTaps))}</text>`,
  );

  parts.push('</svg>');

  return {
    svg: parts.join(''),
    width,
    height,
    voterCountAtCapture: snapshot.totalTaps,
  };
}

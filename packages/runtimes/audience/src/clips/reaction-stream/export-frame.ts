// packages/runtimes/audience/src/clips/reaction-stream/export-frame.ts
// T-472 — SVG export-frame emitter for the `reaction-stream` clip.
// Low-fidelity approximation of the WebGL fragment shader: a cluster
// of `<circle>` dots per emoji entry, density driven by `recentBurst`,
// colour derived per the fragment shader's `emojiColor` formula (HSL
// style sin/cos basis at the entry index).
//
// Pure function (CLAUDE.md §3). Deterministic. No Date / random /
// fetch / setTimeout.

import type { ReactionStreamAggregation } from '@stageflip/audience-contract';
import type { ReactionStreamClipElement } from '@stageflip/schema';

import {
  type AudienceExportFrame,
  escapeSvgText,
  resolveExportFrameDimensions,
} from '../../export-frame.js';

const TEXT_COLOR = '#111827';
const SECONDARY_TEXT_COLOR = '#6b7280';
const FONT_FAMILY = 'sans-serif';

/**
 * Maximum number of particles drawn per emoji. Mirrors the shader's
 * `REACTION_STREAM_PARTICLES_PER_EMOJI = 10` constant so the visual
 * fidelity stays comparable.
 */
const PARTICLES_PER_EMOJI = 10;

export function formatTotalLabel(total: number): string {
  return `${total} ${total === 1 ? 'reaction' : 'reactions'}`;
}

/**
 * Reproduce the fragment shader's `emojiColor` formula at palette
 * index `i`. Output as an `rgb(...)` CSS function string suitable for
 * inline SVG fill attributes. Values clamped 0..255.
 */
export function emojiColor(i: number): string {
  const r = Math.round(255 * (0.5 + 0.5 * Math.sin(i * 1.7)));
  const g = Math.round(255 * (0.5 + 0.5 * Math.cos(i * 2.3)));
  const b = Math.round(255 * (0.5 + 0.5 * Math.sin(i * 3.1 + 1.5)));
  const clamp = (v: number): number => Math.max(0, Math.min(255, v));
  return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
}

/**
 * Compute the integer particle count per emoji given its `recentBurst`
 * and total. Mirrors the shader's `density * 10.0` cap so the SVG and
 * the shader output remain in rough visual agreement.
 */
export function particleCountFor(recentBurst: number, totalReactions: number): number {
  if (totalReactions <= 0) return 0;
  const density = Math.min(1, recentBurst / totalReactions);
  return Math.min(PARTICLES_PER_EMOJI, Math.max(1, Math.round(density * PARTICLES_PER_EMOJI)));
}

export function renderReactionStreamExportFrame(
  snapshot: ReactionStreamAggregation,
  element: ReactionStreamClipElement,
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
  const cx = stageLeft + stageWidth / 2;
  const cy = stageTop + stageHeight / 2;
  const orbitRadius = Math.max(20, Math.min(stageWidth, stageHeight) * 0.4);
  const dotR = Math.max(8, Math.floor(Math.min(stageWidth, stageHeight) / 60));

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
  );
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

  parts.push(
    `<text x="${padding}" y="${headerY}" font-family="${FONT_FAMILY}" font-size="22" font-weight="700" fill="${TEXT_COLOR}">${escapeSvgText(prompt)}</text>`,
  );

  parts.push(
    `<rect x="${stageLeft}" y="${stageTop}" width="${stageWidth}" height="${stageHeight}" fill="#0f172a"/>`,
  );

  for (let i = 0; i < snapshot.emojiCounts.length; i++) {
    const entry = snapshot.emojiCounts[i];
    if (entry === undefined) continue;
    const colour = emojiColor(i);
    const n = particleCountFor(entry.recentBurst, snapshot.totalReactions);
    for (let j = 0; j < n; j++) {
      const particleId = i * 10 + j;
      const angle = particleId * 2.4;
      const radius = orbitRadius * (0.85 + 0.15 * Math.sin(particleId * 1.7));
      const px = Math.round(cx + radius * Math.cos(angle));
      const py = Math.round(cy + radius * Math.sin(angle * 1.3));
      parts.push(
        `<circle cx="${px}" cy="${py}" r="${dotR}" fill="${colour}" fill-opacity="0.85"/>`,
      );
    }
  }

  parts.push(
    `<text x="${padding}" y="${height - padding}" font-family="${FONT_FAMILY}" font-size="14" fill="${SECONDARY_TEXT_COLOR}">${escapeSvgText(formatTotalLabel(snapshot.totalReactions))}</text>`,
  );

  parts.push('</svg>');

  return {
    svg: parts.join(''),
    width,
    height,
    voterCountAtCapture: snapshot.totalReactions,
  };
}

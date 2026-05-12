// packages/runtimes/audience/src/clips/word-cloud/export-frame.ts
// T-472 — SVG export-frame emitter for the `word-cloud` clip. Pure
// function: `(snapshot, element) → AudienceExportFrame`. Mirrors the
// static-fallback DOM at low fidelity: a flow-wrap layout of `<text>`
// elements where font-size scales with the word's weight (14..50 px).
//
// Layout is a deterministic line-break wrap — packs words left-to-right
// until each line overflows the inner width, then starts a new line.

import type { WordCloudAggregation } from '@stageflip/audience-contract';
import type { WordCloudClipElement } from '@stageflip/schema';

import {
  type AudienceExportFrame,
  escapeSvgText,
  resolveExportFrameDimensions,
} from '../../export-frame.js';

const TEXT_COLOR = '#111827';
const FONT_FAMILY = 'sans-serif';

const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 50;

export function formatTotalLabel(total: number): string {
  return `${total} ${total === 1 ? 'submission' : 'submissions'}`;
}

/**
 * Compute the per-word font size (px) given the word's weight and the
 * max weight in the snapshot. When `maxWeight === 0` (degenerate) every
 * word maps to MIN_FONT_SIZE.
 */
export function fontSizeFor(weight: number, maxWeight: number): number {
  if (maxWeight <= 0) return MIN_FONT_SIZE;
  const ratio = Math.min(1, Math.max(0, weight / maxWeight));
  return Math.round(MIN_FONT_SIZE + (MAX_FONT_SIZE - MIN_FONT_SIZE) * ratio);
}

/**
 * Approximate per-word width in px. Rough heuristic: each character is
 * fontSize * 0.55 wide. Used for the deterministic line-wrap pack.
 */
export function approximateWordWidth(text: string, fontSize: number): number {
  return Math.ceil(text.length * fontSize * 0.55);
}

export function renderWordCloudExportFrame(
  snapshot: WordCloudAggregation,
  element: WordCloudClipElement,
): AudienceExportFrame {
  const { width, height } = resolveExportFrameDimensions(element);
  const { prompt } = element.props;

  const padding = 48;
  const innerW = width - padding * 2;
  const titleY = padding + 32;
  const wordsTop = titleY + 32;
  const totalLabelY = height - padding;

  let maxWeight = 0;
  for (const w of snapshot.words) if (w.weight > maxWeight) maxWeight = w.weight;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
  );
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

  parts.push(
    `<text x="${padding}" y="${titleY}" font-family="${FONT_FAMILY}" font-size="28" font-weight="700" fill="${TEXT_COLOR}">${escapeSvgText(prompt)}</text>`,
  );

  // Deterministic line-wrap pack.
  let cursorX = padding;
  let lineTop = wordsTop;
  let lineHeight = 0;
  for (const w of snapshot.words) {
    const fs = fontSizeFor(w.weight, maxWeight);
    const ww = approximateWordWidth(w.word, fs);
    const gap = 12;
    if (cursorX + ww > padding + innerW && cursorX > padding) {
      lineTop += lineHeight + 8;
      cursorX = padding;
      lineHeight = 0;
    }
    if (lineTop + fs > totalLabelY - 24) break;
    parts.push(
      `<text x="${cursorX}" y="${lineTop + fs}" font-family="${FONT_FAMILY}" font-size="${fs}" font-weight="600" fill="${TEXT_COLOR}">${escapeSvgText(w.word)}</text>`,
    );
    cursorX += ww + gap;
    if (fs > lineHeight) lineHeight = fs;
  }

  parts.push(
    `<text x="${padding}" y="${totalLabelY}" font-family="${FONT_FAMILY}" font-size="18" fill="${TEXT_COLOR}">${escapeSvgText(formatTotalLabel(snapshot.totalSubmissions))}</text>`,
  );

  parts.push('</svg>');

  return {
    svg: parts.join(''),
    width,
    height,
    voterCountAtCapture: snapshot.totalSubmissions,
  };
}

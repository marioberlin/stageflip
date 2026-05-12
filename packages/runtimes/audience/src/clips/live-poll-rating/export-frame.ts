// packages/runtimes/audience/src/clips/live-poll-rating/export-frame.ts
// T-472 — SVG export-frame emitter for the `live-poll-rating` clip.
// Pure function: `(snapshot, element) → AudienceExportFrame`. Mirrors
// the static-fallback DOM at low fidelity: histogram of one bar per
// score 1..scaleMax, normalised to the mode count; mean label above,
// total label below.

import type { LivePollRatingAggregation } from '@stageflip/audience-contract';
import type { LivePollRatingClipElement } from '@stageflip/schema';

import {
  type AudienceExportFrame,
  escapeSvgText,
  resolveExportFrameDimensions,
} from '../../export-frame.js';

const TEXT_COLOR = '#111827';
const BAR_BG = '#3b82f6';
const BAR_HIGHLIGHT_BG = '#1d4ed8';
const TRACK_BG = '#f3f4f6';
const SECONDARY_TEXT_COLOR = '#6b7280';
const FONT_FAMILY = 'sans-serif';

/**
 * Format the mean label. NaN (or totalVotes === 0) renders as
 * `Mean: —` with a literal em-dash; never emits the JS `NaN` literal.
 */
export function formatMeanLabel(mean: number, totalVotes: number): string {
  if (totalVotes === 0 || Number.isNaN(mean)) return 'Mean: —';
  return `Mean: ${mean.toFixed(1)}`;
}

export function formatTotalLabel(totalVotes: number): string {
  return `${totalVotes} ${totalVotes === 1 ? 'vote' : 'votes'}`;
}

/**
 * Compute the zero-indexed bar that should carry the highlight, or
 * null when none should be highlighted (NaN mean / out-of-range).
 */
export function meanHighlightIndex(mean: number, scaleMax: number): number | null {
  if (Number.isNaN(mean)) return null;
  const rounded = Math.round(mean);
  const idx = rounded - 1;
  if (idx < 0 || idx >= scaleMax) return null;
  return idx;
}

export function renderLivePollRatingExportFrame(
  snapshot: LivePollRatingAggregation,
  element: LivePollRatingClipElement,
): AudienceExportFrame {
  const { width, height } = resolveExportFrameDimensions(element);
  const { question, labels } = element.props;
  const { scoreCounts, totalVotes, mean } = snapshot;

  const scaleMax = scoreCounts.length;
  let mode = 0;
  for (const c of scoreCounts) {
    if (c > mode) mode = c;
  }

  const padding = 48;
  const innerW = width - padding * 2;
  const titleY = padding + 32;
  const meanY = titleY + 40;
  const barAreaTop = meanY + 32;
  const totalLabelY = height - padding;
  const endLabelsY = totalLabelY - 28;
  const barAreaBottom = endLabelsY - 24;
  const barAreaHeight = Math.max(40, barAreaBottom - barAreaTop);
  const barTrackWidth = scaleMax > 0 ? Math.floor((innerW - (scaleMax - 1) * 12) / scaleMax) : 0;

  const highlightIdx = meanHighlightIndex(mean, scaleMax);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
  );
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

  if (question !== undefined && question.length > 0) {
    parts.push(
      `<text x="${padding}" y="${titleY}" font-family="${FONT_FAMILY}" font-size="28" font-weight="700" fill="${TEXT_COLOR}">${escapeSvgText(question)}</text>`,
    );
  }

  parts.push(
    `<text x="${padding}" y="${meanY}" font-family="${FONT_FAMILY}" font-size="22" font-weight="700" fill="${TEXT_COLOR}">${escapeSvgText(formatMeanLabel(mean, totalVotes))}</text>`,
  );

  for (let i = 0; i < scaleMax; i++) {
    const count = scoreCounts[i] ?? 0;
    const ratio = mode > 0 ? count / mode : 0;
    const fillH = Math.round(ratio * barAreaHeight);
    const barX = padding + i * (barTrackWidth + 12);
    const isHighlight = highlightIdx === i;
    // Track
    parts.push(
      `<rect x="${barX}" y="${barAreaTop}" width="${barTrackWidth}" height="${barAreaHeight}" fill="${TRACK_BG}" rx="4" ry="4"/>`,
    );
    // Fill (anchored to the bottom of the track)
    parts.push(
      `<rect x="${barX}" y="${barAreaTop + barAreaHeight - fillH}" width="${barTrackWidth}" height="${fillH}" fill="${isHighlight ? BAR_HIGHLIGHT_BG : BAR_BG}" rx="4" ry="4"/>`,
    );
    // Score label below track
    parts.push(
      `<text x="${barX + barTrackWidth / 2}" y="${barAreaTop + barAreaHeight + 18}" font-family="${FONT_FAMILY}" font-size="14" font-weight="${isHighlight ? 700 : 400}" fill="${TEXT_COLOR}" text-anchor="middle">${i + 1}</text>`,
    );
  }

  if (labels !== undefined && labels.length > 0) {
    const leftLabel = labels[0] ?? '';
    const rightLabel = labels[labels.length - 1] ?? '';
    parts.push(
      `<text x="${padding}" y="${endLabelsY}" font-family="${FONT_FAMILY}" font-size="14" fill="${SECONDARY_TEXT_COLOR}">${escapeSvgText(leftLabel)}</text>`,
    );
    parts.push(
      `<text x="${width - padding}" y="${endLabelsY}" font-family="${FONT_FAMILY}" font-size="14" fill="${SECONDARY_TEXT_COLOR}" text-anchor="end">${escapeSvgText(rightLabel)}</text>`,
    );
  }

  parts.push(
    `<text x="${padding}" y="${totalLabelY}" font-family="${FONT_FAMILY}" font-size="18" fill="${TEXT_COLOR}">${escapeSvgText(formatTotalLabel(totalVotes))}</text>`,
  );

  parts.push('</svg>');

  return {
    svg: parts.join(''),
    width,
    height,
    voterCountAtCapture: totalVotes,
  };
}

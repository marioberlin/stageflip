// packages/runtimes/audience/src/clips/live-poll-open-text/export-frame.ts
// T-472 — SVG export-frame emitter for the `live-poll-open-text` clip.
// Pure function: `(snapshot, element) → AudienceExportFrame`. Mirrors
// the static-fallback DOM at low fidelity: a vertical list of rows,
// each with the canonicalised text + a count badge. Entries are sorted
// by count desc (stable for ties) — same defensive sort as the
// static-fallback.

import type { LivePollOpenTextAggregation } from '@stageflip/audience-contract';
import type { LivePollOpenTextClipElement } from '@stageflip/schema';

import {
  type AudienceExportFrame,
  escapeSvgText,
  resolveExportFrameDimensions,
} from '../../export-frame.js';

const TEXT_COLOR = '#111827';
const BADGE_BG = '#3b82f6';
const BADGE_TEXT = '#ffffff';
const ROW_BG = '#f3f4f6';
const FONT_FAMILY = 'sans-serif';

/** Format the bottom total label per the static-fallback precedent. */
export function formatTotalLabel(totalVotes: number): string {
  return `${totalVotes} ${totalVotes === 1 ? 'response' : 'responses'}`;
}

/** Format a per-row count badge per the static-fallback precedent. */
export function formatCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'vote' : 'votes'}`;
}

/**
 * Sort entries by count descending (stable for ties). Pure — returns a
 * new array; never mutates input. Mirrors the static-fallback helper.
 */
export function sortEntriesByCountDesc<T extends { readonly count: number }>(
  entries: readonly T[],
): readonly T[] {
  return [...entries].sort((a, b) => b.count - a.count);
}

export function renderLivePollOpenTextExportFrame(
  snapshot: LivePollOpenTextAggregation,
  element: LivePollOpenTextClipElement,
): AudienceExportFrame {
  const { width, height } = resolveExportFrameDimensions(element);
  const { question } = element.props;
  const sorted = sortEntriesByCountDesc(snapshot.entries);

  const padding = 48;
  const innerW = width - padding * 2;
  const titleY = padding + 32;
  const rowsTop = titleY + 32;
  const rowHeight = 56;
  const visibleRows = Math.max(0, Math.floor((height - rowsTop - padding - 48) / rowHeight));
  const displayed = sorted.slice(0, visibleRows);

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

  for (let i = 0; i < displayed.length; i++) {
    const entry = displayed[i];
    if (entry === undefined) continue;
    const rowY = rowsTop + i * rowHeight;
    const badgeText = formatCountLabel(entry.count);
    const badgeW = 100;
    const badgeX = width - padding - badgeW;
    const badgeH = 28;
    const badgeY = rowY + Math.floor((rowHeight - badgeH) / 2);

    parts.push(
      `<rect x="${padding}" y="${rowY + 4}" width="${innerW}" height="${rowHeight - 8}" fill="${ROW_BG}" rx="6" ry="6"/>`,
    );
    parts.push(
      `<text x="${padding + 12}" y="${rowY + Math.floor(rowHeight / 2) + 6}" font-family="${FONT_FAMILY}" font-size="18" fill="${TEXT_COLOR}">${escapeSvgText(entry.text)}</text>`,
    );
    parts.push(
      `<rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" fill="${BADGE_BG}" rx="14" ry="14"/>`,
    );
    parts.push(
      `<text x="${badgeX + badgeW / 2}" y="${badgeY + badgeH / 2 + 5}" font-family="${FONT_FAMILY}" font-size="14" font-weight="600" fill="${BADGE_TEXT}" text-anchor="middle">${escapeSvgText(badgeText)}</text>`,
    );
  }

  parts.push(
    `<text x="${padding}" y="${height - padding}" font-family="${FONT_FAMILY}" font-size="18" fill="${TEXT_COLOR}">${escapeSvgText(formatTotalLabel(snapshot.totalVotes))}</text>`,
  );

  parts.push('</svg>');

  return {
    svg: parts.join(''),
    width,
    height,
    voterCountAtCapture: snapshot.totalVotes,
  };
}

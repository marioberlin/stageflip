// packages/runtimes/audience/src/clips/leaderboard/export-frame.ts
// T-472 — SVG export-frame emitter for the `leaderboard` clip. Pure
// function: `(snapshot, element) → AudienceExportFrame`. Mirrors the
// static-fallback DOM at low fidelity: a ranked list of voters with
// rank badge, display name, and score; top-3 carry medal markers
// (gold / silver / bronze).

import type { LeaderboardAggregation } from '@stageflip/audience-contract';
import type { LeaderboardClipElement } from '@stageflip/schema';

import {
  type AudienceExportFrame,
  escapeSvgText,
  resolveExportFrameDimensions,
} from '../../export-frame.js';

const TEXT_COLOR = '#111827';
const SECONDARY_TEXT_COLOR = '#6b7280';
const ROW_BG = '#f9fafb';
const ROW_BORDER = '#e5e7eb';
const FONT_FAMILY = 'sans-serif';

const MEDAL_COLORS: Readonly<Record<1 | 2 | 3, string>> = {
  1: '#fbbf24', // gold
  2: '#9ca3af', // silver
  3: '#b45309', // bronze
};

export function formatTotalLabel(total: number): string {
  return `${total} ${total === 1 ? 'participant' : 'participants'}`;
}

/**
 * Resolve the display name. Falls back to "Anonymous voter" when
 * `displayName` is absent — keeps the row content non-empty.
 */
export function resolveDisplayName(displayName: string | undefined): string {
  if (displayName !== undefined && displayName.length > 0) return displayName;
  return 'Anonymous voter';
}

export function renderLeaderboardExportFrame(
  snapshot: LeaderboardAggregation,
  element: LeaderboardClipElement,
): AudienceExportFrame {
  const { width, height } = resolveExportFrameDimensions(element);
  const { title } = element.props;

  const padding = 48;
  const innerW = width - padding * 2;
  const titleY = padding + 32;
  const rowsTop = titleY + 32;
  const rowHeight = 56;
  const totalLabelY = height - padding;
  const availableH = Math.max(0, totalLabelY - rowsTop - 24);
  const visibleRows = Math.max(0, Math.floor(availableH / rowHeight));
  const ranked = [...snapshot.ranking].sort((a, b) => a.rank - b.rank);
  const displayed = ranked.slice(0, visibleRows);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
  );
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

  const headerLabel = title !== undefined && title.length > 0 ? title : 'Leaderboard';
  parts.push(
    `<text x="${padding}" y="${titleY}" font-family="${FONT_FAMILY}" font-size="28" font-weight="700" fill="${TEXT_COLOR}">${escapeSvgText(headerLabel)}</text>`,
  );

  for (let i = 0; i < displayed.length; i++) {
    const entry = displayed[i];
    if (entry === undefined) continue;
    const rowY = rowsTop + i * rowHeight;
    const rank = entry.rank;
    const medal = rank === 1 || rank === 2 || rank === 3 ? MEDAL_COLORS[rank] : undefined;
    parts.push(
      `<rect x="${padding}" y="${rowY + 4}" width="${innerW}" height="${rowHeight - 8}" fill="${ROW_BG}" stroke="${ROW_BORDER}" stroke-width="1" rx="6" ry="6"/>`,
    );
    // Rank badge.
    const badgeR = 16;
    const badgeCx = padding + 28;
    const badgeCy = rowY + rowHeight / 2;
    parts.push(
      `<circle cx="${badgeCx}" cy="${badgeCy}" r="${badgeR}" fill="${medal ?? SECONDARY_TEXT_COLOR}"/>`,
    );
    parts.push(
      `<text x="${badgeCx}" y="${badgeCy + 5}" font-family="${FONT_FAMILY}" font-size="14" font-weight="700" fill="#ffffff" text-anchor="middle">${rank}</text>`,
    );
    // Display name.
    parts.push(
      `<text x="${badgeCx + badgeR + 16}" y="${rowY + Math.floor(rowHeight / 2) + 5}" font-family="${FONT_FAMILY}" font-size="18" fill="${TEXT_COLOR}">${escapeSvgText(resolveDisplayName(entry.displayName))}</text>`,
    );
    // Score.
    parts.push(
      `<text x="${padding + innerW - 16}" y="${rowY + Math.floor(rowHeight / 2) + 5}" font-family="${FONT_FAMILY}" font-size="18" font-weight="600" fill="${TEXT_COLOR}" text-anchor="end">${entry.score}</text>`,
    );
  }

  parts.push(
    `<text x="${padding}" y="${totalLabelY}" font-family="${FONT_FAMILY}" font-size="18" fill="${TEXT_COLOR}">${escapeSvgText(formatTotalLabel(snapshot.totalParticipants))}</text>`,
  );

  parts.push('</svg>');

  return {
    svg: parts.join(''),
    width,
    height,
    voterCountAtCapture: snapshot.totalParticipants,
  };
}

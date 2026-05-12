// packages/runtimes/audience/src/clips/live-poll-multiple-choice/export-frame.ts
// T-472 — SVG export-frame emitter for the `live-poll-multiple-choice`
// clip. Pure function: `(snapshot, element) → AudienceExportFrame`.
// Given identical input bytes the emitted SVG markup is
// byte-identical (CLAUDE.md §3 — no Date / random / fetch / setTimeout).
//
// Layout mirrors `static-fallback.ts` at low fidelity:
//   - Question label at the top.
//   - One horizontal bar per option; width proportional to count.
//   - Per-bar: option label + percentage label aligned right.
//   - Total label at the bottom ("N votes" / "1 vote").

import type { LivePollMultipleChoiceAggregation } from '@stageflip/audience-contract';
import type { LivePollMultipleChoiceClipElement } from '@stageflip/schema';

import {
  type AudienceExportFrame,
  escapeSvgText,
  resolveExportFrameDimensions,
} from '../../export-frame.js';

const TEXT_COLOR = '#111827';
const BAR_COLOR = '#3b82f6';
const TRACK_COLOR = '#e5e7eb';
const FONT_FAMILY = 'sans-serif';

/**
 * Format the bottom total label: `${n} vote` (singular) / `${n} votes`
 * (zero or plural). Mirrors the static-fallback precedent.
 */
export function formatTotalLabel(totalVotes: number): string {
  return `${totalVotes} ${totalVotes === 1 ? 'vote' : 'votes'}`;
}

/**
 * Compute the floored percent (0..100) for a single option's count.
 * Returns 0 when `totalVotes <= 0` to avoid a divide-by-zero NaN.
 */
export function computePercent(count: number, totalVotes: number): number {
  if (totalVotes <= 0) return 0;
  return Math.floor((count / totalVotes) * 100);
}

/**
 * Render the SVG export-frame from a frozen aggregation snapshot +
 * element. Pure: same `(snapshot, element)` → byte-identical SVG.
 */
export function renderLivePollMultipleChoiceExportFrame(
  snapshot: LivePollMultipleChoiceAggregation,
  element: LivePollMultipleChoiceClipElement,
): AudienceExportFrame {
  const { width, height } = resolveExportFrameDimensions(element);
  const { question, options } = element.props;
  const { optionCounts, totalVotes } = snapshot;

  const padding = 48;
  const innerW = width - padding * 2;
  const titleY = padding + 32;
  const barAreaTop = titleY + 32;
  const totalRowHeight = Math.max(
    32,
    Math.min(
      64,
      Math.floor((height - barAreaTop - padding - 32) / Math.max(1, optionCounts.length)),
    ),
  );

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
  );
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

  // Question title.
  parts.push(
    `<text x="${padding}" y="${titleY}" font-family="${FONT_FAMILY}" font-size="28" font-weight="700" fill="${TEXT_COLOR}">${escapeSvgText(question)}</text>`,
  );

  // One bar per option.
  for (let i = 0; i < optionCounts.length; i++) {
    const count = optionCounts[i] ?? 0;
    const label = options[i] ?? `Option ${i + 1}`;
    const percent = computePercent(count, totalVotes);
    const rowY = barAreaTop + i * totalRowHeight;
    const labelColumnW = Math.floor(innerW * 0.25);
    const barTrackX = padding + labelColumnW + 12;
    const percentColumnW = 80;
    const barTrackW = innerW - labelColumnW - percentColumnW - 24;
    const fillW = Math.round((barTrackW * percent) / 100);
    const barH = 24;
    const barY = rowY + Math.floor((totalRowHeight - barH) / 2);

    parts.push(
      `<text x="${padding}" y="${rowY + Math.floor(totalRowHeight / 2) + 6}" font-family="${FONT_FAMILY}" font-size="18" fill="${TEXT_COLOR}">${escapeSvgText(label)}</text>`,
    );
    parts.push(
      `<rect x="${barTrackX}" y="${barY}" width="${barTrackW}" height="${barH}" fill="${TRACK_COLOR}" rx="4" ry="4"/>`,
    );
    parts.push(
      `<rect x="${barTrackX}" y="${barY}" width="${fillW}" height="${barH}" fill="${BAR_COLOR}" rx="4" ry="4"/>`,
    );
    parts.push(
      `<text x="${width - padding}" y="${rowY + Math.floor(totalRowHeight / 2) + 6}" font-family="${FONT_FAMILY}" font-size="18" fill="${TEXT_COLOR}" text-anchor="end">${percent}%</text>`,
    );
  }

  // Total label.
  parts.push(
    `<text x="${padding}" y="${height - padding}" font-family="${FONT_FAMILY}" font-size="18" fill="${TEXT_COLOR}">${escapeSvgText(formatTotalLabel(totalVotes))}</text>`,
  );

  parts.push('</svg>');

  return {
    svg: parts.join(''),
    width,
    height,
    voterCountAtCapture: totalVotes,
  };
}

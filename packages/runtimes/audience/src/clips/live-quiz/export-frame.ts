// packages/runtimes/audience/src/clips/live-quiz/export-frame.ts
// T-472 — SVG export-frame emitter for the `live-quiz` clip. Pure
// function: `(snapshot, element) → AudienceExportFrame`. Mirrors the
// static-fallback DOM at low fidelity: one vertical block per question
// result, each carrying a mini horizontal bar chart with the correct
// option painted in an accent color.

import type { LiveQuizAggregation } from '@stageflip/audience-contract';
import type { LiveQuizClipElement } from '@stageflip/schema';

import {
  type AudienceExportFrame,
  escapeSvgText,
  resolveExportFrameDimensions,
} from '../../export-frame.js';

const TEXT_COLOR = '#111827';
const SECONDARY_TEXT_COLOR = '#6b7280';
const CARD_BG = '#ffffff';
const CARD_BORDER = '#e5e7eb';
const BAR_BG = '#3b82f6';
const CORRECT_BG = '#10b981';
const TRACK_BG = '#e5e7eb';
const FONT_FAMILY = 'sans-serif';

export function formatTotalLabel(total: number): string {
  return `${total} ${total === 1 ? 'voter' : 'voters'}`;
}

export function renderLiveQuizExportFrame(
  snapshot: LiveQuizAggregation,
  element: LiveQuizClipElement,
): AudienceExportFrame {
  const { width, height } = resolveExportFrameDimensions(element);
  const padding = 48;
  const innerW = width - padding * 2;
  const titleY = padding + 32;
  const blocksTop = titleY + 32;
  const totalLabelY = height - padding;

  // Look up question text / options by id from the clip props.
  const questionsById = new Map(element.props.questions.map((q) => [q.id, q]));

  const results = snapshot.questionResults;
  const numBlocks = results.length;
  const availableH = Math.max(0, totalLabelY - blocksTop - 24);
  const blockHeight = numBlocks > 0 ? Math.floor(availableH / numBlocks) : 0;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
  );
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

  parts.push(
    `<text x="${padding}" y="${titleY}" font-family="${FONT_FAMILY}" font-size="28" font-weight="700" fill="${TEXT_COLOR}">Quiz Results</text>`,
  );

  for (let bi = 0; bi < numBlocks; bi++) {
    const result = results[bi];
    if (result === undefined) continue;
    const blockY = blocksTop + bi * blockHeight;
    const question = questionsById.get(result.questionId);
    const questionText = question?.text ?? `Question ${bi + 1}`;
    const options = question?.options ?? [];
    const numOpts = result.optionCounts.length;

    // Card chrome.
    parts.push(
      `<rect x="${padding}" y="${blockY}" width="${innerW}" height="${blockHeight - 12}" fill="${CARD_BG}" stroke="${CARD_BORDER}" stroke-width="1" rx="8" ry="8"/>`,
    );
    parts.push(
      `<text x="${padding + 16}" y="${blockY + 24}" font-family="${FONT_FAMILY}" font-size="18" font-weight="600" fill="${TEXT_COLOR}">${escapeSvgText(questionText)}</text>`,
    );

    // Mini bar chart: one bar per option.
    const chartTop = blockY + 36;
    const chartBottom = blockY + blockHeight - 28;
    const chartHeight = Math.max(0, chartBottom - chartTop);
    const rowH = numOpts > 0 ? Math.floor(chartHeight / numOpts) : 0;
    for (let oi = 0; oi < numOpts; oi++) {
      const count = result.optionCounts[oi] ?? 0;
      const rowY = chartTop + oi * rowH;
      const label = options[oi] ?? `Option ${oi + 1}`;
      const labelColW = 160;
      const trackX = padding + 16 + labelColW + 8;
      const trackW = innerW - 32 - labelColW - 100;
      const barH = Math.max(8, rowH - 8);
      const barY = rowY + Math.floor((rowH - barH) / 2);
      const fillW = result.totalVotes > 0 ? Math.round((trackW * count) / result.totalVotes) : 0;
      const isCorrect = oi === result.correctOptionIndex;

      parts.push(
        `<text x="${padding + 16}" y="${rowY + Math.floor(rowH / 2) + 5}" font-family="${FONT_FAMILY}" font-size="14" fill="${TEXT_COLOR}">${escapeSvgText(label)}</text>`,
      );
      parts.push(
        `<rect x="${trackX}" y="${barY}" width="${trackW}" height="${barH}" fill="${TRACK_BG}" rx="4" ry="4"/>`,
      );
      parts.push(
        `<rect x="${trackX}" y="${barY}" width="${fillW}" height="${barH}" fill="${isCorrect ? CORRECT_BG : BAR_BG}" rx="4" ry="4"/>`,
      );
      parts.push(
        `<text x="${padding + innerW - 16}" y="${rowY + Math.floor(rowH / 2) + 5}" font-family="${FONT_FAMILY}" font-size="14" fill="${TEXT_COLOR}" text-anchor="end">${count}</text>`,
      );
    }

    // Status line.
    parts.push(
      `<text x="${padding + innerW - 16}" y="${blockY + 24}" font-family="${FONT_FAMILY}" font-size="12" fill="${SECONDARY_TEXT_COLOR}" text-anchor="end">${escapeSvgText(result.status)}</text>`,
    );
  }

  parts.push(
    `<text x="${padding}" y="${totalLabelY}" font-family="${FONT_FAMILY}" font-size="18" fill="${TEXT_COLOR}">${escapeSvgText(formatTotalLabel(snapshot.totalVoters))}</text>`,
  );

  parts.push('</svg>');

  return {
    svg: parts.join(''),
    width,
    height,
    voterCountAtCapture: snapshot.totalVoters,
  };
}

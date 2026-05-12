// packages/runtimes/audience/src/clips/survey/export-frame.ts
// T-472 — SVG export-frame emitter for the `survey` clip. Pure
// function: `(snapshot, element) → AudienceExportFrame`. Mirrors the
// static-fallback DOM at low fidelity: a vertical scroll of
// question-result cards. Each card dispatches by question type:
//   - multiple-choice → mini horizontal bar chart, mode-normalised
//   - open-text       → top-5 entry list with count badges
//   - rating          → mini histogram + mean label

import type {
  LivePollMultipleChoiceAggregation,
  LivePollOpenTextAggregation,
  LivePollRatingAggregation,
  SurveyAggregation,
} from '@stageflip/audience-contract';
import type { SurveyClipElement, SurveyQuestion } from '@stageflip/schema';

import {
  type AudienceExportFrame,
  escapeSvgText,
  resolveExportFrameDimensions,
} from '../../export-frame.js';

const TEXT_COLOR = '#111827';
const SECONDARY_TEXT_COLOR = '#6b7280';
const CARD_BG = '#f9fafb';
const BAR_COLOR = '#3b82f6';
const TRACK_COLOR = '#e5e7eb';
const BADGE_BG = '#3b82f6';
const BADGE_TEXT = '#ffffff';
const FONT_FAMILY = 'sans-serif';

export function formatTotalLabel(total: number): string {
  return `${total} ${total === 1 ? 'response' : 'responses'}`;
}

function renderMcCard(
  cardX: number,
  cardY: number,
  cardW: number,
  cardH: number,
  question: Extract<SurveyQuestion, { type: 'multiple-choice' }>,
  aggregation: LivePollMultipleChoiceAggregation,
): string {
  const parts: string[] = [];
  parts.push(
    `<text x="${cardX + 16}" y="${cardY + 28}" font-family="${FONT_FAMILY}" font-size="16" font-weight="600" fill="${TEXT_COLOR}">${escapeSvgText(question.text)}</text>`,
  );
  const chartTop = cardY + 40;
  const chartBottom = cardY + cardH - 12;
  const chartHeight = Math.max(0, chartBottom - chartTop);
  const numOpts = aggregation.optionCounts.length;
  const rowH = numOpts > 0 ? Math.floor(chartHeight / numOpts) : 0;
  let mode = 0;
  for (const c of aggregation.optionCounts) if (c > mode) mode = c;
  const labelColW = Math.floor(cardW * 0.3);
  const trackX = cardX + 16 + labelColW + 8;
  const trackW = cardW - 32 - labelColW - 80;
  for (let oi = 0; oi < numOpts; oi++) {
    const c = aggregation.optionCounts[oi] ?? 0;
    const label = question.options[oi] ?? `Option ${oi + 1}`;
    const rowY = chartTop + oi * rowH;
    const barH = Math.max(6, rowH - 8);
    const barY = rowY + Math.floor((rowH - barH) / 2);
    const fillW = mode > 0 ? Math.round((trackW * c) / mode) : 0;
    parts.push(
      `<text x="${cardX + 16}" y="${rowY + Math.floor(rowH / 2) + 4}" font-family="${FONT_FAMILY}" font-size="13" fill="${TEXT_COLOR}">${escapeSvgText(label)}</text>`,
    );
    parts.push(
      `<rect x="${trackX}" y="${barY}" width="${trackW}" height="${barH}" fill="${TRACK_COLOR}" rx="3" ry="3"/>`,
    );
    parts.push(
      `<rect x="${trackX}" y="${barY}" width="${fillW}" height="${barH}" fill="${BAR_COLOR}" rx="3" ry="3"/>`,
    );
    parts.push(
      `<text x="${cardX + cardW - 16}" y="${rowY + Math.floor(rowH / 2) + 4}" font-family="${FONT_FAMILY}" font-size="13" fill="${TEXT_COLOR}" text-anchor="end">${c}</text>`,
    );
  }
  return parts.join('');
}

function renderOpenTextCard(
  cardX: number,
  cardY: number,
  cardW: number,
  cardH: number,
  question: Extract<SurveyQuestion, { type: 'open-text' }>,
  aggregation: LivePollOpenTextAggregation,
): string {
  const parts: string[] = [];
  parts.push(
    `<text x="${cardX + 16}" y="${cardY + 28}" font-family="${FONT_FAMILY}" font-size="16" font-weight="600" fill="${TEXT_COLOR}">${escapeSvgText(question.text)}</text>`,
  );
  const top = cardY + 40;
  const top5 = [...aggregation.entries].sort((a, b) => b.count - a.count).slice(0, 5);
  const rowH = top5.length > 0 ? Math.floor((cardH - 52) / top5.length) : 0;
  for (let ri = 0; ri < top5.length; ri++) {
    const entry = top5[ri];
    if (entry === undefined) continue;
    const rowY = top + ri * rowH;
    const badgeW = 60;
    const badgeH = 20;
    const badgeX = cardX + cardW - badgeW - 16;
    const badgeY = rowY + Math.floor((rowH - badgeH) / 2);
    parts.push(
      `<text x="${cardX + 16}" y="${rowY + Math.floor(rowH / 2) + 4}" font-family="${FONT_FAMILY}" font-size="13" fill="${TEXT_COLOR}">${escapeSvgText(entry.text)}</text>`,
    );
    parts.push(
      `<rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" fill="${BADGE_BG}" rx="10" ry="10"/>`,
    );
    parts.push(
      `<text x="${badgeX + badgeW / 2}" y="${badgeY + badgeH / 2 + 4}" font-family="${FONT_FAMILY}" font-size="12" font-weight="600" fill="${BADGE_TEXT}" text-anchor="middle">${entry.count}</text>`,
    );
  }
  return parts.join('');
}

function renderRatingCard(
  cardX: number,
  cardY: number,
  cardW: number,
  cardH: number,
  question: Extract<SurveyQuestion, { type: 'rating' }>,
  aggregation: LivePollRatingAggregation,
): string {
  const parts: string[] = [];
  parts.push(
    `<text x="${cardX + 16}" y="${cardY + 28}" font-family="${FONT_FAMILY}" font-size="16" font-weight="600" fill="${TEXT_COLOR}">${escapeSvgText(question.text)}</text>`,
  );
  const meanLabel =
    aggregation.totalVotes === 0 || Number.isNaN(aggregation.mean)
      ? 'Mean: —'
      : `Mean: ${aggregation.mean.toFixed(1)}`;
  parts.push(
    `<text x="${cardX + cardW - 16}" y="${cardY + 28}" font-family="${FONT_FAMILY}" font-size="13" font-weight="600" fill="${SECONDARY_TEXT_COLOR}" text-anchor="end">${escapeSvgText(meanLabel)}</text>`,
  );
  const chartTop = cardY + 44;
  const chartBottom = cardY + cardH - 24;
  const chartH = Math.max(0, chartBottom - chartTop);
  const scaleMax = aggregation.scoreCounts.length;
  let mode = 0;
  for (const c of aggregation.scoreCounts) if (c > mode) mode = c;
  const barTotalW = cardW - 32;
  const barW = scaleMax > 0 ? Math.floor((barTotalW - (scaleMax - 1) * 8) / scaleMax) : 0;
  for (let bi = 0; bi < scaleMax; bi++) {
    const c = aggregation.scoreCounts[bi] ?? 0;
    const fillH = mode > 0 ? Math.round((chartH * c) / mode) : 0;
    const barX = cardX + 16 + bi * (barW + 8);
    parts.push(
      `<rect x="${barX}" y="${chartTop}" width="${barW}" height="${chartH}" fill="${TRACK_COLOR}" rx="3" ry="3"/>`,
    );
    parts.push(
      `<rect x="${barX}" y="${chartTop + chartH - fillH}" width="${barW}" height="${fillH}" fill="${BAR_COLOR}" rx="3" ry="3"/>`,
    );
    parts.push(
      `<text x="${barX + barW / 2}" y="${chartBottom + 16}" font-family="${FONT_FAMILY}" font-size="12" fill="${TEXT_COLOR}" text-anchor="middle">${bi + 1}</text>`,
    );
  }
  return parts.join('');
}

export function renderSurveyExportFrame(
  snapshot: SurveyAggregation,
  element: SurveyClipElement,
): AudienceExportFrame {
  const { width, height } = resolveExportFrameDimensions(element);
  const padding = 48;
  const innerW = width - padding * 2;
  const titleY = padding + 32;
  const cardsTop = titleY + 32;
  const totalLabelY = height - padding;
  const availableH = Math.max(0, totalLabelY - cardsTop - 24);

  const questionsById = new Map(element.props.questions.map((q) => [q.id, q]));
  const aggs = snapshot.questionAggregations;
  const cardCount = aggs.length;
  const cardGap = 12;
  const cardH =
    cardCount > 0 ? Math.floor((availableH - (cardCount - 1) * cardGap) / cardCount) : 0;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
  );
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

  parts.push(
    `<text x="${padding}" y="${titleY}" font-family="${FONT_FAMILY}" font-size="28" font-weight="700" fill="${TEXT_COLOR}">Survey Results</text>`,
  );

  for (let ci = 0; ci < cardCount; ci++) {
    const item = aggs[ci];
    if (item === undefined) continue;
    const cardY = cardsTop + ci * (cardH + cardGap);
    const question = questionsById.get(item.questionId);
    parts.push(
      `<rect x="${padding}" y="${cardY}" width="${innerW}" height="${cardH}" fill="${CARD_BG}" rx="8" ry="8"/>`,
    );
    if (
      question?.type === 'multiple-choice' &&
      item.aggregation.kind === 'live-poll-multiple-choice'
    ) {
      parts.push(renderMcCard(padding, cardY, innerW, cardH, question, item.aggregation));
    } else if (question?.type === 'open-text' && item.aggregation.kind === 'live-poll-open-text') {
      parts.push(renderOpenTextCard(padding, cardY, innerW, cardH, question, item.aggregation));
    } else if (question?.type === 'rating' && item.aggregation.kind === 'live-poll-rating') {
      parts.push(renderRatingCard(padding, cardY, innerW, cardH, question, item.aggregation));
    } else {
      parts.push(
        `<text x="${padding + 16}" y="${cardY + 28}" font-family="${FONT_FAMILY}" font-size="14" fill="${SECONDARY_TEXT_COLOR}">Unrecognised question</text>`,
      );
    }
  }

  parts.push(
    `<text x="${padding}" y="${totalLabelY}" font-family="${FONT_FAMILY}" font-size="18" fill="${TEXT_COLOR}">${escapeSvgText(formatTotalLabel(snapshot.totalResponses))}</text>`,
  );

  parts.push('</svg>');

  return {
    svg: parts.join(''),
    width,
    height,
    voterCountAtCapture: snapshot.totalResponses,
  };
}

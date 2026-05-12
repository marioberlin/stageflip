// packages/runtimes/audience/src/clips/live-qa/export-frame.ts
// T-472 — SVG export-frame emitter for the `live-qa` clip. Pure
// function: `(snapshot, element) → AudienceExportFrame`. Mirrors the
// static-fallback DOM at low fidelity: vertical question cards with
// upvote badges; top-3 (by upvotes) are highlighted; "answered" tag
// appears when the question carries `answered === true`.

import type { LiveQAAggregation } from '@stageflip/audience-contract';
import type { LiveQAClipElement } from '@stageflip/schema';

import {
  type AudienceExportFrame,
  escapeSvgText,
  resolveExportFrameDimensions,
} from '../../export-frame.js';

const TEXT_COLOR = '#111827';
const SECONDARY_TEXT_COLOR = '#6b7280';
const CARD_BG = '#ffffff';
const CARD_BORDER = '#e5e7eb';
const CARD_HIGHLIGHT_BG = '#eff6ff';
const CARD_HIGHLIGHT_BORDER = '#3b82f6';
const BADGE_BG = '#3b82f6';
const BADGE_TEXT = '#ffffff';
const ANSWERED_BG = '#10b981';
const FONT_FAMILY = 'sans-serif';

/** Format the bottom total label. */
export function formatTotalLabel(total: number): string {
  return `${total} ${total === 1 ? 'question' : 'questions'}`;
}

/**
 * Sort questions by upvotes desc, tied by submittedAt ascending. Pure;
 * never mutates input.
 */
export function sortQuestions<Q extends { readonly upvotes: number; readonly submittedAt: string }>(
  questions: readonly Q[],
): readonly Q[] {
  return [...questions].sort((a, b) => {
    if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
    return a.submittedAt < b.submittedAt ? -1 : a.submittedAt > b.submittedAt ? 1 : 0;
  });
}

export function renderLiveQAExportFrame(
  snapshot: LiveQAAggregation,
  element: LiveQAClipElement,
): AudienceExportFrame {
  const { width, height } = resolveExportFrameDimensions(element);
  const { topic } = element.props;

  const sorted = sortQuestions(snapshot.questions);
  const padding = 48;
  const innerW = width - padding * 2;
  const titleY = padding + 32;
  const cardsTop = titleY + 32;
  const cardHeight = 80;
  const cardGap = 12;
  const visibleRows = Math.max(
    0,
    Math.floor((height - cardsTop - padding - 32) / (cardHeight + cardGap)),
  );
  const displayed = sorted.slice(0, visibleRows);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
  );
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

  parts.push(
    `<text x="${padding}" y="${titleY}" font-family="${FONT_FAMILY}" font-size="28" font-weight="700" fill="${TEXT_COLOR}">${escapeSvgText(topic)}</text>`,
  );

  for (let i = 0; i < displayed.length; i++) {
    const q = displayed[i];
    if (q === undefined) continue;
    const isHighlight = i < 3;
    const cardY = cardsTop + i * (cardHeight + cardGap);
    const bg = isHighlight ? CARD_HIGHLIGHT_BG : CARD_BG;
    const stroke = isHighlight ? CARD_HIGHLIGHT_BORDER : CARD_BORDER;
    parts.push(
      `<rect x="${padding}" y="${cardY}" width="${innerW}" height="${cardHeight}" fill="${bg}" stroke="${stroke}" stroke-width="1" rx="8" ry="8"/>`,
    );
    parts.push(
      `<text x="${padding + 16}" y="${cardY + 32}" font-family="${FONT_FAMILY}" font-size="18" font-weight="600" fill="${TEXT_COLOR}">${escapeSvgText(q.text)}</text>`,
    );
    // Upvote badge.
    const badgeW = 80;
    const badgeH = 26;
    const badgeX = padding + innerW - badgeW - 16;
    const badgeY = cardY + 16;
    parts.push(
      `<rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" fill="${BADGE_BG}" rx="13" ry="13"/>`,
    );
    parts.push(
      `<text x="${badgeX + badgeW / 2}" y="${badgeY + badgeH / 2 + 5}" font-family="${FONT_FAMILY}" font-size="13" font-weight="600" fill="${BADGE_TEXT}" text-anchor="middle">▲ ${q.upvotes}</text>`,
    );
    // Submitted-at label.
    parts.push(
      `<text x="${padding + 16}" y="${cardY + cardHeight - 16}" font-family="${FONT_FAMILY}" font-size="12" fill="${SECONDARY_TEXT_COLOR}">${escapeSvgText(q.submittedAt)}</text>`,
    );
    if (q.answered === true) {
      const tagW = 90;
      const tagH = 22;
      const tagX = padding + innerW - tagW - 16;
      const tagY = cardY + cardHeight - tagH - 12;
      parts.push(
        `<rect x="${tagX}" y="${tagY}" width="${tagW}" height="${tagH}" fill="${ANSWERED_BG}" rx="11" ry="11"/>`,
      );
      parts.push(
        `<text x="${tagX + tagW / 2}" y="${tagY + tagH / 2 + 4}" font-family="${FONT_FAMILY}" font-size="12" font-weight="600" fill="#ffffff" text-anchor="middle">Answered</text>`,
      );
    }
  }

  parts.push(
    `<text x="${padding}" y="${height - padding + 8}" font-family="${FONT_FAMILY}" font-size="18" fill="${TEXT_COLOR}">${escapeSvgText(formatTotalLabel(snapshot.totalQuestions))}</text>`,
  );

  parts.push('</svg>');

  return {
    svg: parts.join(''),
    width,
    height,
    voterCountAtCapture: snapshot.totalQuestions,
  };
}

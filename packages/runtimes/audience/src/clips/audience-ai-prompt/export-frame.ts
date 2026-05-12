// packages/runtimes/audience/src/clips/audience-ai-prompt/export-frame.ts
// T-472 — SVG export-frame emitter for the `audience-ai-prompt` clip.
// Three-state dispatch (per ADR-010 §D8 + the T-471 static-fallback):
//
//   - voting    → vertical prompt list with upvote counts.
//   - generating → centred "Generating with AI…" text + winner prompt.
//   - final     → winner prominently displayed + `<rect>` asset
//                  placeholder carrying `data-cache-key` /
//                  `data-modality` attributes + full prompt feed.
//
// Pure function (CLAUDE.md §3). Deterministic.

import type { AudienceAiPromptAggregation } from '@stageflip/audience-contract';
import type { AudienceAiPromptClipElement } from '@stageflip/schema';

import {
  type AudienceExportFrame,
  escapeSvgText,
  resolveExportFrameDimensions,
} from '../../export-frame.js';

const TEXT_COLOR = '#111827';
const SECONDARY_TEXT_COLOR = '#6b7280';
const ACCENT_COLOR = '#7c3aed';
const PLACEHOLDER_BG = '#f3f4f6';
const PLACEHOLDER_BORDER = '#9ca3af';
const ROW_BG = '#f9fafb';
const BADGE_BG = '#7c3aed';
const FONT_FAMILY = 'sans-serif';

export type AudienceAiPromptPhase = 'voting' | 'generating' | 'final';

/**
 * Classify the three states per the snapshot fields. Mirrors the
 * static-fallback's `dispatchByPhase` routing.
 */
export function classifyPhase(snapshot: AudienceAiPromptAggregation): AudienceAiPromptPhase {
  if (snapshot.winnerPromptId === null) return 'voting';
  if (snapshot.generatedAssetCacheKey === null) return 'generating';
  return 'final';
}

export function formatTotalPromptsLabel(total: number): string {
  return `${total} ${total === 1 ? 'prompt' : 'prompts'}`;
}

function renderPromptFeed(
  parts: string[],
  prompts: readonly { readonly id: string; readonly text: string; readonly upvotes: number }[],
  feedX: number,
  feedY: number,
  feedW: number,
  feedH: number,
  winnerId: string | null,
): void {
  if (prompts.length === 0) {
    parts.push(
      `<text x="${feedX}" y="${feedY + 24}" font-family="${FONT_FAMILY}" font-size="14" fill="${SECONDARY_TEXT_COLOR}">No prompts submitted.</text>`,
    );
    return;
  }
  const rowH = 40;
  const visible = Math.max(0, Math.floor(feedH / rowH));
  const sorted = [...prompts].sort((a, b) => b.upvotes - a.upvotes);
  const displayed = sorted.slice(0, visible);
  for (let i = 0; i < displayed.length; i++) {
    const p = displayed[i];
    if (p === undefined) continue;
    const rowY = feedY + i * rowH;
    const isWinner = winnerId !== null && p.id === winnerId;
    const bg = isWinner ? '#ede9fe' : ROW_BG;
    const badgeW = 60;
    const badgeH = 22;
    const badgeX = feedX + feedW - badgeW - 12;
    const badgeY = rowY + Math.floor((rowH - badgeH) / 2);
    parts.push(
      `<rect x="${feedX}" y="${rowY + 4}" width="${feedW}" height="${rowH - 8}" fill="${bg}" rx="6" ry="6"/>`,
    );
    parts.push(
      `<text x="${feedX + 12}" y="${rowY + Math.floor(rowH / 2) + 5}" font-family="${FONT_FAMILY}" font-size="14" fill="${TEXT_COLOR}">${escapeSvgText(p.text)}</text>`,
    );
    parts.push(
      `<rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" fill="${BADGE_BG}" rx="11" ry="11"/>`,
    );
    parts.push(
      `<text x="${badgeX + badgeW / 2}" y="${badgeY + badgeH / 2 + 4}" font-family="${FONT_FAMILY}" font-size="12" font-weight="600" fill="#ffffff" text-anchor="middle">▲ ${p.upvotes}</text>`,
    );
  }
}

export function renderAudienceAiPromptExportFrame(
  snapshot: AudienceAiPromptAggregation,
  element: AudienceAiPromptClipElement,
): AudienceExportFrame {
  const { width, height } = resolveExportFrameDimensions(element);
  const { prompt: questionPrompt, targetModality } = element.props;
  const phase = classifyPhase(snapshot);

  const padding = 48;
  const innerW = width - padding * 2;
  const titleY = padding + 32;
  const stateY = titleY + 28;
  const totalLabelY = height - padding;

  const winnerPrompt =
    snapshot.winnerPromptId !== null
      ? snapshot.prompts.find((p) => p.id === snapshot.winnerPromptId)
      : undefined;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
  );
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

  parts.push(
    `<text x="${padding}" y="${titleY}" font-family="${FONT_FAMILY}" font-size="22" font-weight="700" fill="${TEXT_COLOR}">${escapeSvgText(questionPrompt)}</text>`,
  );
  parts.push(
    `<text x="${padding}" y="${stateY}" font-family="${FONT_FAMILY}" font-size="14" font-weight="600" fill="${ACCENT_COLOR}">${phase}</text>`,
  );

  if (phase === 'voting') {
    const feedTop = stateY + 24;
    const feedH = totalLabelY - feedTop - 24;
    renderPromptFeed(parts, snapshot.prompts, padding, feedTop, innerW, feedH, null);
  } else if (phase === 'generating') {
    const centerX = padding + innerW / 2;
    const centerY = stateY + (totalLabelY - stateY) / 2;
    parts.push(
      `<text x="${centerX}" y="${centerY}" font-family="${FONT_FAMILY}" font-size="24" font-weight="700" fill="${ACCENT_COLOR}" text-anchor="middle">Generating with AI…</text>`,
    );
    if (winnerPrompt !== undefined) {
      parts.push(
        `<text x="${centerX}" y="${centerY + 32}" font-family="${FONT_FAMILY}" font-size="16" fill="${TEXT_COLOR}" text-anchor="middle">${escapeSvgText(winnerPrompt.text)}</text>`,
      );
    }
  } else {
    // final
    const winnerLabelY = stateY + 32;
    if (winnerPrompt !== undefined) {
      parts.push(
        `<text x="${padding}" y="${winnerLabelY}" font-family="${FONT_FAMILY}" font-size="20" font-weight="700" fill="${TEXT_COLOR}">Winner: ${escapeSvgText(winnerPrompt.text)}</text>`,
      );
    }
    const assetTop = winnerLabelY + 16;
    const assetH = Math.floor((totalLabelY - assetTop - 24) * 0.55);
    const cacheKey = snapshot.generatedAssetCacheKey ?? '';
    parts.push(
      `<rect x="${padding}" y="${assetTop}" width="${innerW}" height="${assetH}" fill="${PLACEHOLDER_BG}" stroke="${PLACEHOLDER_BORDER}" stroke-width="2" stroke-dasharray="6 4" data-cache-key="${escapeSvgText(cacheKey)}" data-modality="${escapeSvgText(targetModality)}"/>`,
    );
    parts.push(
      `<text x="${padding + innerW / 2}" y="${assetTop + assetH / 2}" font-family="${FONT_FAMILY}" font-size="14" fill="${SECONDARY_TEXT_COLOR}" text-anchor="middle">${escapeSvgText(`${targetModality}: ${cacheKey}`)}</text>`,
    );
    const feedTop = assetTop + assetH + 16;
    const feedH = totalLabelY - feedTop - 24;
    renderPromptFeed(
      parts,
      snapshot.prompts,
      padding,
      feedTop,
      innerW,
      feedH,
      snapshot.winnerPromptId,
    );
  }

  parts.push(
    `<text x="${padding}" y="${totalLabelY}" font-family="${FONT_FAMILY}" font-size="18" fill="${TEXT_COLOR}">${escapeSvgText(formatTotalPromptsLabel(snapshot.prompts.length))}</text>`,
  );

  parts.push('</svg>');

  return {
    svg: parts.join(''),
    width,
    height,
    voterCountAtCapture: snapshot.prompts.reduce((acc, p) => acc + p.upvotes, 0),
  };
}

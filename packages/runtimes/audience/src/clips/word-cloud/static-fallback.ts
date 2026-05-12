// packages/runtimes/audience/src/clips/word-cloud/static-fallback.ts
// T-467 — Static-fallback renderer for the `word-cloud` clip. Pure
// function: `(snapshot, ctx) → ReactElement`. Given identical snapshot
// + context bytes the output React tree is byte-equal — no Date /
// random / fetch / setTimeout per CLAUDE.md §3 (the audience runtime
// IS inside the determinism perimeter).
//
// Layout (per T-467 spec + ADR-010 §D4):
//   - Flex-wrap container of word spans, sorted by weight desc.
//   - Each span: `<span data-word>{word}</span>` with inline
//     `fontSize: ${14 + (weight / maxWeight) * 36}px` (range 14..50px).
//     The normalisation pegs to the max weight (not totalSubmissions)
//     so a single dominant word doesn't shrink the rest below 14px.
//   - `maxWeight = Math.max(...weights) || 1` (the || 1 guards against
//     divide-by-zero on the impossible all-zero edge case — the
//     contract requires non-negative integer weights and the
//     non-empty-array routing already covers the empty case below).
//   - Total label below the cloud: `${totalSubmissions} submissions` /
//     `1 submission` (singular/plural per the prior families).
//   - Empty-words shape: "Waiting for submissions…" placeholder.
//
// Note: a true word-cloud (physics-packed, rotated, etc.) is
// non-deterministic — out of v1 scope. The flex-wrap layout is the
// deterministic v1 visual.
//
// Determinism note (CLAUDE.md §3): NO `Date.now()`, NO `Math.random()`.
//
// Browser-safe pure JSX (createElement). No DOM API calls; the React
// renderer (the host) materialises the tree.

import type { WordCloudAggregation } from '@stageflip/audience-contract';
import { type ReactElement, createElement } from 'react';

/**
 * Visual context for the static-fallback render. Width / height in CSS
 * px. The optional `prompt` is sourced from `clip.props.prompt` —
 * surfaced above the cloud when present.
 */
export interface WordCloudStaticFallbackContext {
  /** Bounding-box width in CSS px. Positive integer. */
  readonly width: number;
  /** Bounding-box height in CSS px. Positive integer. */
  readonly height: number;
  /**
   * Optional display prompt — rendered above the cloud when present.
   * Sourced from the clip's `props.prompt`.
   */
  readonly prompt?: string;
}

/** Default panel background colour. */
const PANEL_BG = '#ffffff';
/** Default text colour for word spans. */
const TEXT_COLOR = '#111827';
/** Secondary-text colour (prompt, total label). */
const SECONDARY_TEXT_COLOR = '#6b7280';
/** Minimum font size — applied to the lowest-weight word. */
const MIN_FONT_SIZE_PX = 14;
/** Range of font sizes added on top of the minimum (max-weight → +36px). */
const FONT_SIZE_RANGE_PX = 36;

/**
 * Compute the inline font size for a word weight, scaled against the
 * snapshot's `maxWeight`. Pure: same inputs → same px value.
 *
 * Formula: `MIN_FONT_SIZE_PX + (weight / maxWeight) * FONT_SIZE_RANGE_PX`.
 * For `maxWeight === 0` (defensive — the contract requires non-negative
 * integer weights, so a non-empty snapshot always has at least one
 * positive weight unless every voter submitted nothing — which the
 * empty-words routing already filters out), we fall back to the
 * minimum size to avoid NaN.
 */
export function fontSizeForWeight(weight: number, maxWeight: number): number {
  if (maxWeight <= 0) return MIN_FONT_SIZE_PX;
  return MIN_FONT_SIZE_PX + (weight / maxWeight) * FONT_SIZE_RANGE_PX;
}

/**
 * Format the total-submissions label. Matches the `${n} submissions` /
 * `1 submission` singular-plural precedent from the prior families.
 */
export function formatSubmissionsLabel(totalSubmissions: number): string {
  return `${totalSubmissions} ${totalSubmissions === 1 ? 'submission' : 'submissions'}`;
}

/**
 * Resolve the maximum weight in a word list. Returns `1` for an empty
 * list (defensive; the non-empty path is gated upstream) and for an
 * all-zero list. The `|| 1` guard pegs the divide-by-zero edge case.
 */
function maxWeightOf(words: WordCloudAggregation['words']): number {
  let max = 0;
  for (const entry of words) {
    if (entry.weight > max) max = entry.weight;
  }
  return max > 0 ? max : 1;
}

/**
 * Render a single word span. `index` is the span's position in the
 * sorted list (0-based); `entry` is the snapshot row; `maxWeight` is
 * the snapshot's max weight (precomputed for stable normalisation).
 */
function renderWordSpan(input: {
  entry: WordCloudAggregation['words'][number];
  index: number;
  maxWeight: number;
}): ReactElement {
  const { entry, index, maxWeight } = input;
  const fontSize = fontSizeForWeight(entry.weight, maxWeight);
  return createElement(
    'span',
    {
      key: `word-${index}-${entry.word}`,
      'data-word': entry.word,
      'data-weight': entry.weight,
      'data-testid': `word-cloud-word-${index}`,
      style: {
        display: 'inline-block',
        fontSize: `${fontSize}px`,
        lineHeight: 1.2,
        color: TEXT_COLOR,
        padding: '4px 8px',
        fontWeight: 600,
      },
    },
    entry.word,
  );
}

/**
 * Render an idle / waiting placeholder. Used when the snapshot's
 * `words` is empty (no submissions yet).
 */
function renderWaitingPlaceholder(width: number, height: number): ReactElement {
  return createElement(
    'div',
    {
      'data-stageflip-clip': 'word-cloud',
      'data-testid': 'word-cloud-root',
      'data-state': 'waiting',
      style: {
        width: `${width}px`,
        height: `${height}px`,
        boxSizing: 'border-box',
        padding: '16px',
        background: PANEL_BG,
        color: TEXT_COLOR,
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
    },
    createElement(
      'p',
      {
        'data-role': 'waiting-label',
        'data-testid': 'word-cloud-waiting',
        style: { fontSize: '16px', color: SECONDARY_TEXT_COLOR },
      },
      'Waiting for submissions…',
    ),
  );
}

/**
 * Render the static-fallback React tree from a frozen aggregation
 * snapshot + visual context. Pure: same `(snapshot, ctx)` → byte-equal
 * `ReactElement`.
 *
 * Routing (per the T-467 spec):
 *   - `words.length === 0` → "Waiting for submissions…" placeholder.
 *   - otherwise → flex-wrap word cloud with optional prompt above and
 *     `${totalSubmissions} submissions` label below.
 *
 * Words are sorted defensively by `weight` desc before render — the
 * server-side aggregation is expected to deliver them sorted, but we
 * re-sort here to keep the static-fallback pure-of-input-order so
 * snapshot byte-equality survives upstream ordering drift.
 */
export function renderWordCloudStaticFallback(input: {
  readonly snapshot: WordCloudAggregation;
  readonly context: WordCloudStaticFallbackContext;
}): ReactElement {
  const { snapshot, context } = input;
  const { words, totalSubmissions } = snapshot;
  const { width, height, prompt } = context;

  if (words.length === 0) {
    return renderWaitingPlaceholder(width, height);
  }

  // Defensive sort by weight desc; stable on equal weights via index.
  const sorted = [...words].sort((a, b) => b.weight - a.weight);
  const maxWeight = maxWeightOf(sorted);

  const spans = sorted.map((entry, index) => renderWordSpan({ entry, index, maxWeight }));

  const children: ReactElement[] = [];
  if (prompt !== undefined && prompt.length > 0) {
    children.push(
      createElement(
        'h3',
        {
          key: 'prompt',
          'data-role': 'prompt',
          'data-testid': 'word-cloud-prompt',
          style: {
            margin: '0 0 12px 0',
            color: SECONDARY_TEXT_COLOR,
            fontSize: '14px',
            fontWeight: 500,
          },
        },
        prompt,
      ),
    );
  }
  children.push(
    createElement(
      'div',
      {
        key: 'cloud',
        'data-role': 'cloud',
        'data-testid': 'word-cloud-cloud',
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px 8px',
        },
      },
      spans,
    ),
  );
  children.push(
    createElement(
      'span',
      {
        key: 'total-label',
        'data-role': 'total-label',
        'data-testid': 'word-cloud-total',
        'data-total-submissions': totalSubmissions,
        style: {
          display: 'inline-block',
          marginTop: '12px',
          color: SECONDARY_TEXT_COLOR,
          fontSize: '13px',
        },
      },
      formatSubmissionsLabel(totalSubmissions),
    ),
  );

  return createElement(
    'div',
    {
      'data-stageflip-clip': 'word-cloud',
      'data-testid': 'word-cloud-root',
      'data-state': 'aggregated',
      style: {
        width: `${width}px`,
        height: `${height}px`,
        boxSizing: 'border-box',
        padding: '16px',
        background: PANEL_BG,
        color: TEXT_COLOR,
        fontFamily: 'system-ui, sans-serif',
        overflow: 'auto',
      },
    },
    children,
  );
}

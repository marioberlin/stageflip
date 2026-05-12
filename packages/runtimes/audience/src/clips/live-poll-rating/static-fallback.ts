// packages/runtimes/audience/src/clips/live-poll-rating/static-fallback.ts
// T-463 — Static-fallback renderer for the `live-poll-rating` clip.
// Pure function: `(snapshot, ctx) → ReactElement`. Given identical
// snapshot bytes the output React tree is byte-equal — no Date / random
// / fetch / setTimeout per CLAUDE.md §3 (the audience runtime IS inside
// the determinism perimeter).
//
// Layout (per T-463 spec + ADR-010 §D4):
//   - One bar per score 1..scaleMax (where scaleMax === scoreCounts.length).
//   - Bar height is NORMALISED TO THE MODE (max scoreCount) rather than
//     `totalVotes` — gives a readable histogram even at low totals where
//     a totalVotes-normalised pass would collapse every bar near zero.
//   - The bar at `Math.round(mean) - 1` (zero-indexed) is highlighted
//     with an accent colour + `data-highlight="mean"` attribute. When
//     `totalVotes === 0` the mean is `NaN` and no bar is highlighted.
//   - Mean label above the histogram: `Mean: ${mean.toFixed(1)}` when
//     `totalVotes > 0`, else `Mean: —` (literal em-dash, never the
//     `NaN` JS literal).
//   - Total label below the histogram: `${totalVotes} votes`.
//   - When `labels` is supplied, `labels[0]` renders under the leftmost
//     bar and `labels[labels.length - 1]` under the rightmost bar (end
//     annotations only — middle entries in `labels` are not surfaced).
//
// Browser-safe pure JSX (createElement). No DOM API calls; the React
// renderer (the host) materialises the tree.

import type { LivePollRatingAggregation } from '@stageflip/audience-contract';
import { type ReactElement, createElement } from 'react';

/** Visual context for the static-fallback render. Width / height in CSS px. */
export interface LivePollRatingStaticFallbackContext {
  /** Bounding-box width in CSS px. Positive integer. */
  readonly width: number;
  /** Bounding-box height in CSS px. Positive integer. */
  readonly height: number;
  /** Optional question label rendered above the histogram. */
  readonly question?: string;
  /**
   * Optional end-of-scale labels — only `labels[0]` + `labels[last]`
   * are surfaced (under the leftmost + rightmost bars respectively).
   */
  readonly labels?: readonly string[];
}

/** Default bar background colour. */
const BAR_BG = '#3b82f6';
/** Highlight (mean-bar) background colour — a deeper accent. */
const BAR_HIGHLIGHT_BG = '#1d4ed8';
/** Bar track (the un-filled area) background colour. */
const TRACK_BG = '#f3f4f6';
/** Default text colour. */
const TEXT_COLOR = '#111827';
/** Default secondary-text colour (for end labels). */
const SECONDARY_TEXT_COLOR = '#6b7280';

/**
 * Format the mean label. `NaN` (when totalVotes === 0) renders as
 * "Mean: —" with a literal em-dash; never emit the JS `NaN` literal.
 */
export function formatMeanLabel(mean: number, totalVotes: number): string {
  if (totalVotes === 0 || Number.isNaN(mean)) return 'Mean: —';
  return `Mean: ${mean.toFixed(1)}`;
}

/**
 * Format the bottom total label. Singular vs. plural per English style;
 * matches T-461's "N votes" / "1 vote" precedent.
 */
export function formatTotalLabel(totalVotes: number): string {
  return `${totalVotes} ${totalVotes === 1 ? 'vote' : 'votes'}`;
}

/**
 * Compute the zero-indexed bar index that should carry the mean
 * highlight, or `null` when no bar should be highlighted (totalVotes
 * === 0 / NaN mean / out-of-range rounding). The rounded mean is
 * clamped into `[0, scaleMax - 1]` defensively — a malformed
 * aggregation should not throw.
 */
export function meanHighlightIndex(mean: number, scaleMax: number): number | null {
  if (Number.isNaN(mean)) return null;
  const rounded = Math.round(mean);
  const idx = rounded - 1; // zero-indexed bar position for display-score `rounded`
  if (idx < 0 || idx >= scaleMax) return null;
  return idx;
}

/**
 * Render the static-fallback React tree from a frozen aggregation
 * snapshot + visual context. Pure: same `(snapshot, ctx)` → byte-equal
 * `ReactElement`.
 */
export function renderLivePollRatingStaticFallback(input: {
  readonly snapshot: LivePollRatingAggregation;
  readonly context: LivePollRatingStaticFallbackContext;
}): ReactElement {
  const { snapshot, context } = input;
  const { scoreCounts, totalVotes, mean } = snapshot;
  const { width, height, question, labels } = context;

  const scaleMax = scoreCounts.length;

  // Mode-normalised heights. `max === 0` (all-zero counts) ⇒ every bar
  // renders at zero height; the layout still emits one bar per score so
  // the DOM structure is stable across snapshots.
  let mode = 0;
  for (const c of scoreCounts) {
    if (c > mode) mode = c;
  }

  const highlightIdx = meanHighlightIndex(mean, scaleMax);

  // The chart container reserves space for the mean label (top) + the
  // end-labels row (bottom). Use a fixed 64px reservation for both rows
  // when present; this is deterministic and independent of context.
  const TOP_RESERVE = 32;
  const BOTTOM_RESERVE = labels !== undefined && labels.length > 0 ? 24 : 0;
  const CHART_AREA_HEIGHT = 160;

  const bars = scoreCounts.map((count, index) => {
    const ratio = mode > 0 ? count / mode : 0;
    const heightPx = Math.round(ratio * CHART_AREA_HEIGHT);
    const isHighlight = highlightIdx === index;
    return createElement(
      'div',
      {
        key: `bar-${index}`,
        'data-testid': `live-poll-rating-bar-${index}`,
        'data-bar-index': index,
        'data-bar-score': index + 1,
        'data-bar-count': count,
        ...(isHighlight ? { 'data-highlight': 'mean' } : {}),
        style: {
          flex: '1 1 auto',
          margin: '0 4px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
        },
      },
      createElement(
        'div',
        {
          'data-role': 'bar-track',
          style: {
            width: '100%',
            height: `${CHART_AREA_HEIGHT}px`,
            background: TRACK_BG,
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'flex-end',
          },
        },
        createElement('div', {
          'data-role': 'bar-fill',
          'data-testid': `live-poll-rating-fill-${index}`,
          style: {
            width: '100%',
            height: `${heightPx}px`,
            background: isHighlight ? BAR_HIGHLIGHT_BG : BAR_BG,
            borderRadius: '4px',
            transition: 'none',
          },
        }),
      ),
      createElement(
        'div',
        {
          'data-role': 'bar-label',
          'data-testid': `live-poll-rating-label-${index}`,
          style: {
            marginTop: '4px',
            color: TEXT_COLOR,
            fontSize: '12px',
            fontWeight: isHighlight ? 700 : 400,
          },
        },
        String(index + 1),
      ),
    );
  });

  const meanLabel = formatMeanLabel(mean, totalVotes);
  const totalLabel = formatTotalLabel(totalVotes);

  const children: ReactElement[] = [];
  if (question !== undefined && question.length > 0) {
    children.push(
      createElement(
        'h3',
        {
          key: 'question',
          'data-role': 'question',
          'data-testid': 'live-poll-rating-question',
          style: { color: TEXT_COLOR, fontSize: '18px', marginBottom: '8px' },
        },
        question,
      ),
    );
  }
  children.push(
    createElement(
      'div',
      {
        key: 'mean',
        'data-role': 'mean-label',
        'data-testid': 'live-poll-rating-mean',
        style: {
          height: `${TOP_RESERVE}px`,
          color: TEXT_COLOR,
          fontSize: '20px',
          fontWeight: 700,
          marginBottom: '8px',
        },
      },
      meanLabel,
    ),
  );
  children.push(
    createElement(
      'div',
      {
        key: 'bars',
        'data-role': 'bars',
        style: {
          display: 'flex',
          alignItems: 'flex-end',
          height: `${CHART_AREA_HEIGHT + 24}px`, // chart + bar-number row
        },
      },
      bars,
    ),
  );
  if (BOTTOM_RESERVE > 0 && labels !== undefined && labels.length > 0) {
    const leftLabel = labels[0];
    const rightLabel = labels[labels.length - 1];
    children.push(
      createElement(
        'div',
        {
          key: 'end-labels',
          'data-role': 'end-labels',
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '4px',
            color: SECONDARY_TEXT_COLOR,
            fontSize: '12px',
          },
        },
        createElement('span', { 'data-testid': 'live-poll-rating-label-left' }, leftLabel ?? ''),
        createElement('span', { 'data-testid': 'live-poll-rating-label-right' }, rightLabel ?? ''),
      ),
    );
  }
  children.push(
    createElement(
      'div',
      {
        key: 'total',
        'data-role': 'total-votes',
        'data-testid': 'live-poll-rating-total',
        style: { marginTop: '12px', color: TEXT_COLOR, fontSize: '14px' },
      },
      totalLabel,
    ),
  );

  return createElement(
    'div',
    {
      'data-stageflip-clip': 'live-poll-rating',
      'data-testid': 'live-poll-rating-root',
      style: {
        width: `${width}px`,
        height: `${height}px`,
        boxSizing: 'border-box',
        padding: '16px',
        background: '#ffffff',
        color: TEXT_COLOR,
        fontFamily: 'system-ui, sans-serif',
      },
    },
    children,
  );
}

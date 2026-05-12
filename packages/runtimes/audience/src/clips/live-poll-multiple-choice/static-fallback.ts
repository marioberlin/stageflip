// packages/runtimes/audience/src/clips/live-poll-multiple-choice/static-fallback.ts
// T-461 — Static-fallback renderer for the `live-poll-multiple-choice`
// clip. Pure function: `(snapshot, ctx) → ReactElement`. Given identical
// snapshot bytes the output React tree is byte-equal — no Date / random
// / fetch / setTimeout per CLAUDE.md §3 (the audience runtime IS inside
// the determinism perimeter).
//
// Layout (per T-461 spec + ADR-010 §D4):
//   - One horizontal bar per option.
//   - Bar width fraction = optionCounts[i] / max(totalVotes, 1).
//   - Percentage label overlaid; option label aligned left of the bar.
//   - Total-votes label at the bottom ("N votes").
//
// Browser-safe pure JSX (createElement). No DOM API calls; the React
// renderer (the host) materialises the tree.

import type { LivePollMultipleChoiceAggregation } from '@stageflip/audience-contract';
import { type ReactElement, createElement } from 'react';

/** Visual context for the static-fallback render. Width / height in CSS px. */
export interface LivePollMultipleChoiceStaticFallbackContext {
  /** Bounding-box width in CSS px. Positive integer. */
  readonly width: number;
  /** Bounding-box height in CSS px. Positive integer. */
  readonly height: number;
  /** Per-option label list, in option-index order. Length should equal `optionCounts.length`. */
  readonly optionLabels: readonly string[];
  /** Optional question label rendered above the bars. */
  readonly question?: string;
}

/** Default bar background colour (a tinted blue) — overridable later via theme. */
const BAR_COLOR = '#3b82f6';
/** Default bar track (background-of-bar) colour. */
const TRACK_COLOR = '#e5e7eb';
/** Default text colour. */
const TEXT_COLOR = '#111827';

/**
 * Compute the bar fraction for one option: count / max(totalVotes, 1).
 * Returns `0` when `totalVotes === 0` so the bars render as empty
 * tracks rather than dividing by zero.
 *
 * Pure integer arithmetic; deterministic per CLAUDE.md §3.
 */
export function computeBarFraction(count: number, totalVotes: number): number {
  if (totalVotes <= 0) return 0;
  return count / totalVotes;
}

/**
 * Compute the integer percentage display value for one option (0..100).
 * `Math.floor` keeps the output deterministic; rounding mode is fixed.
 */
export function computePercent(count: number, totalVotes: number): number {
  if (totalVotes <= 0) return 0;
  return Math.floor((count / totalVotes) * 100);
}

/**
 * Render the static-fallback React tree from a frozen aggregation
 * snapshot + visual context. Pure: same `(snapshot, ctx)` → byte-equal
 * `ReactElement`.
 */
export function renderLivePollMultipleChoiceStaticFallback(input: {
  readonly snapshot: LivePollMultipleChoiceAggregation;
  readonly context: LivePollMultipleChoiceStaticFallbackContext;
}): ReactElement {
  const { snapshot, context } = input;
  const { optionCounts, totalVotes } = snapshot;
  const { width, height, optionLabels, question } = context;

  const bars = optionCounts.map((count, index) => {
    const label = optionLabels[index] ?? `Option ${index + 1}`;
    const fraction = computeBarFraction(count, totalVotes);
    const percent = computePercent(count, totalVotes);
    return createElement(
      'div',
      {
        key: `bar-${index}`,
        'data-testid': `live-poll-mc-bar-${index}`,
        'data-bar-index': index,
        'data-bar-fraction': fraction.toFixed(6),
        'data-bar-count': count,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        },
      },
      createElement(
        'div',
        {
          'data-role': 'option-label',
          style: { width: '120px', color: TEXT_COLOR, fontSize: '14px' },
        },
        label,
      ),
      createElement(
        'div',
        {
          'data-role': 'bar-track',
          style: {
            position: 'relative',
            flex: '1 1 auto',
            height: '24px',
            background: TRACK_COLOR,
            borderRadius: '4px',
            overflow: 'hidden',
          },
        },
        createElement('div', {
          'data-role': 'bar-fill',
          'data-testid': `live-poll-mc-bar-fill-${index}`,
          style: {
            width: `${(fraction * 100).toFixed(4)}%`,
            height: '100%',
            background: BAR_COLOR,
          },
        }),
      ),
      createElement(
        'div',
        {
          'data-role': 'percent-label',
          'data-testid': `live-poll-mc-percent-${index}`,
          style: { width: '48px', color: TEXT_COLOR, fontSize: '14px', textAlign: 'right' },
        },
        `${percent}%`,
      ),
    );
  });

  const totalLabel = `${totalVotes} ${totalVotes === 1 ? 'vote' : 'votes'}`;

  const children: ReactElement[] = [];
  if (question !== undefined && question.length > 0) {
    children.push(
      createElement(
        'h3',
        {
          key: 'question',
          'data-role': 'question',
          'data-testid': 'live-poll-mc-question',
          style: { color: TEXT_COLOR, fontSize: '18px', marginBottom: '12px' },
        },
        question,
      ),
    );
  }
  children.push(
    createElement(
      'div',
      {
        key: 'bars',
        'data-role': 'bars',
        style: { display: 'flex', flexDirection: 'column' },
      },
      bars,
    ),
  );
  children.push(
    createElement(
      'div',
      {
        key: 'total',
        'data-role': 'total-votes',
        'data-testid': 'live-poll-mc-total',
        style: { marginTop: '12px', color: TEXT_COLOR, fontSize: '14px' },
      },
      totalLabel,
    ),
  );

  return createElement(
    'div',
    {
      'data-stageflip-clip': 'live-poll-multiple-choice',
      'data-testid': 'live-poll-mc-root',
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

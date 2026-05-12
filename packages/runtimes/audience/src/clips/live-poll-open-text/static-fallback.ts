// packages/runtimes/audience/src/clips/live-poll-open-text/static-fallback.ts
// T-462 — Static-fallback renderer for the `live-poll-open-text` clip.
// Pure function: `(snapshot, ctx) → ReactElement`. Given identical
// snapshot bytes the output React tree is byte-equal — no Date / random
// / fetch / setTimeout per CLAUDE.md §3 (the audience runtime IS inside
// the determinism perimeter).
//
// Layout (per T-462 spec + ADR-010 §D4):
//   - One row per top-N entry.
//   - Row shows the canonicalised text + a count badge ("N votes").
//   - Rows are ordered by count desc — defensively re-sorted client-side
//     even though the server already emits ordered entries (the
//     `entries` ordering is part of the contract; resorting is a
//     belt-and-braces guard against a non-conforming aggregator).
//   - Total label at the bottom ("N responses" / "1 response").
//
// Browser-safe pure JSX (createElement). No DOM API calls; the React
// renderer (the host) materialises the tree.

import type { LivePollOpenTextAggregation } from '@stageflip/audience-contract';
import { type ReactElement, createElement } from 'react';

/** Visual context for the static-fallback render. Width / height in CSS px. */
export interface LivePollOpenTextStaticFallbackContext {
  /** Bounding-box width in CSS px. Positive integer. */
  readonly width: number;
  /** Bounding-box height in CSS px. Positive integer. */
  readonly height: number;
  /** Optional question label rendered above the entries. */
  readonly question?: string;
}

/** Default row background colour (white-on-tinted-grey track for contrast). */
const ROW_BG = '#f3f4f6';
/** Default count-badge background colour (a tinted blue). */
const BADGE_BG = '#3b82f6';
/** Default count-badge text colour. */
const BADGE_TEXT = '#ffffff';
/** Default text colour. */
const TEXT_COLOR = '#111827';

/**
 * Sort entries by count descending (stable for ties — preserves the
 * server-supplied ordering when counts collide). Pure: returns a new
 * array; never mutates the input.
 */
export function sortEntriesByCountDesc(
  entries: readonly { readonly text: string; readonly count: number }[],
): readonly { readonly text: string; readonly count: number }[] {
  // Array.prototype.sort is stable per ECMAScript 2019+; deterministic.
  return [...entries].sort((a, b) => b.count - a.count);
}

/**
 * Format the bottom total label. Singular vs. plural per English style;
 * matches T-461's "N votes" / "1 vote" precedent.
 */
export function formatTotalLabel(totalVotes: number): string {
  return `${totalVotes} ${totalVotes === 1 ? 'response' : 'responses'}`;
}

/**
 * Format a per-row count badge. Singular vs. plural per English style.
 */
export function formatCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'vote' : 'votes'}`;
}

/**
 * Render the static-fallback React tree from a frozen aggregation
 * snapshot + visual context. Pure: same `(snapshot, ctx)` → byte-equal
 * `ReactElement`.
 */
export function renderLivePollOpenTextStaticFallback(input: {
  readonly snapshot: LivePollOpenTextAggregation;
  readonly context: LivePollOpenTextStaticFallbackContext;
}): ReactElement {
  const { snapshot, context } = input;
  const { entries, totalVotes } = snapshot;
  const { width, height, question } = context;

  const sorted = sortEntriesByCountDesc(entries);

  const rows = sorted.map((entry, index) =>
    createElement(
      'div',
      {
        key: `row-${index}`,
        'data-testid': `live-poll-ot-row-${index}`,
        'data-row-index': index,
        'data-row-count': entry.count,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          marginBottom: '6px',
          background: ROW_BG,
          borderRadius: '4px',
        },
      },
      createElement(
        'div',
        {
          'data-role': 'entry-text',
          'data-testid': `live-poll-ot-text-${index}`,
          style: {
            flex: '1 1 auto',
            color: TEXT_COLOR,
            fontSize: '14px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          },
        },
        entry.text,
      ),
      createElement(
        'div',
        {
          'data-role': 'count-badge',
          'data-testid': `live-poll-ot-count-${index}`,
          style: {
            flex: '0 0 auto',
            padding: '2px 10px',
            borderRadius: '999px',
            background: BADGE_BG,
            color: BADGE_TEXT,
            fontSize: '12px',
            fontWeight: 600,
          },
        },
        formatCountLabel(entry.count),
      ),
    ),
  );

  const totalLabel = formatTotalLabel(totalVotes);

  const children: ReactElement[] = [];
  if (question !== undefined && question.length > 0) {
    children.push(
      createElement(
        'h3',
        {
          key: 'question',
          'data-role': 'question',
          'data-testid': 'live-poll-ot-question',
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
        key: 'rows',
        'data-role': 'rows',
        style: { display: 'flex', flexDirection: 'column' },
      },
      rows,
    ),
  );
  children.push(
    createElement(
      'div',
      {
        key: 'total',
        'data-role': 'total-responses',
        'data-testid': 'live-poll-ot-total',
        style: { marginTop: '12px', color: TEXT_COLOR, fontSize: '14px' },
      },
      totalLabel,
    ),
  );

  return createElement(
    'div',
    {
      'data-stageflip-clip': 'live-poll-open-text',
      'data-testid': 'live-poll-ot-root',
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

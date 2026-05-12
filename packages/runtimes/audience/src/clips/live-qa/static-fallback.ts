// packages/runtimes/audience/src/clips/live-qa/static-fallback.ts
// T-464 — Static-fallback renderer for the `live-qa` clip. Pure
// function: `(snapshot, ctx) → ReactElement`. Given identical snapshot
// + context bytes the output React tree is byte-equal — no Date /
// random / fetch / setTimeout per CLAUDE.md §3 (the audience runtime IS
// inside the determinism perimeter).
//
// Layout (per T-464 spec + ADR-010 §D4):
//   - Vertical list of question cards. One card per question.
//   - Defensive sort by `upvotes` desc; secondary sort by `submittedAt`
//     ascending for stable tie-breaking. Server-side ordering is
//     respected when already-sorted; the defensive sort guards against
//     bug-class drift.
//   - The TOP-3 cards (post-sort) carry `data-highlight="popular"`.
//   - Each card renders: question text, upvote count badge, "answered"
//     badge if `answered === true`, relative-time string from
//     `submittedAt`.
//   - Total label below: `${totalQuestions} questions` (singular /
//     plural per English).
//
// Determinism note (CLAUDE.md §3): relative-time computation is a
// PURE function of `submittedAt` + the injected `context.now` (epoch
// ms). NO `Date.now()`. The host injects `now` from the deterministic
// frame clock; tests pass a controlled value.
//
// Browser-safe pure JSX (createElement). No DOM API calls; the React
// renderer (the host) materialises the tree.

import type { LiveQAAggregation } from '@stageflip/audience-contract';
import { type ReactElement, createElement } from 'react';

/** Visual context for the static-fallback render. Width / height in CSS px. */
export interface LiveQAStaticFallbackContext {
  /** Bounding-box width in CSS px. Positive integer. */
  readonly width: number;
  /** Bounding-box height in CSS px. Positive integer. */
  readonly height: number;
  /** Optional topic label rendered above the question list. */
  readonly topic?: string;
  /**
   * Injected wall-clock for the relative-time computation, expressed as
   * epoch milliseconds. The host derives this deterministically from
   * the frame clock; the absence of this prop renders every card with
   * the literal "Just now" relative-time (see `formatRelativeTime`).
   * Required for any consumer that wants per-question relative-time
   * labels to drift over the timeline; tests pass a controlled value.
   */
  readonly now?: number;
}

/** Default card background colour. */
const CARD_BG = '#ffffff';
/** Highlight (top-3 popular) card background colour — a subtle accent ring. */
const CARD_HIGHLIGHT_BG = '#eff6ff';
/** Card border colour. */
const CARD_BORDER = '#e5e7eb';
/** Highlight (top-3) card border colour — a tinted accent. */
const CARD_HIGHLIGHT_BORDER = '#3b82f6';
/** Default text colour. */
const TEXT_COLOR = '#111827';
/** Default secondary-text colour (for badges + relative-time label). */
const SECONDARY_TEXT_COLOR = '#6b7280';
/** Upvote badge background colour. */
const UPVOTE_BG = '#f3f4f6';
/** Answered badge background colour — a tinted green. */
const ANSWERED_BG = '#d1fae5';
/** Answered badge text colour — a deeper green for accessibility. */
const ANSWERED_TEXT = '#065f46';

/** Cap on how many cards carry the `data-highlight="popular"` attribute. */
const POPULAR_HIGHLIGHT_COUNT = 3;

/** Question shape projected from `LiveQAAggregation.questions[i]`. */
interface SortableQuestion {
  readonly id: string;
  readonly text: string;
  readonly upvotes: number;
  readonly submittedAt: string;
  readonly answered?: boolean;
}

/**
 * Defensive sort: upvotes desc; secondary `submittedAt` asc for stable
 * tie-breaking. Returns a NEW array; the input is not mutated.
 */
export function sortQuestions(questions: readonly SortableQuestion[]): readonly SortableQuestion[] {
  return [...questions].sort((a, b) => {
    if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
    if (a.submittedAt < b.submittedAt) return -1;
    if (a.submittedAt > b.submittedAt) return 1;
    return 0;
  });
}

/**
 * Format the bottom total label. Singular vs. plural per English style;
 * matches T-461's "N votes" / "1 vote" precedent.
 */
export function formatTotalLabel(totalQuestions: number): string {
  return `${totalQuestions} ${totalQuestions === 1 ? 'question' : 'questions'}`;
}

/**
 * Format an upvote badge label. Singular / plural per English.
 */
export function formatUpvoteLabel(upvotes: number): string {
  return `${upvotes} ${upvotes === 1 ? 'upvote' : 'upvotes'}`;
}

/**
 * Format a relative-time label from a `submittedAt` ISO 8601 string and
 * an injected `now` epoch-ms value.
 *
 * Pure function: same `(submittedAt, now)` ⇒ byte-equal string. NO
 * `Date.now()` — the input `now` is the deterministic clock the host
 * derived from the frame number.
 *
 * Behaviour:
 *   - `now` undefined ⇒ "Just now" (the host has not injected a clock
 *     yet; relative-time labels are not meaningful in this state).
 *   - submittedAt invalid ⇒ "Just now" (defensive — a malformed
 *     aggregation should not throw).
 *   - delta < 60s ⇒ "Just now".
 *   - delta < 120s ⇒ "Asked 1 min ago".
 *   - delta ≥ 120s ⇒ `Asked ${minutes} min ago`.
 */
export function formatRelativeTime(submittedAt: string, now: number | undefined): string {
  if (now === undefined) return 'Just now';
  const submittedAtMs = Date.parse(submittedAt);
  if (Number.isNaN(submittedAtMs)) return 'Just now';
  const deltaMs = now - submittedAtMs;
  if (deltaMs < 60_000) return 'Just now';
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes === 1) return 'Asked 1 min ago';
  return `Asked ${minutes} min ago`;
}

/**
 * Render the static-fallback React tree from a frozen aggregation
 * snapshot + visual context. Pure: same `(snapshot, ctx)` → byte-equal
 * `ReactElement`.
 */
export function renderLiveQAStaticFallback(input: {
  readonly snapshot: LiveQAAggregation;
  readonly context: LiveQAStaticFallbackContext;
}): ReactElement {
  const { snapshot, context } = input;
  const { questions, totalQuestions } = snapshot;
  const { width, height, topic, now } = context;

  const sorted = sortQuestions(questions);

  const cards = sorted.map((q, index) => {
    const isPopular = index < POPULAR_HIGHLIGHT_COUNT;
    const isAnswered = q.answered === true;
    const relativeTime = formatRelativeTime(q.submittedAt, now);
    const upvoteLabel = formatUpvoteLabel(q.upvotes);

    const cardChildren: ReactElement[] = [];

    // Top row: question text.
    cardChildren.push(
      createElement(
        'p',
        {
          key: 'text',
          'data-role': 'question-text',
          'data-testid': `live-qa-text-${index}`,
          style: {
            margin: 0,
            color: TEXT_COLOR,
            fontSize: '16px',
            fontWeight: 500,
          },
        },
        q.text,
      ),
    );

    // Bottom row: badges + relative-time label.
    const meta: ReactElement[] = [];
    meta.push(
      createElement(
        'span',
        {
          key: 'upvote-badge',
          'data-role': 'upvote-badge',
          'data-testid': `live-qa-upvotes-${index}`,
          'data-upvote-count': q.upvotes,
          style: {
            background: UPVOTE_BG,
            color: SECONDARY_TEXT_COLOR,
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '12px',
          },
        },
        upvoteLabel,
      ),
    );
    if (isAnswered) {
      meta.push(
        createElement(
          'span',
          {
            key: 'answered-badge',
            'data-role': 'answered-badge',
            'data-testid': `live-qa-answered-${index}`,
            style: {
              background: ANSWERED_BG,
              color: ANSWERED_TEXT,
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 600,
            },
          },
          'Answered',
        ),
      );
    }
    meta.push(
      createElement(
        'span',
        {
          key: 'relative-time',
          'data-role': 'relative-time',
          'data-testid': `live-qa-relative-time-${index}`,
          style: {
            color: SECONDARY_TEXT_COLOR,
            fontSize: '12px',
            marginLeft: 'auto',
          },
        },
        relativeTime,
      ),
    );
    cardChildren.push(
      createElement(
        'div',
        {
          key: 'meta',
          'data-role': 'card-meta',
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '8px',
          },
        },
        meta,
      ),
    );

    const cardProps: Record<string, unknown> = {
      key: `card-${q.id}`,
      'data-testid': `live-qa-card-${index}`,
      'data-question-id': q.id,
      'data-card-index': index,
      style: {
        background: isPopular ? CARD_HIGHLIGHT_BG : CARD_BG,
        border: `1px solid ${isPopular ? CARD_HIGHLIGHT_BORDER : CARD_BORDER}`,
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '8px',
      },
    };
    if (isPopular) cardProps['data-highlight'] = 'popular';
    return createElement('article', cardProps, cardChildren);
  });

  const totalLabel = formatTotalLabel(totalQuestions);

  const children: ReactElement[] = [];
  if (topic !== undefined && topic.length > 0) {
    children.push(
      createElement(
        'h3',
        {
          key: 'topic',
          'data-role': 'topic',
          'data-testid': 'live-qa-topic',
          style: { color: TEXT_COLOR, fontSize: '18px', marginBottom: '12px' },
        },
        topic,
      ),
    );
  }
  children.push(
    createElement(
      'div',
      {
        key: 'cards',
        'data-role': 'cards',
        'data-testid': 'live-qa-cards',
        style: {
          display: 'flex',
          flexDirection: 'column',
        },
      },
      cards,
    ),
  );
  children.push(
    createElement(
      'div',
      {
        key: 'total',
        'data-role': 'total',
        'data-testid': 'live-qa-total',
        style: { marginTop: '12px', color: TEXT_COLOR, fontSize: '14px' },
      },
      totalLabel,
    ),
  );

  return createElement(
    'div',
    {
      'data-stageflip-clip': 'live-qa',
      'data-testid': 'live-qa-root',
      style: {
        width: `${width}px`,
        height: `${height}px`,
        boxSizing: 'border-box',
        padding: '16px',
        background: '#ffffff',
        color: TEXT_COLOR,
        fontFamily: 'system-ui, sans-serif',
        overflow: 'auto',
      },
    },
    children,
  );
}

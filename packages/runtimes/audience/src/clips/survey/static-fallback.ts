// packages/runtimes/audience/src/clips/survey/static-fallback.ts
// T-468 — Static-fallback renderer for the `survey` clip. Pure
// function: `(snapshot, ctx) → ReactElement`. Given identical snapshot
// + context bytes the output React tree is byte-equal — no Date /
// random / fetch / setTimeout per CLAUDE.md §3 (the audience runtime
// IS inside the determinism perimeter).
//
// Layout (per T-468 spec + ADR-010 §D4):
//   - Vertical scroll of question-result cards. One card per entry in
//     `snapshot.questionAggregations`.
//   - Each card carries:
//       - the question text (looked up by id from `ctx.questions`);
//       - a type-specific mini-rendering:
//           * `multiple-choice` → mini horizontal bar chart (one bar
//             per option; width = `optionCounts[i] / max(optionCounts)
//             * 100%`, mode-normalised);
//           * `open-text` → top-5 entries as list rows (truncated to 5
//             to keep the card compact); each row shows `text` + a
//             count badge;
//           * `rating` → mini histogram (one bar per score
//             1..scaleMax); mean label `Mean: X.X` (or `Mean: —` when
//             totalVotes === 0 / mean is NaN).
//   - Total label at the bottom: `${totalResponses} responses` /
//     `1 response` (singular/plural per the prior families).
//   - Empty-snapshot routing: zero `questionAggregations` renders a
//     "Waiting for responses…" placeholder.
//
// **Reuse note**: rather than re-importing the per-LivePoll-variant
// renderers (which carry their own card chrome + total labels we don't
// want inside a sub-card), this module re-implements the three
// mini-renderings inline. The visual contract matches the LivePoll
// variants but the chrome is stripped — the survey aggregate carries
// the overall total label exactly once.
//
// Browser-safe pure JSX (createElement). No DOM API calls; the React
// renderer (the host) materialises the tree.

import type {
  LivePollMultipleChoiceAggregation,
  LivePollOpenTextAggregation,
  LivePollRatingAggregation,
  SurveyAggregation,
} from '@stageflip/audience-contract';
import type { SurveyQuestion } from '@stageflip/schema';
import { type ReactElement, createElement } from 'react';

/**
 * Visual context for the static-fallback render. Width / height in CSS
 * px. `questions` is the schema-side per-question array sourced from
 * `clip.props.questions` — used to look up the question text + option
 * labels by id when rendering each card.
 */
export interface SurveyStaticFallbackContext {
  /** Bounding-box width in CSS px. Positive integer. */
  readonly width: number;
  /** Bounding-box height in CSS px. Positive integer. */
  readonly height: number;
  /**
   * Per-question schema from `clip.props.questions`. The renderer
   * matches `questionAggregations[i].questionId` to a question by id
   * to surface the text + multiple-choice options + rating labels.
   */
  readonly questions: readonly SurveyQuestion[];
}

/** Default panel background colour. */
const PANEL_BG = '#ffffff';
/** Card background colour (slightly tinted track for contrast). */
const CARD_BG = '#f9fafb';
/** Bar colour (a tinted blue). */
const BAR_COLOR = '#3b82f6';
/** Bar track background. */
const TRACK_COLOR = '#e5e7eb';
/** Default text colour. */
const TEXT_COLOR = '#111827';
/** Secondary text colour. */
const SECONDARY_TEXT_COLOR = '#6b7280';
/** Badge background colour for open-text count badges. */
const BADGE_BG = '#3b82f6';
/** Badge text colour. */
const BADGE_TEXT = '#ffffff';

/**
 * Format the total-responses label. Matches the `${n} responses` /
 * `1 response` singular-plural precedent from the prior families.
 */
export function formatTotalResponsesLabel(totalResponses: number): string {
  return `${totalResponses} ${totalResponses === 1 ? 'response' : 'responses'}`;
}

/**
 * Format the rating mean label. `NaN` (or `totalVotes === 0`) renders
 * as `Mean: —` with a literal em-dash; never emit the JS `NaN`
 * literal. Mirrors `live-poll-rating`'s `formatMeanLabel`.
 */
export function formatMeanLabel(mean: number, totalVotes: number): string {
  if (totalVotes === 0 || Number.isNaN(mean)) return 'Mean: —';
  return `Mean: ${mean.toFixed(1)}`;
}

/**
 * Mode-normalised bar fraction for a count: `count / max(counts) * 100%`.
 * Returns `0` when `mode === 0` so all-zero bars render as empty tracks
 * rather than dividing by zero.
 */
function modeNormalisedFraction(count: number, mode: number): number {
  if (mode <= 0) return 0;
  return count / mode;
}

/**
 * Resolve the mode (max value) of a count array. Returns `0` for an
 * empty array.
 */
function modeOf(counts: readonly number[]): number {
  let m = 0;
  for (const c of counts) {
    if (c > m) m = c;
  }
  return m;
}

/**
 * Render a mini multiple-choice bar chart. One horizontal bar per
 * option; widths mode-normalised. Mirrors `live-poll-multiple-choice`'s
 * static-fallback layout but with the surrounding card chrome stripped
 * (the survey card supplies its own chrome).
 */
function renderMultipleChoiceMini(input: {
  cardId: string;
  aggregation: LivePollMultipleChoiceAggregation;
  options: readonly string[];
}): ReactElement {
  const { cardId, aggregation, options } = input;
  const { optionCounts } = aggregation;
  const mode = modeOf(optionCounts);

  const bars = optionCounts.map((count, index) => {
    const fraction = modeNormalisedFraction(count, mode);
    const label = options[index] ?? `Option ${index + 1}`;
    return createElement(
      'div',
      {
        key: `bar-${index}`,
        'data-testid': `survey-${cardId}-mc-bar-${index}`,
        'data-bar-index': index,
        'data-bar-count': count,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '6px',
        },
      },
      createElement(
        'div',
        {
          'data-role': 'option-label',
          style: { width: '100px', color: TEXT_COLOR, fontSize: '12px' },
        },
        label,
      ),
      createElement(
        'div',
        {
          'data-role': 'bar-track',
          style: {
            flex: '1 1 auto',
            height: '18px',
            background: TRACK_COLOR,
            borderRadius: '4px',
            overflow: 'hidden',
          },
        },
        createElement('div', {
          'data-role': 'bar-fill',
          'data-testid': `survey-${cardId}-mc-bar-fill-${index}`,
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
          'data-role': 'count-label',
          style: { width: '32px', color: TEXT_COLOR, fontSize: '12px', textAlign: 'right' },
        },
        String(count),
      ),
    );
  });

  return createElement(
    'div',
    {
      'data-role': 'mc-mini',
      'data-testid': `survey-${cardId}-mc`,
      style: { display: 'flex', flexDirection: 'column' },
    },
    bars,
  );
}

/**
 * Render a mini open-text list. Top-5 entries (defensively truncated)
 * as list rows. Each row shows the text + a count badge.
 */
function renderOpenTextMini(input: {
  cardId: string;
  aggregation: LivePollOpenTextAggregation;
}): ReactElement {
  const { cardId, aggregation } = input;
  const top5 = aggregation.entries.slice(0, 5);
  const rows = top5.map((entry, index) =>
    createElement(
      'div',
      {
        key: `row-${index}`,
        'data-testid': `survey-${cardId}-ot-row-${index}`,
        'data-row-index': index,
        'data-row-count': entry.count,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 8px',
          marginBottom: '4px',
          background: PANEL_BG,
          borderRadius: '4px',
        },
      },
      createElement(
        'div',
        {
          'data-role': 'entry-text',
          style: {
            flex: '1 1 auto',
            color: TEXT_COLOR,
            fontSize: '12px',
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
          'data-testid': `survey-${cardId}-ot-count-${index}`,
          style: {
            flex: '0 0 auto',
            padding: '2px 8px',
            borderRadius: '999px',
            background: BADGE_BG,
            color: BADGE_TEXT,
            fontSize: '11px',
            fontWeight: 600,
          },
        },
        String(entry.count),
      ),
    ),
  );

  return createElement(
    'div',
    {
      'data-role': 'ot-mini',
      'data-testid': `survey-${cardId}-ot`,
      style: { display: 'flex', flexDirection: 'column' },
    },
    rows,
  );
}

/**
 * Render a mini rating histogram. One bar per score `1..scaleMax`;
 * mean label above. Heights are mode-normalised so a readable
 * histogram emerges even at low totals.
 */
function renderRatingMini(input: {
  cardId: string;
  aggregation: LivePollRatingAggregation;
}): ReactElement {
  const { cardId, aggregation } = input;
  const { scoreCounts, totalVotes, mean } = aggregation;
  const mode = modeOf(scoreCounts);
  const CHART_HEIGHT = 80;

  const bars = scoreCounts.map((count, index) => {
    const ratio = modeNormalisedFraction(count, mode);
    const heightPx = Math.round(ratio * CHART_HEIGHT);
    return createElement(
      'div',
      {
        key: `bar-${index}`,
        'data-testid': `survey-${cardId}-rating-bar-${index}`,
        'data-bar-index': index,
        'data-bar-score': index + 1,
        'data-bar-count': count,
        style: {
          flex: '1 1 auto',
          margin: '0 2px',
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
            height: `${CHART_HEIGHT}px`,
            background: TRACK_COLOR,
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'flex-end',
          },
        },
        createElement('div', {
          'data-role': 'bar-fill',
          'data-testid': `survey-${cardId}-rating-fill-${index}`,
          style: {
            width: '100%',
            height: `${heightPx}px`,
            background: BAR_COLOR,
            borderRadius: '4px',
          },
        }),
      ),
      createElement(
        'div',
        {
          'data-role': 'bar-label',
          style: {
            marginTop: '2px',
            color: TEXT_COLOR,
            fontSize: '11px',
          },
        },
        String(index + 1),
      ),
    );
  });

  return createElement(
    'div',
    {
      'data-role': 'rating-mini',
      'data-testid': `survey-${cardId}-rating`,
      style: { display: 'flex', flexDirection: 'column' },
    },
    createElement(
      'div',
      {
        'data-role': 'mean-label',
        'data-testid': `survey-${cardId}-rating-mean`,
        style: {
          color: TEXT_COLOR,
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '4px',
        },
      },
      formatMeanLabel(mean, totalVotes),
    ),
    createElement(
      'div',
      {
        'data-role': 'bars',
        style: { display: 'flex', alignItems: 'flex-end' },
      },
      bars,
    ),
  );
}

/**
 * Render an idle / waiting placeholder. Used when the snapshot's
 * `questionAggregations` is empty.
 */
function renderWaitingPlaceholder(width: number, height: number): ReactElement {
  return createElement(
    'div',
    {
      'data-stageflip-clip': 'survey',
      'data-testid': 'survey-root',
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
        'data-testid': 'survey-waiting',
        style: { fontSize: '16px', color: SECONDARY_TEXT_COLOR },
      },
      'Waiting for responses…',
    ),
  );
}

/**
 * Render the static-fallback React tree from a frozen aggregation
 * snapshot + visual context. Pure: same `(snapshot, ctx)` → byte-equal
 * `ReactElement`.
 *
 * Routing:
 *   - `questionAggregations.length === 0` → "Waiting for responses…"
 *     placeholder.
 *   - otherwise → vertical scroll of per-question cards plus the
 *     bottom total label.
 *
 * Each `questionAggregations[i]` is looked up by `questionId` against
 * `ctx.questions`; the per-question render branches on the row's
 * `type` discriminant. A row whose `questionId` does not match any
 * question (defensive — should not occur under the contract) renders
 * an empty card with a "(question missing)" placeholder; the overall
 * total label still appears.
 */
export function renderSurveyStaticFallback(input: {
  readonly snapshot: SurveyAggregation;
  readonly context: SurveyStaticFallbackContext;
}): ReactElement {
  const { snapshot, context } = input;
  const { questionAggregations, totalResponses } = snapshot;
  const { width, height, questions } = context;

  if (questionAggregations.length === 0) {
    return renderWaitingPlaceholder(width, height);
  }

  // Build a questionId -> question map for O(1) lookup.
  const byId = new Map<string, SurveyQuestion>();
  for (const q of questions) byId.set(q.id, q);

  const cards = questionAggregations.map((row, index) => {
    const question = byId.get(row.questionId);
    const cardId = `card-${index}`;
    const headerText = question?.text ?? '(question missing)';

    let body: ReactElement;
    if (row.type === 'multiple-choice' && row.aggregation.kind === 'live-poll-multiple-choice') {
      const options =
        question?.type === 'multiple-choice' ? question.options : ([] as readonly string[]);
      body = renderMultipleChoiceMini({
        cardId,
        aggregation: row.aggregation,
        options,
      });
    } else if (row.type === 'open-text' && row.aggregation.kind === 'live-poll-open-text') {
      body = renderOpenTextMini({ cardId, aggregation: row.aggregation });
    } else if (row.type === 'rating' && row.aggregation.kind === 'live-poll-rating') {
      body = renderRatingMini({ cardId, aggregation: row.aggregation });
    } else {
      // Defensive: discriminant mismatch under the contract should not
      // occur. Render an empty marker so the DOM structure stays stable.
      body = createElement(
        'div',
        {
          'data-role': 'unknown-type',
          'data-testid': `survey-${cardId}-unknown`,
        },
        '(unknown question type)',
      );
    }

    return createElement(
      'div',
      {
        key: cardId,
        'data-role': 'question-card',
        'data-testid': `survey-question-card-${index}`,
        'data-question-id': row.questionId,
        'data-question-type': row.type,
        style: {
          background: CARD_BG,
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '12px',
        },
      },
      createElement(
        'h4',
        {
          'data-role': 'question-text',
          'data-testid': `survey-question-text-${index}`,
          style: {
            margin: '0 0 8px 0',
            color: TEXT_COLOR,
            fontSize: '14px',
            fontWeight: 600,
          },
        },
        headerText,
      ),
      body,
    );
  });

  const children: ReactElement[] = [];
  children.push(
    createElement(
      'div',
      {
        key: 'cards',
        'data-role': 'cards',
        'data-testid': 'survey-cards',
        style: { display: 'flex', flexDirection: 'column' },
      },
      cards,
    ),
  );
  children.push(
    createElement(
      'div',
      {
        key: 'total',
        'data-role': 'total-responses',
        'data-testid': 'survey-total',
        'data-total-responses': totalResponses,
        style: {
          marginTop: '8px',
          color: SECONDARY_TEXT_COLOR,
          fontSize: '13px',
        },
      },
      formatTotalResponsesLabel(totalResponses),
    ),
  );

  return createElement(
    'div',
    {
      'data-stageflip-clip': 'survey',
      'data-testid': 'survey-root',
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

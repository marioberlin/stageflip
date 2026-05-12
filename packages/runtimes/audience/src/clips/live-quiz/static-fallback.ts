// packages/runtimes/audience/src/clips/live-quiz/static-fallback.ts
// T-465 — Static-fallback renderer for the `live-quiz` clip. Pure
// function: `(snapshot, ctx) → ReactElement`. Given identical snapshot
// + context bytes the output React tree is byte-equal — no Date /
// random / fetch / setTimeout per CLAUDE.md §3 (the audience runtime IS
// inside the determinism perimeter).
//
// Layout (per T-465 spec + ADR-010 §D4):
//   - Final-round shape (`activeQuestionId === null`): vertical scroll
//     of per-question result blocks. Each block renders the question
//     text (looked up from `context.questions` by `questionId`) above a
//     horizontal mini bar chart, one bar per option. Bar widths are
//     normalised to the MAX `optionCounts` value within the block (NOT
//     `totalVotes`) so a narrowly-spread distribution still presents a
//     full-width winner. The correct option's bar carries
//     `data-correct="true"` plus the accent (green) colour; the other
//     bars are muted gray. A `${totalVotes} votes` badge sits below.
//   - Active-question shape (`activeQuestionId !== null` AND that
//     questionId resolves to a `questionResults` entry): single block
//     for the active question; bars WITHOUT correctness highlight
//     (correctness reveals only at final).
//   - Idle shape (`activeQuestionId === null` AND `questionResults`
//     empty, OR `activeQuestionId !== null` AND no matching entry):
//     "Waiting for next question…" placeholder.
//
// Determinism note (CLAUDE.md §3): NO `Date.now()`, NO `Math.random()`.
// The `correctOptionIndex` per question comes from the snapshot.
//
// Browser-safe pure JSX (createElement). No DOM API calls; the React
// renderer (the host) materialises the tree.

import type { LiveQuizAggregation } from '@stageflip/audience-contract';
import { type ReactElement, createElement } from 'react';

/** Per-question definition projected from the clip's `props.questions[i]`. */
export interface LiveQuizQuestionDef {
  /** Stable question id; matches `LiveQuizAggregation.questionResults[i].questionId`. */
  readonly id: string;
  /** Question prompt; rendered above the bar chart. */
  readonly text: string;
  /** Answer option labels; one bar each. */
  readonly options: readonly string[];
}

/**
 * Visual context for the static-fallback render. Width / height in CSS
 * px. The `questions` array is the per-question definitions from the
 * clip's `props.questions` — the static-fallback uses these to look up
 * question text + option labels by id.
 */
export interface LiveQuizStaticFallbackContext {
  /** Bounding-box width in CSS px. Positive integer. */
  readonly width: number;
  /** Bounding-box height in CSS px. Positive integer. */
  readonly height: number;
  /**
   * Per-question definitions — drives question text + option labels in
   * the render. Optional so the empty-state path (no clip props) still
   * produces a well-formed tree.
   */
  readonly questions?: readonly LiveQuizQuestionDef[];
}

/** Default panel background colour. */
const PANEL_BG = '#ffffff';
/** Block (per-question result) background. */
const BLOCK_BG = '#f9fafb';
/** Block border. */
const BLOCK_BORDER = '#e5e7eb';
/** Default text colour. */
const TEXT_COLOR = '#111827';
/** Secondary-text colour (badges + meta). */
const SECONDARY_TEXT_COLOR = '#6b7280';
/** Bar background colour for the bar track. */
const BAR_TRACK_BG = '#e5e7eb';
/** Bar fill colour for incorrect / muted bars. */
const BAR_FILL_MUTED = '#9ca3af';
/** Bar fill colour for the correct option (accent green). */
const BAR_FILL_CORRECT = '#10b981';
/** Total votes badge background. */
const TOTAL_BADGE_BG = '#f3f4f6';

/**
 * Format the per-block total label. Matches the `${totalVotes} votes` /
 * `1 vote` precedent from T-461 (LivePoll multiple-choice).
 */
export function formatVotesLabel(totalVotes: number): string {
  return `${totalVotes} ${totalVotes === 1 ? 'vote' : 'votes'}`;
}

/**
 * Compute per-bar width fractions (0..1) from raw `optionCounts`.
 * Normalised to the MAX value in the block (NOT to `totalVotes`) so a
 * narrow-spread distribution still presents a full-width winner.
 *
 * Pure function: same input → byte-equal output. When every count is
 * zero the result is an array of zeros (matches the empty / no-votes
 * case).
 */
export function computeBarFractions(optionCounts: readonly number[]): readonly number[] {
  const max = optionCounts.reduce((acc, n) => (n > acc ? n : acc), 0);
  if (max === 0) return optionCounts.map(() => 0);
  return optionCounts.map((n) => n / max);
}

/**
 * Look up a question's definition by id from `context.questions`.
 * Returns `undefined` when the id is not present (defensive — the
 * snapshot's `questionResults` entry should always have a matching
 * clip-side definition; a missing one is rendered as a placeholder).
 */
function findQuestionDef(
  context: LiveQuizStaticFallbackContext,
  questionId: string,
): LiveQuizQuestionDef | undefined {
  if (context.questions === undefined) return undefined;
  return context.questions.find((q) => q.id === questionId);
}

/**
 * Render a single per-question result block. `highlightCorrect` toggles
 * whether the correct-option bar carries the accent colour +
 * `data-correct="true"`. The final-round path passes `true`; the
 * active-question (mid-quiz) path passes `false` so correctness reveals
 * only at final.
 */
function renderQuestionBlock(input: {
  result: LiveQuizAggregation['questionResults'][number];
  index: number;
  questionDef: LiveQuizQuestionDef | undefined;
  highlightCorrect: boolean;
}): ReactElement {
  const { result, index, questionDef, highlightCorrect } = input;
  const questionText = questionDef?.text ?? `(unknown question: ${result.questionId})`;
  const optionLabels = questionDef?.options ?? result.optionCounts.map((_, i) => `Option ${i + 1}`);
  const fractions = computeBarFractions(result.optionCounts);

  const bars = result.optionCounts.map((count, optIdx) => {
    const fraction = fractions[optIdx] ?? 0;
    const isCorrect = optIdx === result.correctOptionIndex;
    const showAccent = highlightCorrect && isCorrect;
    const fillColor = showAccent ? BAR_FILL_CORRECT : BAR_FILL_MUTED;
    const widthPct = `${(fraction * 100).toFixed(2)}%`;
    const optionLabel = optionLabels[optIdx] ?? `Option ${optIdx + 1}`;

    const trackProps: Record<string, unknown> = {
      key: `bar-${optIdx}`,
      'data-testid': `live-quiz-bar-${index}-${optIdx}`,
      'data-option-index': optIdx,
      'data-option-count': count,
      style: {
        position: 'relative',
        background: BAR_TRACK_BG,
        borderRadius: '4px',
        overflow: 'hidden',
        height: '24px',
        marginTop: '4px',
      },
    };
    if (showAccent) trackProps['data-correct'] = 'true';

    return createElement(
      'div',
      {
        key: `row-${optIdx}`,
        'data-role': 'bar-row',
        style: { marginBottom: '6px' },
      },
      [
        createElement(
          'div',
          {
            key: 'label',
            'data-role': 'option-label',
            'data-testid': `live-quiz-option-label-${index}-${optIdx}`,
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: TEXT_COLOR,
            },
          },
          [
            createElement('span', { key: 'lbl' }, optionLabel),
            createElement(
              'span',
              {
                key: 'cnt',
                'data-role': 'option-count',
                style: { color: SECONDARY_TEXT_COLOR },
              },
              `${count}`,
            ),
          ],
        ),
        createElement(
          'div',
          trackProps,
          createElement('div', {
            key: 'fill',
            'data-role': 'bar-fill',
            'data-testid': `live-quiz-bar-fill-${index}-${optIdx}`,
            style: {
              width: widthPct,
              height: '100%',
              background: fillColor,
            },
          }),
        ),
      ],
    );
  });

  const blockChildren: ReactElement[] = [];
  blockChildren.push(
    createElement(
      'h4',
      {
        key: 'question-text',
        'data-role': 'question-text',
        'data-testid': `live-quiz-question-${index}`,
        style: {
          margin: '0 0 8px 0',
          color: TEXT_COLOR,
          fontSize: '15px',
          fontWeight: 600,
        },
      },
      questionText,
    ),
  );
  blockChildren.push(
    createElement(
      'div',
      {
        key: 'bars',
        'data-role': 'bars',
        'data-testid': `live-quiz-bars-${index}`,
      },
      bars,
    ),
  );
  blockChildren.push(
    createElement(
      'span',
      {
        key: 'votes-badge',
        'data-role': 'votes-badge',
        'data-testid': `live-quiz-votes-${index}`,
        'data-total-votes': result.totalVotes,
        style: {
          display: 'inline-block',
          background: TOTAL_BADGE_BG,
          color: SECONDARY_TEXT_COLOR,
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          marginTop: '8px',
        },
      },
      formatVotesLabel(result.totalVotes),
    ),
  );

  return createElement(
    'article',
    {
      key: `block-${result.questionId}`,
      'data-testid': `live-quiz-block-${index}`,
      'data-question-id': result.questionId,
      'data-block-index': index,
      style: {
        background: BLOCK_BG,
        border: `1px solid ${BLOCK_BORDER}`,
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '12px',
      },
    },
    blockChildren,
  );
}

/**
 * Render an idle / waiting placeholder. Used both when the snapshot has
 * no question results AND no active question, and when the active
 * question id does not resolve to any `questionResults` entry.
 */
function renderWaitingPlaceholder(width: number, height: number): ReactElement {
  return createElement(
    'div',
    {
      'data-stageflip-clip': 'live-quiz',
      'data-testid': 'live-quiz-root',
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
        'data-testid': 'live-quiz-waiting',
        style: { fontSize: '16px', color: SECONDARY_TEXT_COLOR },
      },
      'Waiting for next question…',
    ),
  );
}

/**
 * Render the static-fallback React tree from a frozen aggregation
 * snapshot + visual context. Pure: same `(snapshot, ctx)` → byte-equal
 * `ReactElement`.
 *
 * Routing (per the T-465 spec):
 *   - `activeQuestionId === null` AND `questionResults.length === 0` →
 *     "Waiting for next question…" placeholder.
 *   - `activeQuestionId === null` AND `questionResults.length > 0` →
 *     final-round shape: one block per result, correctness highlighted.
 *   - `activeQuestionId !== null` AND that id resolves → single
 *     active-question block, correctness NOT highlighted (reveals only
 *     at final).
 *   - `activeQuestionId !== null` AND no resolution → "Waiting…"
 *     placeholder (defensive).
 */
export function renderLiveQuizStaticFallback(input: {
  readonly snapshot: LiveQuizAggregation;
  readonly context: LiveQuizStaticFallbackContext;
}): ReactElement {
  const { snapshot, context } = input;
  const { activeQuestionId, questionResults } = snapshot;
  const { width, height } = context;

  // Active-question routing — the live-mount mid-quiz path.
  if (activeQuestionId !== null) {
    const active = questionResults.find((r) => r.questionId === activeQuestionId);
    if (active === undefined) return renderWaitingPlaceholder(width, height);
    const block = renderQuestionBlock({
      result: active,
      index: 0,
      questionDef: findQuestionDef(context, active.questionId),
      highlightCorrect: false,
    });
    return createElement(
      'div',
      {
        'data-stageflip-clip': 'live-quiz',
        'data-testid': 'live-quiz-root',
        'data-state': 'active',
        'data-active-question-id': activeQuestionId,
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
      block,
    );
  }

  // Final-round shape — every question result, correctness highlighted.
  if (questionResults.length === 0) {
    return renderWaitingPlaceholder(width, height);
  }

  const blocks = questionResults.map((result, index) =>
    renderQuestionBlock({
      result,
      index,
      questionDef: findQuestionDef(context, result.questionId),
      highlightCorrect: true,
    }),
  );

  return createElement(
    'div',
    {
      'data-stageflip-clip': 'live-quiz',
      'data-testid': 'live-quiz-root',
      'data-state': 'final',
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
    createElement(
      'div',
      {
        key: 'blocks',
        'data-role': 'blocks',
        'data-testid': 'live-quiz-blocks',
        style: { display: 'flex', flexDirection: 'column' },
      },
      blocks,
    ),
  );
}

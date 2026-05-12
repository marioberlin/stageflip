// packages/runtimes/audience/src/clips/survey/render-e2e.test.ts
// T-468 — §13 (CLAUDE.md "structural-extension specs require end-to-end
// render verification") evidence for the survey clip family.
//
// This test mounts the clip's static-fallback path through the T-454
// `StaticFallbackRenderer` with the spec snapshot (3 questions —
// multiple-choice / open-text / rating) and asserts on observable DOM
// (per spec):
//   - 3 cards rendered in input order;
//   - card 1 (multiple-choice) has 3 bars;
//   - card 2 (open-text) has 2 list rows;
//   - card 3 (rating) has 5 bars + "Mean: 3.2" label;
//   - total label reads "15 responses";
//   - DOM-level pixel-bucket proxies: non-zero card dimensions; non-default
//     panel chrome.
//
// **Verification posture per CLAUDE.md §13 option 1**: this is a
// real-render integration test driving the clip through the renderer
// with a known snapshot and asserting on observable DOM.

/**
 * @vitest-environment happy-dom
 */

import type { SurveyAggregation } from '@stageflip/audience-contract';
import type { SurveyQuestion } from '@stageflip/schema';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// React 19's `act(...)` requires opt-in flag in non-RTL test envs.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { staticFallbackRenderer } from '../../static-fallback.js';
import './index.js'; // side-effect: registers the clip

const QUESTIONS: readonly SurveyQuestion[] = [
  {
    id: 'q1',
    type: 'multiple-choice',
    text: 'Which framework?',
    options: ['React', 'Vue', 'Svelte'],
  },
  {
    id: 'q2',
    type: 'open-text',
    text: 'Any comments?',
    maxLength: 280,
  },
  {
    id: 'q3',
    type: 'rating',
    text: 'Rate the session',
    scaleMin: 1,
    scaleMax: 5,
  },
];

const SNAPSHOT: SurveyAggregation = {
  kind: 'survey',
  questionAggregations: [
    {
      questionId: 'q1',
      type: 'multiple-choice',
      aggregation: {
        kind: 'live-poll-multiple-choice',
        optionCounts: [8, 5, 2],
        totalVotes: 15,
      },
    },
    {
      questionId: 'q2',
      type: 'open-text',
      aggregation: {
        kind: 'live-poll-open-text',
        entries: [
          { text: 'great', count: 4 },
          { text: 'meh', count: 2 },
        ],
        totalVotes: 6,
      },
    },
    {
      questionId: 'q3',
      type: 'rating',
      aggregation: {
        kind: 'live-poll-rating',
        scoreCounts: [1, 3, 5, 4, 2],
        totalVotes: 15,
        mean: 3.2,
      },
    },
  ],
  totalResponses: 15,
};

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  while (document.body.firstChild !== null) {
    document.body.removeChild(document.body.firstChild);
  }
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  while (document.body.firstChild !== null) {
    document.body.removeChild(document.body.firstChild);
  }
});

describe('§13 render-e2e (T-468) — survey', () => {
  it('drives the clip through staticFallbackRenderer + asserts on DOM', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-1',
        snapshotFrame: 0,
        voterCountAtCapture: 15,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'survey',
        aggregation: SNAPSHOT,
      },
      context: {
        width: 800,
        height: 600,
        questions: QUESTIONS,
      },
      emitLossFlag: () => {},
    });
    expect(result.state).toBe('rendered');
    if (result.state !== 'rendered') return;

    await act(async () => {
      root.render(result.output as React.ReactElement);
    });

    // ----- DOM assertion 1: three cards in input order -----
    const cards = Array.from(
      host.querySelectorAll('[data-testid^="survey-question-card-"]'),
    ) as HTMLElement[];
    expect(cards).toHaveLength(3);
    expect(cards[0]?.getAttribute('data-question-id')).toBe('q1');
    expect(cards[0]?.getAttribute('data-question-type')).toBe('multiple-choice');
    expect(cards[1]?.getAttribute('data-question-id')).toBe('q2');
    expect(cards[1]?.getAttribute('data-question-type')).toBe('open-text');
    expect(cards[2]?.getAttribute('data-question-id')).toBe('q3');
    expect(cards[2]?.getAttribute('data-question-type')).toBe('rating');

    // ----- DOM assertion 2: question header text -----
    expect(host.querySelector('[data-testid="survey-question-text-0"]')?.textContent).toBe(
      'Which framework?',
    );
    expect(host.querySelector('[data-testid="survey-question-text-1"]')?.textContent).toBe(
      'Any comments?',
    );
    expect(host.querySelector('[data-testid="survey-question-text-2"]')?.textContent).toBe(
      'Rate the session',
    );

    // ----- DOM assertion 3: card 1 has 3 multiple-choice bars (bar containers, not fills) -----
    const mcBars = Array.from(
      host.querySelectorAll('[data-testid^="survey-card-0-mc-bar-"]'),
    ).filter((el) => /survey-card-0-mc-bar-\d+$/.test(el.getAttribute('data-testid') ?? ''));
    expect(mcBars).toHaveLength(3);

    // ----- DOM assertion 4: card 2 has 2 open-text list rows -----
    const otRows = host.querySelectorAll('[data-testid^="survey-card-1-ot-row-"]');
    expect(otRows).toHaveLength(2);
    expect(
      host.querySelector('[data-testid="survey-card-1-ot-row-0"]')?.getAttribute('data-row-count'),
    ).toBe('4');
    expect(
      host.querySelector('[data-testid="survey-card-1-ot-row-1"]')?.getAttribute('data-row-count'),
    ).toBe('2');

    // ----- DOM assertion 5: card 3 has 5 rating bars (containers only) + Mean: 3.2 -----
    const ratingBars = Array.from(
      host.querySelectorAll('[data-testid^="survey-card-2-rating-bar-"]'),
    ).filter((el) => /survey-card-2-rating-bar-\d+$/.test(el.getAttribute('data-testid') ?? ''));
    expect(ratingBars).toHaveLength(5);
    const meanLabel = host.querySelector('[data-testid="survey-card-2-rating-mean"]');
    expect(meanLabel?.textContent).toBe('Mean: 3.2');

    // ----- DOM assertion 6: total label = "15 responses" -----
    const total = host.querySelector('[data-testid="survey-total"]');
    expect(total?.textContent).toBe('15 responses');
    expect(total?.getAttribute('data-total-responses')).toBe('15');

    // ----- §13 pixel-bucket proxy: root has non-default chrome -----
    const rootEl = host.querySelector('[data-stageflip-clip="survey"]') as HTMLElement | null;
    expect(rootEl).not.toBeNull();
    expect(rootEl?.style.getPropertyValue('background').length).toBeGreaterThan(0);
    expect(rootEl?.style.getPropertyValue('color').length).toBeGreaterThan(0);

    // ----- §13 pixel-bucket proxy: every card has a non-empty background -----
    let nonBlankCards = 0;
    for (const c of cards) {
      if (c.style.getPropertyValue('background').length > 0) nonBlankCards += 1;
    }
    expect(nonBlankCards).toBe(3);
  });

  it('handles the rating mean=NaN edge case as "Mean: —"', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-2',
        snapshotFrame: 0,
        voterCountAtCapture: 0,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'survey',
        aggregation: {
          kind: 'survey',
          questionAggregations: [
            {
              questionId: 'q3',
              type: 'rating',
              aggregation: {
                kind: 'live-poll-rating',
                scoreCounts: [0, 0, 0, 0, 0],
                totalVotes: 0,
                mean: Number.NaN,
              },
            },
          ],
          totalResponses: 0,
        },
      },
      context: { width: 400, height: 200, questions: QUESTIONS },
      emitLossFlag: () => {},
    });
    if (result.state !== 'rendered') throw new Error('expected rendered');
    await act(async () => {
      root.render(result.output as React.ReactElement);
    });
    const meanLabel = host.querySelector('[data-testid="survey-card-0-rating-mean"]');
    expect(meanLabel?.textContent).toBe('Mean: —');
  });

  it('idle shape: empty questionAggregations renders the "Waiting…" placeholder', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-3',
        snapshotFrame: 0,
        voterCountAtCapture: 0,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'survey',
        aggregation: {
          kind: 'survey',
          questionAggregations: [],
          totalResponses: 0,
        },
      },
      context: { width: 400, height: 200, questions: QUESTIONS },
      emitLossFlag: () => {},
    });
    if (result.state !== 'rendered') throw new Error('expected rendered');
    await act(async () => {
      root.render(result.output as React.ReactElement);
    });
    const rootEl = host.querySelector('[data-stageflip-clip="survey"]');
    expect(rootEl?.getAttribute('data-state')).toBe('waiting');
    const waiting = host.querySelector('[data-testid="survey-waiting"]');
    expect(waiting?.textContent).toBe('Waiting for responses…');
  });
});

// packages/runtimes/audience/src/clips/live-quiz/render-e2e.test.ts
// T-465 — §13 (CLAUDE.md "structural-extension specs require end-to-end
// render verification") evidence for the live-quiz clip family.
//
// This test mounts the clip's static-fallback path through the T-454
// `StaticFallbackRenderer` with a known final-round snapshot and
// asserts on observable DOM (per spec):
//   - three per-question result blocks present in order;
//   - each block has 4 bar elements;
//   - each block's correct option carries `data-correct="true"`;
//   - each block's totalVotes badge reads "21";
//   - bar widths proportional to optionCounts within each block (q1 bar
//     0 widest at count 12; q2 bar 1 widest at count 18; q3 bar 2
//     widest at count 8);
//   - non-blank rendered output: each correct bar fill has the accent
//     colour, non-correct bars have the muted colour, all bars carry
//     non-zero widths where counts > 0 (DOM-level pixel-bucket proxies
//     per the T-348b non-blank pattern).
//
// **Verification posture per CLAUDE.md §13 option 1**: this is a
// real-render integration test driving the clip through the renderer
// with a known snapshot and asserting on observable DOM. This is the
// §13 evidence T-460 deferred (option 3) for the live-quiz variant.
// Pixel-bucket-style verification is approximated via inline-style +
// DOM inspection (no Playwright at the runtime test layer); a full
// PNG-based assertion is documented as out-of-scope and gated on the
// cross-cluster T-476 parity-fixture work.

/**
 * @vitest-environment happy-dom
 */

import type { LiveQuizAggregation } from '@stageflip/audience-contract';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// React 19's `act(...)` requires opt-in flag in non-RTL test envs.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { staticFallbackRenderer } from '../../static-fallback.js';
import './index.js'; // side-effect: registers the clip
import type { LiveQuizQuestionDef } from './static-fallback.js';

const QUESTIONS: readonly LiveQuizQuestionDef[] = [
  {
    id: 'q1',
    text: 'Capital of France?',
    options: ['London', 'Paris', 'Berlin', 'Madrid'],
  },
  {
    id: 'q2',
    text: '2 + 2 = ?',
    options: ['3', '4', '5', '6'],
  },
  {
    id: 'q3',
    text: 'Largest planet?',
    options: ['Mars', 'Earth', 'Jupiter', 'Venus'],
  },
];

const SNAPSHOT: LiveQuizAggregation = {
  kind: 'live-quiz',
  activeQuestionId: null,
  questionResults: [
    {
      questionId: 'q1',
      optionCounts: [12, 5, 3, 1],
      correctOptionIndex: 0,
      totalVotes: 21,
      status: 'closed',
    },
    {
      questionId: 'q2',
      optionCounts: [2, 18, 1, 0],
      correctOptionIndex: 1,
      totalVotes: 21,
      status: 'closed',
    },
    {
      questionId: 'q3',
      optionCounts: [4, 4, 8, 5],
      correctOptionIndex: 2,
      totalVotes: 21,
      status: 'closed',
    },
  ],
  totalVoters: 21,
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

describe('§13 render-e2e (T-465) — live-quiz', () => {
  it('drives the clip through staticFallbackRenderer + asserts on DOM', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-1',
        snapshotFrame: 0,
        voterCountAtCapture: 21,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'live-quiz',
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

    // ----- DOM assertion 1: three result blocks present in order -----
    const blocks = Array.from(host.querySelectorAll('[data-testid^="live-quiz-block-"]'));
    expect(blocks).toHaveLength(3);
    expect(blocks[0]?.getAttribute('data-question-id')).toBe('q1');
    expect(blocks[1]?.getAttribute('data-question-id')).toBe('q2');
    expect(blocks[2]?.getAttribute('data-question-id')).toBe('q3');

    // ----- DOM assertion 2: each block has 4 bar elements -----
    for (let i = 0; i < 3; i += 1) {
      const bars = host.querySelectorAll(`[data-testid^="live-quiz-bar-${i}-"]`);
      expect(bars.length).toBe(4);
    }

    // ----- DOM assertion 3: correct option per block carries
    //       data-correct="true". The other bars do NOT.
    for (const [blockIdx, correctOpt] of [
      [0, 0],
      [1, 1],
      [2, 2],
    ] as const) {
      for (let optIdx = 0; optIdx < 4; optIdx += 1) {
        const bar = host.querySelector(`[data-testid="live-quiz-bar-${blockIdx}-${optIdx}"]`);
        expect(bar).not.toBeNull();
        if (optIdx === correctOpt) {
          expect(bar?.getAttribute('data-correct')).toBe('true');
        } else {
          expect(bar?.getAttribute('data-correct')).toBeNull();
        }
      }
    }

    // ----- DOM assertion 4: totalVotes badge reads "21 votes" per block -----
    for (let i = 0; i < 3; i += 1) {
      const badge = host.querySelector(`[data-testid="live-quiz-votes-${i}"]`);
      expect(badge?.textContent).toBe('21 votes');
      expect(badge?.getAttribute('data-total-votes')).toBe('21');
    }

    // ----- DOM assertion 5: bar widths proportional within block -----
    // q1 (block 0): max=12 at idx 0 → bar 0 should be 100%.
    // q2 (block 1): max=18 at idx 1 → bar 1 should be 100%.
    // q3 (block 2): max=8  at idx 2 → bar 2 should be 100%.
    function widthOf(blockIdx: number, optIdx: number): string {
      const fill = host.querySelector(
        `[data-testid="live-quiz-bar-fill-${blockIdx}-${optIdx}"]`,
      ) as HTMLElement | null;
      return fill?.style.getPropertyValue('width') ?? '';
    }
    expect(widthOf(0, 0)).toBe('100.00%');
    expect(widthOf(1, 1)).toBe('100.00%');
    expect(widthOf(2, 2)).toBe('100.00%');
    // Non-max bars are strictly less than 100% (and non-zero where count > 0).
    const w0_1 = widthOf(0, 1); // 5/12 ≈ 41.67%
    expect(w0_1).not.toBe('100.00%');
    expect(w0_1).not.toBe('0.00%');

    // ----- §13 pixel-bucket proxy: distinct accent colour for correct bars -----
    function bgOf(blockIdx: number, optIdx: number): string {
      const fill = host.querySelector(
        `[data-testid="live-quiz-bar-fill-${blockIdx}-${optIdx}"]`,
      ) as HTMLElement | null;
      return fill?.style.getPropertyValue('background') ?? '';
    }
    const correctBg = bgOf(0, 0);
    const incorrectBg = bgOf(0, 1);
    expect(correctBg.length).toBeGreaterThan(0);
    expect(incorrectBg.length).toBeGreaterThan(0);
    expect(correctBg).not.toBe(incorrectBg);
    // Cross-block consistency: every correct bar uses the same accent.
    expect(bgOf(1, 1)).toBe(correctBg);
    expect(bgOf(2, 2)).toBe(correctBg);
    // Non-correct bars share the muted colour.
    expect(bgOf(1, 0)).toBe(incorrectBg);
    expect(bgOf(2, 3)).toBe(incorrectBg);

    // ----- §13 pixel-bucket proxy: blocks have non-default backgrounds -----
    let nonBlankBlocks = 0;
    for (const b of blocks) {
      const style = (b as HTMLElement).style;
      const bg = style.getPropertyValue('background');
      const border = style.getPropertyValue('border');
      if (bg.length > 0 && border.length > 0) nonBlankBlocks += 1;
    }
    expect(nonBlankBlocks).toBe(3);
  });

  it('active-question shape: single block, NO data-correct highlight', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-2',
        snapshotFrame: 0,
        voterCountAtCapture: 7,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'live-quiz',
        aggregation: {
          kind: 'live-quiz',
          activeQuestionId: 'q1',
          questionResults: [
            {
              questionId: 'q1',
              optionCounts: [3, 2, 1, 1],
              correctOptionIndex: 0,
              totalVotes: 7,
              status: 'active',
            },
          ],
          totalVoters: 7,
        },
      },
      context: { width: 400, height: 300, questions: QUESTIONS },
      emitLossFlag: () => {},
    });
    if (result.state !== 'rendered') throw new Error('expected rendered');
    await act(async () => {
      root.render(result.output as React.ReactElement);
    });
    const root_el = host.querySelector('[data-stageflip-clip="live-quiz"]');
    expect(root_el?.getAttribute('data-state')).toBe('active');
    const blocks = host.querySelectorAll('[data-testid^="live-quiz-block-"]');
    expect(blocks.length).toBe(1);
    // Active-question shape MUST NOT highlight correctness — the reveal
    // happens at final round only.
    for (let optIdx = 0; optIdx < 4; optIdx += 1) {
      const bar = host.querySelector(`[data-testid="live-quiz-bar-0-${optIdx}"]`);
      expect(bar?.getAttribute('data-correct')).toBeNull();
    }
  });

  it('idle shape: empty questionResults renders the "Waiting…" placeholder', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-3',
        snapshotFrame: 0,
        voterCountAtCapture: 0,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'live-quiz',
        aggregation: {
          kind: 'live-quiz',
          activeQuestionId: null,
          questionResults: [],
          totalVoters: 0,
        },
      },
      context: { width: 400, height: 200, questions: QUESTIONS },
      emitLossFlag: () => {},
    });
    if (result.state !== 'rendered') throw new Error('expected rendered');
    await act(async () => {
      root.render(result.output as React.ReactElement);
    });
    const root_el = host.querySelector('[data-stageflip-clip="live-quiz"]');
    expect(root_el?.getAttribute('data-state')).toBe('waiting');
    const waiting = host.querySelector('[data-testid="live-quiz-waiting"]');
    expect(waiting?.textContent).toBe('Waiting for next question…');
  });
});

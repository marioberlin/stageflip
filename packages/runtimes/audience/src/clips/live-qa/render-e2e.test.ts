// packages/runtimes/audience/src/clips/live-qa/render-e2e.test.ts
// T-464 — §13 (CLAUDE.md "structural-extension specs require end-to-end
// render verification") evidence for the live-qa clip family.
//
// This test mounts the clip's static-fallback path through the T-454
// `StaticFallbackRenderer` with a known snapshot and asserts on
// observable DOM (per spec):
//   - three card elements present;
//   - cards in order by upvotes desc (q1 → q2 → q3);
//   - q1 carries an "Answered" badge + the popular highlight;
//   - upvote count badges per card;
//   - relative-time labels per card (computed from injected `now`);
//   - total label reads "3 questions";
//   - non-blank rendered output — cards have non-zero heights via
//     padding + visible border / background colours (DOM-level pixel-
//     bucket proxies per the T-348b non-blank pattern).
//
// **Verification posture per CLAUDE.md §13 option 1**: this is a
// real-render integration test driving the clip through the renderer
// with a known snapshot and asserting on observable DOM. This is the
// §13 evidence T-460 deferred (option 3) for the live-qa variant.
// Pixel-bucket-style verification is approximated via inline-style +
// DOM inspection (no Playwright at the runtime test layer); a full
// PNG-based assertion is documented as out-of-scope and gated on the
// cross-cluster T-476 parity-fixture work.

/**
 * @vitest-environment happy-dom
 */

import type { LiveQAAggregation } from '@stageflip/audience-contract';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// React 19's `act(...)` requires opt-in flag in non-RTL test envs.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { staticFallbackRenderer } from '../../static-fallback.js';
import './index.js'; // side-effect: registers the clip

const SNAPSHOT: LiveQAAggregation = {
  kind: 'live-qa',
  questions: [
    {
      id: 'q1',
      text: 'How do hooks work?',
      upvotes: 12,
      submittedAt: '2026-05-12T10:00:00Z',
      answered: true,
    },
    {
      id: 'q2',
      text: 'When is the next release?',
      upvotes: 8,
      submittedAt: '2026-05-12T10:01:00Z',
    },
    {
      id: 'q3',
      text: 'Can we see a demo?',
      upvotes: 5,
      submittedAt: '2026-05-12T10:02:00Z',
    },
  ],
  totalQuestions: 3,
};

const NOW_MS = Date.parse('2026-05-12T10:07:00Z');

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

describe('§13 render-e2e (T-464) — live-qa', () => {
  it('drives the clip through staticFallbackRenderer + asserts on DOM', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-1',
        snapshotFrame: 0,
        voterCountAtCapture: 3,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'live-qa',
        aggregation: SNAPSHOT,
      },
      context: {
        width: 800,
        height: 400,
        topic: 'Ask the speaker',
        now: NOW_MS,
      },
      emitLossFlag: () => {},
    });
    expect(result.state).toBe('rendered');
    if (result.state !== 'rendered') return;

    await act(async () => {
      root.render(result.output as React.ReactElement);
    });

    // ----- DOM assertion 1: three card elements present -----
    const cards = host.querySelectorAll('[data-testid^="live-qa-card-"]');
    const cardList = Array.from(cards);
    expect(cardList).toHaveLength(3);

    // ----- DOM assertion 2: cards in order by upvotes desc -----
    expect(cardList[0]?.getAttribute('data-question-id')).toBe('q1');
    expect(cardList[1]?.getAttribute('data-question-id')).toBe('q2');
    expect(cardList[2]?.getAttribute('data-question-id')).toBe('q3');

    // ----- DOM assertion 3: top-3 cards carry the popular highlight -----
    const popular = cardList.filter((c) => c.getAttribute('data-highlight') === 'popular');
    expect(popular).toHaveLength(3);

    // ----- DOM assertion 4: q1 carries the Answered badge -----
    const answered = host.querySelector('[data-testid="live-qa-answered-0"]');
    expect(answered).not.toBeNull();
    expect(answered?.textContent).toBe('Answered');

    // q2 + q3 do NOT carry the answered badge.
    expect(host.querySelector('[data-testid="live-qa-answered-1"]')).toBeNull();
    expect(host.querySelector('[data-testid="live-qa-answered-2"]')).toBeNull();

    // ----- DOM assertion 5: upvote counts per card -----
    const upvotes0 = host.querySelector('[data-testid="live-qa-upvotes-0"]');
    const upvotes1 = host.querySelector('[data-testid="live-qa-upvotes-1"]');
    const upvotes2 = host.querySelector('[data-testid="live-qa-upvotes-2"]');
    expect(upvotes0?.textContent).toBe('12 upvotes');
    expect(upvotes1?.textContent).toBe('8 upvotes');
    expect(upvotes2?.textContent).toBe('5 upvotes');

    // ----- DOM assertion 6: relative-time labels per card -----
    // q1: 7 min ago; q2: 6 min ago; q3: 5 min ago — all derived from
    // the injected `now` prop. NO `Date.now()` in the static-fallback.
    const rt0 = host.querySelector('[data-testid="live-qa-relative-time-0"]');
    const rt1 = host.querySelector('[data-testid="live-qa-relative-time-1"]');
    const rt2 = host.querySelector('[data-testid="live-qa-relative-time-2"]');
    expect(rt0?.textContent).toBe('Asked 7 min ago');
    expect(rt1?.textContent).toBe('Asked 6 min ago');
    expect(rt2?.textContent).toBe('Asked 5 min ago');

    // ----- DOM assertion 7: total label reads "3 questions" -----
    const total = host.querySelector('[data-testid="live-qa-total"]');
    expect(total).not.toBeNull();
    expect(total?.textContent).toBe('3 questions');

    // ----- §13 pixel-bucket proxy: non-blank rendered output -----
    // Each card carries non-default background + border colours (white
    // / accent-blue background, grey / blue border) — DOM-level proxies
    // for "non-blank pixels" — see file header for the deferral note on
    // a Playwright-based PNG bucket count.
    let nonBlankCards = 0;
    for (const c of cardList) {
      const style = (c as HTMLElement).style;
      const bg = style.getPropertyValue('background');
      const border = style.getPropertyValue('border');
      if (bg.length > 0 && border.length > 0) nonBlankCards += 1;
    }
    expect(nonBlankCards).toBe(3);

    // The popular-highlight card (top) should have a different border
    // than a non-popular card. With three popular highlights we cannot
    // compare popular-vs-not on this snapshot, so add a separate
    // five-question case below to cover the contrast.
  });

  it('the popular-highlight border differs from a non-popular card border', async () => {
    const fiveSnapshot: LiveQAAggregation = {
      kind: 'live-qa',
      totalQuestions: 5,
      questions: [
        { id: 'q1', text: '1', upvotes: 50, submittedAt: '2026-05-12T10:00:00Z' },
        { id: 'q2', text: '2', upvotes: 40, submittedAt: '2026-05-12T10:01:00Z' },
        { id: 'q3', text: '3', upvotes: 30, submittedAt: '2026-05-12T10:02:00Z' },
        { id: 'q4', text: '4', upvotes: 20, submittedAt: '2026-05-12T10:03:00Z' },
        { id: 'q5', text: '5', upvotes: 10, submittedAt: '2026-05-12T10:04:00Z' },
      ],
    };
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-2',
        snapshotFrame: 0,
        voterCountAtCapture: 5,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'live-qa',
        aggregation: fiveSnapshot,
      },
      context: { width: 400, height: 600, topic: 'Five questions', now: NOW_MS },
      emitLossFlag: () => {},
    });
    if (result.state !== 'rendered') throw new Error('expected rendered');
    await act(async () => {
      root.render(result.output as React.ReactElement);
    });
    const cards = Array.from(host.querySelectorAll('[data-testid^="live-qa-card-"]'));
    expect(cards).toHaveLength(5);
    const popularBorder = (cards[0] as HTMLElement).style.border;
    const nonPopularBorder = (cards[3] as HTMLElement).style.border;
    expect(popularBorder).not.toBe(nonPopularBorder);
    expect(popularBorder.length).toBeGreaterThan(0);
    expect(nonPopularBorder.length).toBeGreaterThan(0);
  });

  it('renders the empty-state when totalQuestions === 0', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-3',
        snapshotFrame: 0,
        voterCountAtCapture: 0,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'live-qa',
        aggregation: {
          kind: 'live-qa',
          questions: [],
          totalQuestions: 0,
        },
      },
      context: { width: 400, height: 200, topic: 'No questions yet', now: NOW_MS },
      emitLossFlag: () => {},
    });
    if (result.state !== 'rendered') throw new Error('expected rendered');
    await act(async () => {
      root.render(result.output as React.ReactElement);
    });
    const cards = host.querySelectorAll('[data-testid^="live-qa-card-"]');
    expect(cards.length).toBe(0);
    const total = host.querySelector('[data-testid="live-qa-total"]');
    expect(total?.textContent).toBe('0 questions');
  });

  it('relative-time falls back to "Just now" when context.now is omitted', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-4',
        snapshotFrame: 0,
        voterCountAtCapture: 1,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'live-qa',
        aggregation: {
          kind: 'live-qa',
          questions: [
            {
              id: 'q1',
              text: 'Hello?',
              upvotes: 1,
              submittedAt: '2026-05-12T10:00:00Z',
            },
          ],
          totalQuestions: 1,
        },
      },
      context: { width: 400, height: 200, topic: 'No clock' },
      emitLossFlag: () => {},
    });
    if (result.state !== 'rendered') throw new Error('expected rendered');
    await act(async () => {
      root.render(result.output as React.ReactElement);
    });
    const rt = host.querySelector('[data-testid="live-qa-relative-time-0"]');
    expect(rt?.textContent).toBe('Just now');
  });
});

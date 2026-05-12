// packages/runtimes/audience/src/clips/leaderboard/render-e2e.test.ts
// T-466 — §13 (CLAUDE.md "structural-extension specs require end-to-end
// render verification") evidence for the leaderboard clip family.
//
// This test mounts the clip's static-fallback path through the T-454
// `StaticFallbackRenderer` with the spec snapshot (5 ranked voters)
// and asserts on observable DOM (per spec):
//   - five rows rendered in rank order;
//   - rank 1 row carries `data-medal="gold"`;
//   - rank 2 row carries `data-medal="silver"`;
//   - rank 3 row carries `data-medal="bronze"`;
//   - ranks 4 and 5 have NO `data-medal` attribute;
//   - rank 5 (no `displayName` on its entry) falls back to
//     "Anonymous voter";
//   - score badges visible per row;
//   - total label reads "21 participants";
//   - DOM-level pixel-bucket proxies: distinct medal colours, non-blank
//     row backgrounds + borders.
//
// **Verification posture per CLAUDE.md §13 option 1**: this is a
// real-render integration test driving the clip through the renderer
// with a known snapshot and asserting on observable DOM. This is the
// §13 evidence T-460 deferred (option 3) for the leaderboard variant.
// Pixel-bucket-style verification is approximated via inline-style +
// DOM inspection (no Playwright at the runtime test layer); a full
// PNG-based assertion is documented as out-of-scope and gated on the
// cross-cluster T-476 parity-fixture work.

/**
 * @vitest-environment happy-dom
 */

import type { LeaderboardAggregation } from '@stageflip/audience-contract';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// React 19's `act(...)` requires opt-in flag in non-RTL test envs.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { staticFallbackRenderer } from '../../static-fallback.js';
import './index.js'; // side-effect: registers the clip

const SNAPSHOT: LeaderboardAggregation = {
  kind: 'leaderboard',
  quizId: 'quiz-1',
  ranking: [
    { voterToken: 'hash-a', displayName: 'Alice', score: 1500, rank: 1 },
    { voterToken: 'hash-b', displayName: 'Bob', score: 1350, rank: 2 },
    { voterToken: 'hash-c', displayName: 'Carol', score: 1200, rank: 3 },
    { voterToken: 'hash-d', displayName: 'Dave', score: 1100, rank: 4 },
    { voterToken: 'hash-e', score: 1050, rank: 5 },
  ],
  totalParticipants: 21,
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

describe('§13 render-e2e (T-466) — leaderboard', () => {
  it('drives the clip through staticFallbackRenderer + asserts on DOM', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-1',
        snapshotFrame: 0,
        voterCountAtCapture: 21,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'leaderboard',
        aggregation: SNAPSHOT,
      },
      context: {
        width: 800,
        height: 600,
      },
      emitLossFlag: () => {},
    });
    expect(result.state).toBe('rendered');
    if (result.state !== 'rendered') return;

    await act(async () => {
      root.render(result.output as React.ReactElement);
    });

    // ----- DOM assertion 1: five rows present in rank order -----
    const rows = Array.from(host.querySelectorAll('[data-testid^="leaderboard-row-"]'));
    expect(rows).toHaveLength(5);
    expect(rows[0]?.getAttribute('data-rank')).toBe('1');
    expect(rows[1]?.getAttribute('data-rank')).toBe('2');
    expect(rows[2]?.getAttribute('data-rank')).toBe('3');
    expect(rows[3]?.getAttribute('data-rank')).toBe('4');
    expect(rows[4]?.getAttribute('data-rank')).toBe('5');

    // ----- DOM assertion 2: medal attributes on top-3, absent on ranks 4-5 -----
    expect(rows[0]?.getAttribute('data-medal')).toBe('gold');
    expect(rows[1]?.getAttribute('data-medal')).toBe('silver');
    expect(rows[2]?.getAttribute('data-medal')).toBe('bronze');
    expect(rows[3]?.getAttribute('data-medal')).toBeNull();
    expect(rows[4]?.getAttribute('data-medal')).toBeNull();

    // ----- DOM assertion 3: anonymous-voter fallback on rank 5 -----
    const rank5Name = host.querySelector('[data-testid="leaderboard-name-4"]');
    expect(rank5Name?.textContent).toBe('Anonymous voter');

    // Named voters render their displayName verbatim.
    expect(host.querySelector('[data-testid="leaderboard-name-0"]')?.textContent).toBe('Alice');
    expect(host.querySelector('[data-testid="leaderboard-name-1"]')?.textContent).toBe('Bob');
    expect(host.querySelector('[data-testid="leaderboard-name-2"]')?.textContent).toBe('Carol');
    expect(host.querySelector('[data-testid="leaderboard-name-3"]')?.textContent).toBe('Dave');

    // ----- DOM assertion 4: score badges visible with correct values -----
    expect(host.querySelector('[data-testid="leaderboard-score-0"]')?.textContent).toBe('1500');
    expect(host.querySelector('[data-testid="leaderboard-score-1"]')?.textContent).toBe('1350');
    expect(host.querySelector('[data-testid="leaderboard-score-2"]')?.textContent).toBe('1200');
    expect(host.querySelector('[data-testid="leaderboard-score-3"]')?.textContent).toBe('1100');
    expect(host.querySelector('[data-testid="leaderboard-score-4"]')?.textContent).toBe('1050');

    // ----- DOM assertion 5: total participants label -----
    const total = host.querySelector('[data-testid="leaderboard-total"]');
    expect(total?.textContent).toBe('21 participants');
    expect(total?.getAttribute('data-total-participants')).toBe('21');

    // ----- §13 pixel-bucket proxy: distinct medal accent colours -----
    function rankBadgeBg(rowIdx: number): string {
      const badge = host.querySelector(
        `[data-testid="leaderboard-rank-${rowIdx}"]`,
      ) as HTMLElement | null;
      return badge?.style.getPropertyValue('background') ?? '';
    }
    const goldBg = rankBadgeBg(0);
    const silverBg = rankBadgeBg(1);
    const bronzeBg = rankBadgeBg(2);
    const rank4Bg = rankBadgeBg(3);
    expect(goldBg.length).toBeGreaterThan(0);
    expect(silverBg.length).toBeGreaterThan(0);
    expect(bronzeBg.length).toBeGreaterThan(0);
    expect(goldBg).not.toBe(silverBg);
    expect(silverBg).not.toBe(bronzeBg);
    expect(goldBg).not.toBe(bronzeBg);
    // Non-medal rank uses the default badge background (distinct from gold).
    expect(rank4Bg).not.toBe(goldBg);

    // ----- §13 pixel-bucket proxy: rows have non-default chrome -----
    let nonBlankRows = 0;
    for (const r of rows) {
      const style = (r as HTMLElement).style;
      const bg = style.getPropertyValue('background');
      const border = style.getPropertyValue('border');
      if (bg.length > 0 && border.length > 0) nonBlankRows += 1;
    }
    expect(nonBlankRows).toBe(5);
  });

  it('renders the optional title above the list when supplied', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-2',
        snapshotFrame: 0,
        voterCountAtCapture: 21,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'leaderboard',
        aggregation: SNAPSHOT,
      },
      context: { width: 400, height: 400, title: 'Final Standings' },
      emitLossFlag: () => {},
    });
    if (result.state !== 'rendered') throw new Error('expected rendered');
    await act(async () => {
      root.render(result.output as React.ReactElement);
    });
    const title = host.querySelector('[data-testid="leaderboard-title"]');
    expect(title?.textContent).toBe('Final Standings');
  });

  it('idle shape: empty ranking renders the "Waiting…" placeholder', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-3',
        snapshotFrame: 0,
        voterCountAtCapture: 0,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'leaderboard',
        aggregation: {
          kind: 'leaderboard',
          quizId: 'quiz-empty',
          ranking: [],
          totalParticipants: 0,
        },
      },
      context: { width: 400, height: 200 },
      emitLossFlag: () => {},
    });
    if (result.state !== 'rendered') throw new Error('expected rendered');
    await act(async () => {
      root.render(result.output as React.ReactElement);
    });
    const root_el = host.querySelector('[data-stageflip-clip="leaderboard"]');
    expect(root_el?.getAttribute('data-state')).toBe('waiting');
    const waiting = host.querySelector('[data-testid="leaderboard-waiting"]');
    expect(waiting?.textContent).toBe('Waiting for participants…');
  });
});

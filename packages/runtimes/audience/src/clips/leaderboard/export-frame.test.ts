// packages/runtimes/audience/src/clips/leaderboard/export-frame.test.ts
// T-472 — Tests for the leaderboard SVG export-frame emitter.

import type { LeaderboardAggregation } from '@stageflip/audience-contract';
import type { LeaderboardClipElement } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import {
  formatTotalLabel,
  renderLeaderboardExportFrame,
  resolveDisplayName,
} from './export-frame.js';

const ELEMENT: LeaderboardClipElement = {
  id: 'el-6',
  transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
  type: 'leaderboard',
  permissions: ['audience-network'],
  props: { quizId: 'quiz-1', topN: 10, title: 'Top 10' },
};

const SNAPSHOT: LeaderboardAggregation = {
  kind: 'leaderboard',
  quizId: 'quiz-1',
  ranking: [
    { voterToken: 'tok-1', displayName: 'Alice', score: 100, rank: 1 },
    { voterToken: 'tok-2', displayName: 'Bob', score: 90, rank: 2 },
    { voterToken: 'tok-3', score: 80, rank: 3 },
  ],
  totalParticipants: 3,
};

describe('formatTotalLabel', () => {
  it('singular at 1 / plural otherwise', () => {
    expect(formatTotalLabel(1)).toBe('1 participant');
    expect(formatTotalLabel(5)).toBe('5 participants');
  });
});

describe('resolveDisplayName', () => {
  it('returns the displayName when present', () => {
    expect(resolveDisplayName('Alice')).toBe('Alice');
  });
  it('falls back to "Anonymous voter" when absent or empty', () => {
    expect(resolveDisplayName(undefined)).toBe('Anonymous voter');
    expect(resolveDisplayName('')).toBe('Anonymous voter');
  });
});

describe('renderLeaderboardExportFrame', () => {
  it('emits a well-formed SVG', () => {
    const out = renderLeaderboardExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg.startsWith('<svg ')).toBe(true);
    expect(out.svg.endsWith('</svg>')).toBe(true);
    expect(out.svg).toContain('viewBox="0 0 1280 720"');
  });

  it('renders the title, names, and scores', () => {
    const out = renderLeaderboardExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('Top 10');
    expect(out.svg).toContain('Alice');
    expect(out.svg).toContain('Bob');
    expect(out.svg).toContain('Anonymous voter');
    expect(out.svg).toContain('>100<');
    expect(out.svg).toContain('>90<');
    expect(out.svg).toContain('>80<');
  });

  it('renders medal-coloured badges for top-3 ranks', () => {
    const out = renderLeaderboardExportFrame(SNAPSHOT, ELEMENT);
    // gold / silver / bronze
    expect(out.svg).toContain('#fbbf24');
    expect(out.svg).toContain('#9ca3af');
    expect(out.svg).toContain('#b45309');
  });

  it('renders the total label', () => {
    const out = renderLeaderboardExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('3 participants');
  });

  it('falls back to a default "Leaderboard" header when title is absent', () => {
    const out = renderLeaderboardExportFrame(SNAPSHOT, {
      ...ELEMENT,
      props: { quizId: 'quiz-1', topN: 10 },
    });
    expect(out.svg).toContain('Leaderboard');
  });

  it('is byte-deterministic', () => {
    const a = renderLeaderboardExportFrame(SNAPSHOT, ELEMENT);
    const b = renderLeaderboardExportFrame(SNAPSHOT, ELEMENT);
    expect(a.svg).toBe(b.svg);
  });
});

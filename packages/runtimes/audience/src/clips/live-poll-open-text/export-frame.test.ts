// packages/runtimes/audience/src/clips/live-poll-open-text/export-frame.test.ts
// T-472 — Tests for the live-poll-open-text SVG export-frame emitter.

import type { LivePollOpenTextAggregation } from '@stageflip/audience-contract';
import type { LivePollOpenTextClipElement } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import {
  formatCountLabel,
  formatTotalLabel,
  renderLivePollOpenTextExportFrame,
  sortEntriesByCountDesc,
} from './export-frame.js';

const ELEMENT: LivePollOpenTextClipElement = {
  id: 'el-2',
  transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
  type: 'live-poll-open-text',
  permissions: ['audience-network'],
  props: { question: 'What is your favorite color?', maxLength: 280, topN: 50 },
};

const SNAPSHOT: LivePollOpenTextAggregation = {
  kind: 'live-poll-open-text',
  entries: [
    { text: 'red', count: 3 },
    { text: 'blue', count: 7 },
    { text: 'green', count: 5 },
  ],
  totalVotes: 15,
};

describe('formatTotalLabel', () => {
  it('singular at 1 / plural otherwise', () => {
    expect(formatTotalLabel(1)).toBe('1 response');
    expect(formatTotalLabel(0)).toBe('0 responses');
    expect(formatTotalLabel(5)).toBe('5 responses');
  });
});

describe('formatCountLabel', () => {
  it('singular at 1 / plural otherwise', () => {
    expect(formatCountLabel(1)).toBe('1 vote');
    expect(formatCountLabel(7)).toBe('7 votes');
  });
});

describe('sortEntriesByCountDesc', () => {
  it('sorts by count descending without mutating the source', () => {
    const input = [
      { text: 'a', count: 1 },
      { text: 'b', count: 3 },
      { text: 'c', count: 2 },
    ];
    const out = sortEntriesByCountDesc(input);
    expect(out.map((e) => e.text)).toEqual(['b', 'c', 'a']);
    expect(input.map((e) => e.text)).toEqual(['a', 'b', 'c']);
  });
});

describe('renderLivePollOpenTextExportFrame', () => {
  it('emits a well-formed SVG with viewBox matching the element transform', () => {
    const out = renderLivePollOpenTextExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg.startsWith('<svg ')).toBe(true);
    expect(out.svg).toContain('viewBox="0 0 1280 720"');
    expect(out.svg.endsWith('</svg>')).toBe(true);
  });

  it('contains the question and each entry text', () => {
    const out = renderLivePollOpenTextExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('What is your favorite color?');
    expect(out.svg).toContain('blue');
    expect(out.svg).toContain('red');
    expect(out.svg).toContain('green');
  });

  it('renders entries sorted by count desc', () => {
    const out = renderLivePollOpenTextExportFrame(SNAPSHOT, ELEMENT);
    const idxBlue = out.svg.indexOf('>blue<');
    const idxGreen = out.svg.indexOf('>green<');
    const idxRed = out.svg.indexOf('>red<');
    expect(idxBlue).toBeGreaterThan(-1);
    expect(idxBlue).toBeLessThan(idxGreen);
    expect(idxGreen).toBeLessThan(idxRed);
  });

  it('renders the per-row count badge label', () => {
    const out = renderLivePollOpenTextExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('7 votes');
    expect(out.svg).toContain('5 votes');
    expect(out.svg).toContain('3 votes');
  });

  it('renders the bottom total label', () => {
    const out = renderLivePollOpenTextExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('15 responses');
  });

  it('is byte-deterministic', () => {
    const a = renderLivePollOpenTextExportFrame(SNAPSHOT, ELEMENT);
    const b = renderLivePollOpenTextExportFrame(SNAPSHOT, ELEMENT);
    expect(a.svg).toBe(b.svg);
  });

  it('handles an empty snapshot without throwing', () => {
    const out = renderLivePollOpenTextExportFrame(
      { kind: 'live-poll-open-text', entries: [], totalVotes: 0 },
      ELEMENT,
    );
    expect(out.svg).toContain('0 responses');
  });
});

// packages/runtimes/audience/src/clips/live-poll-multiple-choice/export-frame.test.ts
// T-472 — Tests for the live-poll-multiple-choice SVG export-frame emitter.

import type { LivePollMultipleChoiceAggregation } from '@stageflip/audience-contract';
import type { LivePollMultipleChoiceClipElement } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import {
  computePercent,
  formatTotalLabel,
  renderLivePollMultipleChoiceExportFrame,
} from './export-frame.js';

const ELEMENT: LivePollMultipleChoiceClipElement = {
  id: 'el-1',
  transform: { x: 0, y: 0, width: 800, height: 600, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
  type: 'live-poll-multiple-choice',
  permissions: ['audience-network'],
  props: { question: 'Pick one', options: ['Red', 'Green', 'Blue'] },
};

const SNAPSHOT: LivePollMultipleChoiceAggregation = {
  kind: 'live-poll-multiple-choice',
  optionCounts: [10, 5, 3],
  totalVotes: 18,
};

describe('computePercent', () => {
  it('returns 0 when totalVotes is 0', () => {
    expect(computePercent(5, 0)).toBe(0);
  });
  it('floors the percentage', () => {
    expect(computePercent(10, 18)).toBe(55);
  });
});

describe('formatTotalLabel', () => {
  it('singular at 1', () => {
    expect(formatTotalLabel(1)).toBe('1 vote');
  });
  it('plural at 0 and >1', () => {
    expect(formatTotalLabel(0)).toBe('0 votes');
    expect(formatTotalLabel(18)).toBe('18 votes');
  });
});

describe('renderLivePollMultipleChoiceExportFrame', () => {
  it('emits a well-formed <svg> with viewBox dimensions matching the element transform', () => {
    const out = renderLivePollMultipleChoiceExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg.startsWith('<svg ')).toBe(true);
    expect(out.svg).toContain('viewBox="0 0 800 600"');
    expect(out.svg.endsWith('</svg>')).toBe(true);
    expect(out.width).toBe(800);
    expect(out.height).toBe(600);
    expect(out.voterCountAtCapture).toBe(18);
  });

  it('contains the question text and per-option labels', () => {
    const out = renderLivePollMultipleChoiceExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('Pick one');
    expect(out.svg).toContain('Red');
    expect(out.svg).toContain('Green');
    expect(out.svg).toContain('Blue');
  });

  it('renders the percentage label per option', () => {
    const out = renderLivePollMultipleChoiceExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('55%');
    expect(out.svg).toContain('27%');
    expect(out.svg).toContain('16%');
  });

  it('renders the singular "1 vote" / plural "N votes" total label', () => {
    const out = renderLivePollMultipleChoiceExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('18 votes');
  });

  it('escapes special characters in question / option labels', () => {
    const out = renderLivePollMultipleChoiceExportFrame(
      { kind: 'live-poll-multiple-choice', optionCounts: [1, 0], totalVotes: 1 },
      {
        ...ELEMENT,
        props: { question: '<x>&y', options: ['"a"', "'b'"] },
      },
    );
    expect(out.svg).toContain('&lt;x&gt;&amp;y');
    expect(out.svg).toContain('&quot;a&quot;');
    expect(out.svg).toContain('&apos;b&apos;');
  });

  it('is byte-deterministic across two calls', () => {
    const a = renderLivePollMultipleChoiceExportFrame(SNAPSHOT, ELEMENT);
    const b = renderLivePollMultipleChoiceExportFrame(SNAPSHOT, ELEMENT);
    expect(a.svg).toBe(b.svg);
  });

  it('handles an empty snapshot without throwing', () => {
    const out = renderLivePollMultipleChoiceExportFrame(
      { kind: 'live-poll-multiple-choice', optionCounts: [0, 0, 0], totalVotes: 0 },
      ELEMENT,
    );
    expect(out.svg).toContain('0 votes');
    expect(out.svg).toContain('0%');
  });
});

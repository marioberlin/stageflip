// packages/runtimes/audience/src/clips/live-qa/export-frame.test.ts
// T-472 — Tests for the live-qa SVG export-frame emitter.

import type { LiveQAAggregation } from '@stageflip/audience-contract';
import type { LiveQAClipElement } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { formatTotalLabel, renderLiveQAExportFrame, sortQuestions } from './export-frame.js';

const ELEMENT: LiveQAClipElement = {
  id: 'el-4',
  transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
  type: 'live-qa',
  permissions: ['audience-network'],
  props: { topic: 'AMA: backend', allowUpvoting: true, maxLength: 500, topN: 100 },
};

const SNAPSHOT: LiveQAAggregation = {
  kind: 'live-qa',
  questions: [
    {
      id: 'q1',
      text: 'Why Rust?',
      upvotes: 12,
      submittedAt: '2026-05-12T00:00:01Z',
      answered: true,
    },
    { id: 'q2', text: 'Why Postgres?', upvotes: 5, submittedAt: '2026-05-12T00:00:02Z' },
    { id: 'q3', text: 'Cloud or bare-metal?', upvotes: 8, submittedAt: '2026-05-12T00:00:03Z' },
  ],
  totalQuestions: 3,
};

describe('formatTotalLabel', () => {
  it('singular at 1', () => {
    expect(formatTotalLabel(1)).toBe('1 question');
  });
  it('plural elsewhere', () => {
    expect(formatTotalLabel(5)).toBe('5 questions');
  });
});

describe('sortQuestions', () => {
  it('sorts by upvotes desc and submittedAt asc for ties', () => {
    const out = sortQuestions([
      { upvotes: 3, submittedAt: 'b' },
      { upvotes: 5, submittedAt: 'c' },
      { upvotes: 3, submittedAt: 'a' },
    ]);
    expect(out.map((q) => q.submittedAt)).toEqual(['c', 'a', 'b']);
  });
});

describe('renderLiveQAExportFrame', () => {
  it('emits a well-formed SVG', () => {
    const out = renderLiveQAExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg.startsWith('<svg ')).toBe(true);
    expect(out.svg.endsWith('</svg>')).toBe(true);
    expect(out.svg).toContain('viewBox="0 0 1280 720"');
  });

  it('renders the topic and per-question text', () => {
    const out = renderLiveQAExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('AMA: backend');
    expect(out.svg).toContain('Why Rust?');
    expect(out.svg).toContain('Why Postgres?');
  });

  it('renders an upvote count badge per question', () => {
    const out = renderLiveQAExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('▲ 12');
    expect(out.svg).toContain('▲ 5');
    expect(out.svg).toContain('▲ 8');
  });

  it('renders an "Answered" tag for answered questions', () => {
    const out = renderLiveQAExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('Answered');
  });

  it('renders the total label', () => {
    const out = renderLiveQAExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('3 questions');
  });

  it('is byte-deterministic', () => {
    const a = renderLiveQAExportFrame(SNAPSHOT, ELEMENT);
    const b = renderLiveQAExportFrame(SNAPSHOT, ELEMENT);
    expect(a.svg).toBe(b.svg);
  });

  it('handles an empty snapshot', () => {
    const out = renderLiveQAExportFrame(
      { kind: 'live-qa', questions: [], totalQuestions: 0 },
      ELEMENT,
    );
    expect(out.svg).toContain('0 questions');
  });
});

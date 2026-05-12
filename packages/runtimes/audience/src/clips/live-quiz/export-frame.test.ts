// packages/runtimes/audience/src/clips/live-quiz/export-frame.test.ts
// T-472 — Tests for the live-quiz SVG export-frame emitter.

import type { LiveQuizAggregation } from '@stageflip/audience-contract';
import type { LiveQuizClipElement } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { formatTotalLabel, renderLiveQuizExportFrame } from './export-frame.js';

const ELEMENT: LiveQuizClipElement = {
  id: 'el-5',
  transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
  type: 'live-quiz',
  permissions: ['audience-network'],
  props: {
    questions: [
      {
        id: 'q1',
        text: 'Capital of France?',
        options: ['Paris', 'London', 'Madrid'],
        correctOptionIndex: 0,
      },
      { id: 'q2', text: 'Capital of Spain?', options: ['Lisbon', 'Madrid'], correctOptionIndex: 1 },
    ],
  },
};

const SNAPSHOT: LiveQuizAggregation = {
  kind: 'live-quiz',
  activeQuestionId: 'q2',
  questionResults: [
    {
      questionId: 'q1',
      optionCounts: [8, 1, 1],
      correctOptionIndex: 0,
      totalVotes: 10,
      status: 'closed',
    },
    {
      questionId: 'q2',
      optionCounts: [2, 5],
      correctOptionIndex: 1,
      totalVotes: 7,
      status: 'active',
    },
  ],
  totalVoters: 10,
};

describe('formatTotalLabel', () => {
  it('singular at 1 / plural otherwise', () => {
    expect(formatTotalLabel(1)).toBe('1 voter');
    expect(formatTotalLabel(0)).toBe('0 voters');
    expect(formatTotalLabel(10)).toBe('10 voters');
  });
});

describe('renderLiveQuizExportFrame', () => {
  it('emits a well-formed SVG', () => {
    const out = renderLiveQuizExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg.startsWith('<svg ')).toBe(true);
    expect(out.svg.endsWith('</svg>')).toBe(true);
    expect(out.svg).toContain('viewBox="0 0 1280 720"');
  });

  it('renders the per-question text and option labels', () => {
    const out = renderLiveQuizExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('Capital of France?');
    expect(out.svg).toContain('Capital of Spain?');
    expect(out.svg).toContain('Paris');
    expect(out.svg).toContain('Madrid');
  });

  it('renders the per-result status', () => {
    const out = renderLiveQuizExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('closed');
    expect(out.svg).toContain('active');
  });

  it('renders the bottom total label', () => {
    const out = renderLiveQuizExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('10 voters');
  });

  it('is byte-deterministic', () => {
    const a = renderLiveQuizExportFrame(SNAPSHOT, ELEMENT);
    const b = renderLiveQuizExportFrame(SNAPSHOT, ELEMENT);
    expect(a.svg).toBe(b.svg);
  });

  it('handles an empty snapshot', () => {
    const out = renderLiveQuizExportFrame(
      { kind: 'live-quiz', activeQuestionId: null, questionResults: [], totalVoters: 0 },
      ELEMENT,
    );
    expect(out.svg).toContain('0 voters');
  });
});

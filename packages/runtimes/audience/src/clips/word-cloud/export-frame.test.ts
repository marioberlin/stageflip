// packages/runtimes/audience/src/clips/word-cloud/export-frame.test.ts
// T-472 — Tests for the word-cloud SVG export-frame emitter.

import type { WordCloudAggregation } from '@stageflip/audience-contract';
import type { WordCloudClipElement } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import {
  approximateWordWidth,
  fontSizeFor,
  formatTotalLabel,
  renderWordCloudExportFrame,
} from './export-frame.js';

const ELEMENT: WordCloudClipElement = {
  id: 'el-7',
  transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
  type: 'word-cloud',
  permissions: ['audience-network'],
  props: { prompt: 'Describe yourself', maxWords: 100, maxWordsPerVoter: 3 },
};

const SNAPSHOT: WordCloudAggregation = {
  kind: 'word-cloud',
  words: [
    { word: 'curious', weight: 10 },
    { word: 'happy', weight: 5 },
    { word: 'tired', weight: 2 },
  ],
  totalSubmissions: 17,
};

describe('formatTotalLabel', () => {
  it('singular at 1 / plural otherwise', () => {
    expect(formatTotalLabel(1)).toBe('1 submission');
    expect(formatTotalLabel(17)).toBe('17 submissions');
  });
});

describe('fontSizeFor', () => {
  it('returns MIN size when maxWeight is 0', () => {
    expect(fontSizeFor(0, 0)).toBe(14);
  });
  it('returns MAX size when weight equals maxWeight', () => {
    expect(fontSizeFor(10, 10)).toBe(50);
  });
  it('interpolates linearly between MIN and MAX', () => {
    expect(fontSizeFor(5, 10)).toBe(32);
  });
});

describe('approximateWordWidth', () => {
  it('is roughly fontSize * length * 0.55', () => {
    expect(approximateWordWidth('hello', 20)).toBe(Math.ceil(5 * 20 * 0.55));
  });
});

describe('renderWordCloudExportFrame', () => {
  it('emits a well-formed SVG', () => {
    const out = renderWordCloudExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg.startsWith('<svg ')).toBe(true);
    expect(out.svg.endsWith('</svg>')).toBe(true);
    expect(out.svg).toContain('viewBox="0 0 1280 720"');
  });

  it('renders the prompt + every word + the total label', () => {
    const out = renderWordCloudExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('Describe yourself');
    expect(out.svg).toContain('curious');
    expect(out.svg).toContain('happy');
    expect(out.svg).toContain('tired');
    expect(out.svg).toContain('17 submissions');
  });

  it('uses larger font-size for higher-weight words', () => {
    const out = renderWordCloudExportFrame(SNAPSHOT, ELEMENT);
    const curiousFs = out.svg.match(/font-size="(\d+)"[^>]*>curious</)?.[1];
    const tiredFs = out.svg.match(/font-size="(\d+)"[^>]*>tired</)?.[1];
    expect(curiousFs).toBeDefined();
    expect(tiredFs).toBeDefined();
    expect(Number(curiousFs)).toBeGreaterThan(Number(tiredFs));
  });

  it('is byte-deterministic', () => {
    const a = renderWordCloudExportFrame(SNAPSHOT, ELEMENT);
    const b = renderWordCloudExportFrame(SNAPSHOT, ELEMENT);
    expect(a.svg).toBe(b.svg);
  });

  it('handles an empty word list', () => {
    const out = renderWordCloudExportFrame(
      { kind: 'word-cloud', words: [], totalSubmissions: 0 },
      ELEMENT,
    );
    expect(out.svg).toContain('0 submissions');
  });
});

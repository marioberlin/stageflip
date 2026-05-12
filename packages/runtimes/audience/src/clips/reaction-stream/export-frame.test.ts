// packages/runtimes/audience/src/clips/reaction-stream/export-frame.test.ts
// T-472 — Tests for the reaction-stream SVG export-frame emitter.

import type { ReactionStreamAggregation } from '@stageflip/audience-contract';
import type { ReactionStreamClipElement } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import {
  emojiColor,
  formatTotalLabel,
  particleCountFor,
  renderReactionStreamExportFrame,
} from './export-frame.js';

const ELEMENT: ReactionStreamClipElement = {
  id: 'el-10',
  transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
  type: 'reaction-stream',
  permissions: ['audience-network'],
  props: {
    prompt: 'React!',
    palette: [
      { emojiId: 'thumbs-up', glyph: '👍' },
      { emojiId: 'heart', glyph: '❤️' },
    ],
  },
};

const SNAPSHOT: ReactionStreamAggregation = {
  kind: 'reaction-stream',
  emojiCounts: [
    { emojiId: 'thumbs-up', count: 8, recentBurst: 4 },
    { emojiId: 'heart', count: 4, recentBurst: 2 },
  ],
  totalReactions: 12,
};

describe('formatTotalLabel', () => {
  it('singular at 1 / plural otherwise', () => {
    expect(formatTotalLabel(1)).toBe('1 reaction');
    expect(formatTotalLabel(12)).toBe('12 reactions');
  });
});

describe('emojiColor', () => {
  it('returns a deterministic rgb() string per index', () => {
    expect(emojiColor(0)).toBe(emojiColor(0));
    expect(emojiColor(0)).not.toBe(emojiColor(1));
    expect(emojiColor(0)).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });
});

describe('particleCountFor', () => {
  it('returns 0 when total is 0', () => {
    expect(particleCountFor(0, 0)).toBe(0);
  });
  it('clamps to PARTICLES_PER_EMOJI maximum', () => {
    expect(particleCountFor(100, 10)).toBe(10);
  });
  it('scales linearly with recentBurst', () => {
    expect(particleCountFor(5, 10)).toBe(5);
  });
});

describe('renderReactionStreamExportFrame', () => {
  it('emits a well-formed SVG', () => {
    const out = renderReactionStreamExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg.startsWith('<svg ')).toBe(true);
    expect(out.svg.endsWith('</svg>')).toBe(true);
    expect(out.svg).toContain('viewBox="0 0 1280 720"');
  });

  it('renders the prompt and total label', () => {
    const out = renderReactionStreamExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('React!');
    expect(out.svg).toContain('12 reactions');
  });

  it('renders a non-empty set of circles when emojiCounts has entries', () => {
    const out = renderReactionStreamExportFrame(SNAPSHOT, ELEMENT);
    const matches = out.svg.match(/<circle/g);
    expect(matches?.length ?? 0).toBeGreaterThan(0);
  });

  it('renders no circles when all counts are 0', () => {
    const out = renderReactionStreamExportFrame(
      { kind: 'reaction-stream', emojiCounts: [], totalReactions: 0 },
      ELEMENT,
    );
    expect(out.svg).not.toContain('<circle');
  });

  it('is byte-deterministic', () => {
    const a = renderReactionStreamExportFrame(SNAPSHOT, ELEMENT);
    const b = renderReactionStreamExportFrame(SNAPSHOT, ELEMENT);
    expect(a.svg).toBe(b.svg);
  });
});

// scripts/loadtest/audience-sla.test.ts
// T-477 — Unit tests for the pure helpers in `audience-sla.ts`. The K6
// script itself is `k6 inspect`-validated at PR review (K6 ships its
// own Goja runtime; vitest cannot host it).

import { describe, expect, it } from 'vitest';

import { parseThresholds, synthesizeBatchSnapshot } from './audience-sla.js';

describe('parseThresholds', () => {
  it('parses a single p(95)<500 expression', () => {
    const out = parseThresholds('p(95)<500');
    expect(out).toEqual([{ aggregate: 'p(95)', op: '<', value: 500, expression: 'p(95)<500' }]);
  });

  it('parses multiple comma-separated expressions', () => {
    const out = parseThresholds('p(95)<500,p(99)<1000');
    expect(out).toHaveLength(2);
    expect(out[0]?.expression).toBe('p(95)<500');
    expect(out[1]?.expression).toBe('p(99)<1000');
  });

  it('parses every K6 aggregate function', () => {
    const out = parseThresholds('avg<200,min<10,max<2000,med<150,count<10000,rate>0.99');
    expect(out.map((t) => t.aggregate)).toEqual(['avg', 'min', 'max', 'med', 'count', 'rate']);
  });

  it('parses fractional percentile (p(99.9)<1500)', () => {
    const out = parseThresholds('p(99.9)<1500');
    expect(out[0]?.aggregate).toBe('p(99.9)');
    expect(out[0]?.value).toBe(1500);
  });

  it('parses all four ops (<, <=, >, >=)', () => {
    const out = parseThresholds('avg<100,avg<=100,avg>50,avg>=50');
    expect(out.map((t) => t.op)).toEqual(['<', '<=', '>', '>=']);
  });

  it('parses fractional values', () => {
    const out = parseThresholds('rate>0.99');
    expect(out[0]?.value).toBe(0.99);
  });

  it('returns empty array for empty / whitespace-only spec', () => {
    expect(parseThresholds('')).toEqual([]);
    expect(parseThresholds('   ')).toEqual([]);
  });

  it('skips empty segments between commas', () => {
    expect(parseThresholds('p(95)<500,,p(99)<1000')).toHaveLength(2);
  });

  it('trims whitespace around segments', () => {
    const out = parseThresholds('  p(95)<500  ,  p(99)<1000  ');
    expect(out.map((t) => t.expression)).toEqual(['p(95)<500', 'p(99)<1000']);
  });

  it('throws on unknown aggregate function', () => {
    expect(() => parseThresholds('pct(95)<500')).toThrow(/invalid threshold segment/);
  });

  it('throws on missing operator', () => {
    expect(() => parseThresholds('p(95)500')).toThrow(/invalid threshold segment/);
  });

  it('throws on missing value', () => {
    expect(() => parseThresholds('p(95)<')).toThrow(/invalid threshold segment/);
  });

  it('throws on non-numeric value', () => {
    expect(() => parseThresholds('p(95)<abc')).toThrow(/invalid threshold segment/);
  });

  it('throws on garbage with helpful message', () => {
    expect(() => parseThresholds('garbage')).toThrow(/invalid threshold segment: "garbage"/);
  });
});

describe('synthesizeBatchSnapshot', () => {
  it('produces exactly voterCount taps', () => {
    expect(synthesizeBatchSnapshot(1, 'sess')).toHaveLength(1);
    expect(synthesizeBatchSnapshot(10, 'sess')).toHaveLength(10);
    expect(synthesizeBatchSnapshot(1000, 'sess')).toHaveLength(1000);
  });

  it('is deterministic — same input produces same output', () => {
    const a = synthesizeBatchSnapshot(50, 'load-test-session');
    const b = synthesizeBatchSnapshot(50, 'load-test-session');
    expect(a).toEqual(b);
  });

  it('produces distinct voter tokens within a batch', () => {
    const taps = synthesizeBatchSnapshot(100, 'sess');
    const tokens = new Set(taps.map((t) => t.voterToken));
    expect(tokens.size).toBe(100);
  });

  it('encodes sessionId + zero-padded index in voter token', () => {
    const taps = synthesizeBatchSnapshot(3, 'demo');
    expect(taps[0]?.voterToken).toBe('loadvoter-demo-000000');
    expect(taps[1]?.voterToken).toBe('loadvoter-demo-000001');
    expect(taps[2]?.voterToken).toBe('loadvoter-demo-000002');
  });

  it('rotates across four cheap vote discriminants', () => {
    const taps = synthesizeBatchSnapshot(8, 'sess');
    expect(taps[0]?.payload.kind).toBe('live-poll-multiple-choice');
    expect(taps[1]?.payload.kind).toBe('live-poll-rating');
    expect(taps[2]?.payload.kind).toBe('reaction-stream');
    expect(taps[3]?.payload.kind).toBe('heatmap');
    // Cycle repeats:
    expect(taps[4]?.payload.kind).toBe('live-poll-multiple-choice');
    expect(taps[5]?.payload.kind).toBe('live-poll-rating');
    expect(taps[6]?.payload.kind).toBe('reaction-stream');
    expect(taps[7]?.payload.kind).toBe('heatmap');
  });

  it('multiple-choice variant has a valid optionIndex (0..3)', () => {
    const taps = synthesizeBatchSnapshot(20, 'sess');
    for (const tap of taps) {
      if (tap.payload.kind === 'live-poll-multiple-choice') {
        expect(tap.payload.optionIndex).toBeGreaterThanOrEqual(0);
        expect(tap.payload.optionIndex).toBeLessThanOrEqual(3);
      }
    }
  });

  it('rating variant has a valid score (1..5)', () => {
    const taps = synthesizeBatchSnapshot(20, 'sess');
    for (const tap of taps) {
      if (tap.payload.kind === 'live-poll-rating') {
        expect(tap.payload.score).toBeGreaterThanOrEqual(1);
        expect(tap.payload.score).toBeLessThanOrEqual(5);
      }
    }
  });

  it('heatmap variant has x, y in [0, 1)', () => {
    const taps = synthesizeBatchSnapshot(100, 'sess');
    for (const tap of taps) {
      if (tap.payload.kind === 'heatmap') {
        expect(tap.payload.x).toBeGreaterThanOrEqual(0);
        expect(tap.payload.x).toBeLessThan(1);
        expect(tap.payload.y).toBeGreaterThanOrEqual(0);
        expect(tap.payload.y).toBeLessThan(1);
      }
    }
  });

  it('reaction-stream variant emits one of the five palette emoji', () => {
    const allowed = new Set(['heart', 'thumbs-up', 'fire', 'laugh', 'wow']);
    const taps = synthesizeBatchSnapshot(100, 'sess');
    for (const tap of taps) {
      if (tap.payload.kind === 'reaction-stream') {
        expect(allowed.has(tap.payload.emojiId)).toBe(true);
      }
    }
  });

  it('different sessionIds produce different voter tokens', () => {
    const a = synthesizeBatchSnapshot(5, 'sessA');
    const b = synthesizeBatchSnapshot(5, 'sessB');
    for (let i = 0; i < 5; i++) {
      expect(a[i]?.voterToken).not.toBe(b[i]?.voterToken);
    }
  });

  it('throws on voterCount < 1', () => {
    expect(() => synthesizeBatchSnapshot(0, 'sess')).toThrow(/positive integer/);
    expect(() => synthesizeBatchSnapshot(-1, 'sess')).toThrow(/positive integer/);
  });

  it('throws on non-integer voterCount', () => {
    expect(() => synthesizeBatchSnapshot(1.5, 'sess')).toThrow(/positive integer/);
  });

  it('throws on empty sessionId', () => {
    expect(() => synthesizeBatchSnapshot(10, '')).toThrow(/non-empty/);
    expect(() => synthesizeBatchSnapshot(10, '   ')).toThrow(/non-empty/);
  });

  it('scales to 1000 voters without error', () => {
    const taps = synthesizeBatchSnapshot(1000, 'load-test-session');
    expect(taps).toHaveLength(1000);
    expect(new Set(taps.map((t) => t.voterToken)).size).toBe(1000);
  });
});

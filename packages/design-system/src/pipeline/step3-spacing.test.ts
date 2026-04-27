// packages/design-system/src/pipeline/step3-spacing.test.ts
// AC #11-12.

import { describe, expect, it } from 'vitest';
import { buildTestState, makeDoc } from '../test-helpers.js';
import { runStep3 } from './step3-spacing.js';

describe('step 3 — spacing extraction', () => {
  it('AC #11: consistent 16 px spacing → one token at ~16', () => {
    const doc = makeDoc([
      {
        fills: ['#ff0000', '#00ff00', '#0000ff', '#ffff00'],
        positions: [
          { x: 0, y: 0, width: 100, height: 100 },
          { x: 116, y: 0, width: 100, height: 100 },
          { x: 232, y: 0, width: 100, height: 100 },
          { x: 348, y: 0, width: 100, height: 100 },
        ],
      },
    ]);
    const r = runStep3(buildTestState(doc));
    const values = Object.values(r.spacingTokens);
    expect(values).toContain(16);
  });

  it('AC #12: bimodal spacing → tight (~8) + wide (~32) tokens', () => {
    const doc = makeDoc([
      {
        fills: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'],
        positions: [
          { x: 0, y: 0, width: 100, height: 100 },
          { x: 108, y: 0, width: 100, height: 100 },
          { x: 216, y: 0, width: 100, height: 100 },
          { x: 348, y: 0, width: 100, height: 100 }, // 32 px gap
          { x: 456, y: 0, width: 100, height: 100 },
          { x: 564, y: 0, width: 100, height: 100 },
        ],
      },
    ]);
    const r = runStep3(buildTestState(doc));
    const values = Object.values(r.spacingTokens).sort((a, b) => a - b);
    // Both 8 and 32 (or close) should appear.
    expect(values.some((v) => v >= 7 && v <= 9)).toBe(true);
    expect(values.some((v) => v >= 30 && v <= 34)).toBe(true);
  });

  it('handles empty slides without crashing', () => {
    const doc = makeDoc([{}]);
    const r = runStep3(buildTestState(doc));
    expect(r.spacingTokens).toEqual({});
  });
});

// packages/design-system/src/pipeline/step2-typography.test.ts
// AC #8-10.

import { describe, expect, it } from 'vitest';
import { buildTestState, makeDoc } from '../test-helpers.js';
import { runStep2 } from './step2-typography.js';

describe('step 2 — typography extraction', () => {
  it('AC #8: 3 distinct (family, size) → 3 typography clusters', () => {
    const doc = makeDoc([
      {
        textRuns: [
          { family: 'Roboto', size: 12 },
          { family: 'Roboto', size: 24 },
          { family: 'Inter', size: 36 },
        ],
      },
    ]);
    const r = runStep2(buildTestState(doc));
    expect(r.typographyClusters.length).toBe(3);
    expect(r.diagnostic.familyCount).toBe(2);
  });

  it('AC #9: most-frequent typography ranks first (becomes body in step 7)', () => {
    const doc = makeDoc([
      {
        textRuns: [
          { family: 'Roboto', size: 12 },
          { family: 'Roboto', size: 12 },
          { family: 'Roboto', size: 12 },
          { family: 'Inter', size: 36 },
        ],
      },
    ]);
    const r = runStep2(buildTestState(doc));
    expect(r.typographyClusters[0]?.token.fontFamily).toBe('Roboto');
    expect(r.typographyClusters[0]?.token.fontSize).toBe(12);
  });

  it('walks text runs (inheriting family/size from element)', () => {
    const doc = makeDoc([{}]);
    if (doc.content.mode !== 'slide') throw new Error();
    doc.content.slides[0]?.elements.push({
      id: 's1-text',
      type: 'text',
      text: 'hi',
      fontFamily: 'Roboto',
      fontSize: 12,
      align: 'left',
      transform: { x: 0, y: 0, width: 100, height: 20, rotation: 0, opacity: 1 },
      visible: true,
      locked: false,
      animations: [],
      runs: [
        { text: 'a', weight: 400 },
        { text: 'b', weight: 700, italic: true },
      ],
    });
    const r = runStep2(buildTestState(doc));
    // base sample (weight 400) collides with first run (weight 400); second
    // run (weight 700, italic) is distinct → 2 unique clusters.
    expect(r.typographyClusters.length).toBe(2);
  });

  it('AC #10: largest size cluster is identifiable for display/h1 naming', () => {
    const doc = makeDoc([
      {
        textRuns: [
          { family: 'Inter', size: 14 },
          { family: 'Inter', size: 14 },
          { family: 'Inter', size: 36 },
          { family: 'Inter', size: 48 },
        ],
      },
    ]);
    const r = runStep2(buildTestState(doc));
    const sizes = r.typographyClusters.map((c) => c.token.fontSize);
    expect(Math.max(...sizes)).toBe(48);
  });
});

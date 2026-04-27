// packages/design-system/src/pipeline/step4-shape-language.test.ts
// AC #13-14.

import { describe, expect, it } from 'vitest';
import { buildTestState, makeDoc } from '../test-helpers.js';
import { runStep4 } from './step4-shape-language.js';

describe('step 4 — shape language (read-only)', () => {
  it('AC #13: 80% rect + 20% ellipse → histogram reflects split', () => {
    const doc = makeDoc([
      {
        fills: ['#ff0000', '#ff0000', '#ff0000', '#ff0000', '#ff0000'],
        shapes: ['rect', 'rect', 'rect', 'rect', 'ellipse'],
      },
    ]);
    const r = runStep4(buildTestState(doc));
    expect(r.shapeLanguage.histogram.rect).toBe(4);
    expect(r.shapeLanguage.histogram.ellipse).toBe(1);
  });

  it('AC #14: does NOT mutate the document', () => {
    const doc = makeDoc([
      {
        fills: ['#ff0000'],
      },
    ]);
    const before = JSON.stringify(doc);
    runStep4(buildTestState(doc));
    expect(JSON.stringify(doc)).toBe(before);
  });

  it('coverage = 0 when no slides have shapes', () => {
    const doc = makeDoc([{ textColors: ['#ff0000'] }]);
    const r = runStep4(buildTestState(doc));
    expect(r.shapeLanguage.coverage).toBe(0);
  });

  it('coverage = 1 when every slide has at least one shape', () => {
    const doc = makeDoc([{ fills: ['#ff0000'] }, { fills: ['#00ff00'] }]);
    const r = runStep4(buildTestState(doc));
    expect(r.shapeLanguage.coverage).toBe(1);
  });
});

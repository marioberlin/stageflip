// packages/design-system/src/pipeline/step5-components.test.ts
// AC #15-16.

import type { Document, Slide } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import { buildTestState, makeDoc } from '../test-helpers.js';
import { runStep5 } from './step5-components.js';

function setText(slide: Slide, idx: number, text: string): void {
  const el = slide.elements[idx];
  if (el && el.type === 'text') {
    (el as { text: string }).text = text;
  }
}

function buildRecurringDeck(slideCount: number): Document {
  const doc = makeDoc(
    Array.from({ length: slideCount }, () => ({
      textColors: ['#000', '#000'],
      positions: [
        { x: 0, y: 0, width: 200, height: 100 },
        { x: 0, y: 110, width: 200, height: 50 },
      ],
    })),
  );
  if (doc.content.mode !== 'slide') throw new Error();
  doc.content.slides.forEach((s, i) => {
    setText(s, 0, `Title ${i}`);
    setText(s, 1, `Body ${i}`);
  });
  return doc;
}

describe('step 5 — component extraction', () => {
  it('AC #15: recurring 4-slide title+body → one component with 2 slots', () => {
    const doc = buildRecurringDeck(4);
    const r = runStep5(buildTestState(doc));
    const components = Object.values(r.componentLibrary);
    expect(components.length).toBeGreaterThanOrEqual(1);
    const titleBlock = components[0];
    expect(titleBlock?.body.slots.length).toBe(2);
  });

  it('AC #16: recurring on only 2 slides → no component (below threshold)', () => {
    const doc = buildRecurringDeck(2);
    const r = runStep5(buildTestState(doc));
    expect(Object.keys(r.componentLibrary).length).toBe(0);
  });
});

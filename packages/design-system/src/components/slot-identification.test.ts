// packages/design-system/src/components/slot-identification.test.ts

import type { Slide, TextElement } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import { makeDoc } from '../test-helpers.js';
import { identifySlots } from './slot-identification.js';

function slidesById(slides: Slide[]): Map<string, Slide> {
  return new Map(slides.map((s) => [s.id, s]));
}

function setText(slide: Slide | undefined, idx: number, text: string): void {
  const el = slide?.elements[idx];
  if (el && el.type === 'text') {
    (el as TextElement).text = text;
  }
}

describe('identifySlots', () => {
  it('returns slots for varying text positions', () => {
    const doc = makeDoc([{ textColors: ['#000', '#000'] }, { textColors: ['#000', '#000'] }]);
    if (doc.content.mode !== 'slide') throw new Error();
    const s0 = doc.content.slides[0];
    const s1 = doc.content.slides[1];
    setText(s0, 0, 'Title A');
    setText(s0, 1, 'Body A');
    setText(s1, 0, 'Title B');
    setText(s1, 1, 'Body B');
    if (!s0 || !s1) throw new Error();
    const grouping = {
      hash: 'abc',
      instances: [
        { slideId: 's1', elementIds: s0.elements.map((e) => e.id) },
        { slideId: 's2', elementIds: s1.elements.map((e) => e.id) },
      ],
    };
    const result = identifySlots(grouping, slidesById(doc.content.slides));
    expect(result).not.toBeNull();
    expect(result?.slots.length).toBe(2);
  });

  it('returns null when an instance references a missing slide', () => {
    const grouping = {
      hash: 'h',
      instances: [{ slideId: 'missing', elementIds: ['e0'] }],
    };
    const result = identifySlots(grouping, slidesById([]));
    expect(result).toBeNull();
  });

  it('returns null for empty instances', () => {
    const result = identifySlots({ hash: 'h', instances: [] }, slidesById([]));
    expect(result).toBeNull();
  });

  it('returns null when an element id does not exist on the slide', () => {
    const doc = makeDoc([{ textColors: ['#000'] }]);
    if (doc.content.mode !== 'slide') throw new Error();
    const grouping = {
      hash: 'h',
      instances: [{ slideId: 's1', elementIds: ['nonexistent'] }],
    };
    const result = identifySlots(grouping, slidesById(doc.content.slides));
    expect(result).toBeNull();
  });

  it('returns null when element types differ at the same position', () => {
    const doc = makeDoc([{ textColors: ['#000'] }, { fills: ['#ff0000'] }]);
    if (doc.content.mode !== 'slide') throw new Error();
    const s0 = doc.content.slides[0];
    const s1 = doc.content.slides[1];
    if (!s0 || !s1) throw new Error();
    const grouping = {
      hash: 'h',
      instances: [
        { slideId: 's1', elementIds: s0.elements.map((e) => e.id) },
        { slideId: 's2', elementIds: s1.elements.map((e) => e.id) },
      ],
    };
    const result = identifySlots(grouping, slidesById(doc.content.slides));
    expect(result).toBeNull();
  });

  it('returns null for inconsistent element counts', () => {
    const doc = makeDoc([{ textColors: ['#000', '#000'] }, { textColors: ['#000'] }]);
    if (doc.content.mode !== 'slide') throw new Error();
    const s0 = doc.content.slides[0];
    const s1 = doc.content.slides[1];
    if (!s0 || !s1) throw new Error();
    const grouping = {
      hash: 'abc',
      instances: [
        { slideId: 's1', elementIds: s0.elements.map((e) => e.id) },
        { slideId: 's2', elementIds: s1.elements.map((e) => e.id) },
      ],
    };
    const result = identifySlots(grouping, slidesById(doc.content.slides));
    expect(result).toBeNull();
  });
});

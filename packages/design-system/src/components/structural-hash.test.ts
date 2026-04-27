// packages/design-system/src/components/structural-hash.test.ts

import type { Slide } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import { makeDoc } from '../test-helpers.js';
import { generateSubgroups, hashSlide } from './structural-hash.js';

function firstSlide(doc: ReturnType<typeof makeDoc>): Slide {
  if (doc.content.mode !== 'slide') throw new Error('want slide mode');
  const s = doc.content.slides[0];
  if (!s) throw new Error('no first slide');
  return s;
}

describe('structural-hash', () => {
  it('two slides with the same element-type pattern hash identically', () => {
    const a = firstSlide(
      makeDoc([
        {
          fills: ['#ff0000'],
          textColors: ['#000000'],
          positions: [
            { x: 0, y: 0, width: 200, height: 100 },
            { x: 0, y: 100, width: 200, height: 50 },
          ],
        },
      ]),
    );
    const b = firstSlide(
      makeDoc([
        {
          fills: ['#00ff00'],
          textColors: ['#0000ff'],
          positions: [
            { x: 100, y: 200, width: 200, height: 100 },
            { x: 100, y: 300, width: 200, height: 50 },
          ],
        },
      ]),
    );
    expect(hashSlide(a)).toBe(hashSlide(b));
  });

  it('different element types produce different hashes', () => {
    const a = firstSlide(makeDoc([{ fills: ['#ff0000'], textColors: ['#000000'] }]));
    const b = firstSlide(makeDoc([{ fills: ['#ff0000', '#00ff00'] }]));
    expect(hashSlide(a)).not.toBe(hashSlide(b));
  });

  it('generateSubgroups produces stable hashes per group', () => {
    const slide = firstSlide(
      makeDoc([
        {
          fills: ['#ff0000'],
          textColors: ['#000000'],
          positions: [
            { x: 0, y: 0, width: 200, height: 100 },
            { x: 0, y: 100, width: 200, height: 50 },
          ],
        },
      ]),
    );
    const subs = generateSubgroups(slide);
    expect(subs.length).toBeGreaterThan(0);
    expect(subs[0]?.hash).toMatch(/^[0-9a-f]{16}$/);
  });
});

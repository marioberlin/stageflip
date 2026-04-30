// packages/runtimes/interactive/src/clips/voice/static-fallback.test.ts
// T-388 ACs #4–#9 — `defaultVoiceStaticFallback` generator behaviour:
//   - byte-for-byte determinism across calls (AC #4)
//   - silhouetteSeed variation (AC #5)
//   - data:image/svg+xml URL shape (AC #6)
//   - posterText present/absent → TextElement present/absent (AC #7)
//   - bounding box matches supplied dimensions (AC #8)
//   - text element centred over the image (AC #9)

import { describe, expect, it } from 'vitest';

import { defaultVoiceStaticFallback } from './static-fallback.js';

describe('defaultVoiceStaticFallback (T-388)', () => {
  it('AC #4 — same args → byte-for-byte identical Element[] across two calls', () => {
    const a = defaultVoiceStaticFallback({ width: 640, height: 360 });
    const b = defaultVoiceStaticFallback({ width: 640, height: 360 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('AC #4 — same args (with posterText + seed) → byte-for-byte identical', () => {
    const a = defaultVoiceStaticFallback({
      width: 800,
      height: 450,
      posterText: 'Tap to speak',
      silhouetteSeed: 7,
    });
    const b = defaultVoiceStaticFallback({
      width: 800,
      height: 450,
      posterText: 'Tap to speak',
      silhouetteSeed: 7,
    });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('AC #5 — different silhouetteSeed → different SVG markup', () => {
    const a = defaultVoiceStaticFallback({
      width: 640,
      height: 360,
      silhouetteSeed: 1,
    });
    const b = defaultVoiceStaticFallback({
      width: 640,
      height: 360,
      silhouetteSeed: 2,
    });
    const aImage = a.find((e) => e.type === 'image');
    const bImage = b.find((e) => e.type === 'image');
    if (!aImage || aImage.type !== 'image') throw new Error('expected image element');
    if (!bImage || bImage.type !== 'image') throw new Error('expected image element');
    expect(aImage.src).not.toBe(bImage.src);
  });

  it('AC #6 — ImageElement src is a data:image/svg+xml URL', () => {
    const elements = defaultVoiceStaticFallback({ width: 640, height: 360 });
    const image = elements.find((e) => e.type === 'image');
    if (!image || image.type !== 'image') throw new Error('expected image element');
    expect(image.src.startsWith('data:image/svg+xml,')).toBe(true);
  });

  it('AC #7 — posterText present → TextElement appended; text matches', () => {
    const elements = defaultVoiceStaticFallback({
      width: 640,
      height: 360,
      posterText: 'Tap to speak',
    });
    const text = elements.find((e) => e.type === 'text');
    if (!text || text.type !== 'text') throw new Error('expected text element');
    expect(text.text).toBe('Tap to speak');
  });

  it('AC #7 — posterText absent → no TextElement in array', () => {
    const elements = defaultVoiceStaticFallback({ width: 640, height: 360 });
    expect(elements.find((e) => e.type === 'text')).toBeUndefined();
    // Image-only — exactly one element.
    expect(elements).toHaveLength(1);
  });

  it('AC #8 — image transform width/height match supplied dimensions', () => {
    const elements = defaultVoiceStaticFallback({ width: 800, height: 450 });
    const image = elements.find((e) => e.type === 'image');
    if (!image || image.type !== 'image') throw new Error('expected image element');
    expect(image.transform.width).toBe(800);
    expect(image.transform.height).toBe(450);
    expect(image.transform.x).toBe(0);
    expect(image.transform.y).toBe(0);
  });

  it('AC #9 — text element centred horizontally over the image (±1 px tolerance)', () => {
    const elements = defaultVoiceStaticFallback({
      width: 800,
      height: 450,
      posterText: 'centre me',
    });
    const image = elements.find((e) => e.type === 'image');
    const text = elements.find((e) => e.type === 'text');
    if (!image || image.type !== 'image') throw new Error('expected image element');
    if (!text || text.type !== 'text') throw new Error('expected text element');
    const imageCentre = image.transform.x + image.transform.width / 2;
    const textCentre = text.transform.x + text.transform.width / 2;
    expect(Math.abs(textCentre - imageCentre)).toBeLessThanOrEqual(1);
  });

  it('AC #9 — text element centred vertically over the image (±1 px tolerance)', () => {
    const elements = defaultVoiceStaticFallback({
      width: 640,
      height: 360,
      posterText: 'centre me',
    });
    const image = elements.find((e) => e.type === 'image');
    const text = elements.find((e) => e.type === 'text');
    if (!image || image.type !== 'image') throw new Error('expected image element');
    if (!text || text.type !== 'text') throw new Error('expected text element');
    const imageCentre = image.transform.y + image.transform.height / 2;
    const textCentre = text.transform.y + text.transform.height / 2;
    expect(Math.abs(textCentre - imageCentre)).toBeLessThanOrEqual(1);
  });

  it('returns an Element[] with at least one ImageElement', () => {
    const elements = defaultVoiceStaticFallback({ width: 100, height: 100 });
    expect(elements.length).toBeGreaterThanOrEqual(1);
    expect(elements[0]?.type).toBe('image');
  });

  it('SVG markup encodes the bar grid (32 bars by construction, plus background rect)', () => {
    const elements = defaultVoiceStaticFallback({ width: 640, height: 360 });
    const image = elements.find((e) => e.type === 'image');
    if (!image || image.type !== 'image') throw new Error('expected image element');
    // Decode the data URL — count `<rect ` occurrences. Default grid is 32
    // bar rects plus one background rect = 33.
    const decoded = decodeURIComponent(image.src.replace(/^data:image\/svg\+xml,/, ''));
    const rectCount = (decoded.match(/<rect /g) ?? []).length;
    expect(rectCount).toBe(33);
  });

  it('SVG dimensions encode the supplied width/height', () => {
    const elements = defaultVoiceStaticFallback({ width: 1024, height: 768 });
    const image = elements.find((e) => e.type === 'image');
    if (!image || image.type !== 'image') throw new Error('expected image element');
    const decoded = decodeURIComponent(image.src.replace(/^data:image\/svg\+xml,/, ''));
    expect(decoded).toContain('width="1024"');
    expect(decoded).toContain('height="768"');
  });

  it('default silhouetteSeed (0) produces a stable image src (regression pin)', () => {
    const elements = defaultVoiceStaticFallback({ width: 320, height: 180 });
    const image = elements.find((e) => e.type === 'image');
    if (!image || image.type !== 'image') throw new Error('expected image element');
    // The src is fully derived from (width, height, seed=0). Pin one byte-
    // identical sample so any accidental algorithmic drift surfaces here.
    expect(image.src).toMatchSnapshot();
  });
});

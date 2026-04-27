// packages/import-hyperframes-html/src/elements/shared.test.ts
// Unit tests for the element transform extraction. Pin AC #17–#22 at the
// transform-extraction level here; integration via parseHyperframes is
// covered by parseHyperframes.test.ts.

import { parseFragment } from 'parse5';
import { describe, expect, it } from 'vitest';
import { allElements } from '../dom/walk.js';
import { extractTransform, hasClassStyleLoss, hasGsapTimeline } from './shared.js';

function firstElement(html: string) {
  const frag = parseFragment(html);
  for (const el of allElements(frag)) return el;
  throw new Error('no element parsed');
}

describe('extractTransform', () => {
  it('AC #17 + #18: left/top/width/height map to x/y/width/height', () => {
    const el = firstElement(
      '<div style="left: 540px; top: 1360px; width: 200px; height: 100px"></div>',
    );
    const out = extractTransform(el, {
      gsapContext: false,
      fallbackWidth: 1080,
      fallbackHeight: 1920,
    });
    expect(out.transform.x).toBe(540);
    expect(out.transform.y).toBe(1360);
    expect(out.transform.width).toBe(200);
    expect(out.transform.height).toBe(100);
    expect(out.dimensionsInferred).toBe(false);
  });

  it('AC #19: center-anchor (translate(-50%, -50%)) converts to top-left math', () => {
    const el = firstElement(
      '<div style="left: 540px; top: 1360px; width: 200px; height: 100px; transform: translate(-50%, -50%)"></div>',
    );
    const out = extractTransform(el, {
      gsapContext: false,
      fallbackWidth: 1080,
      fallbackHeight: 1920,
    });
    expect(out.transform.x).toBe(440);
    expect(out.transform.y).toBe(1310);
    expect(out.transform.width).toBe(200);
    expect(out.transform.height).toBe(100);
  });

  it('AC #20: scale != 1 sets scaleDropped (canonical transform retains absolute size)', () => {
    const el = firstElement(
      '<div style="left: 100px; top: 100px; width: 200px; height: 100px; transform: scale(0)"></div>',
    );
    const out = extractTransform(el, {
      gsapContext: false,
      fallbackWidth: 1080,
      fallbackHeight: 1920,
    });
    expect(out.scaleDropped).toBe(true);
    expect(out.transform.width).toBe(200);
    expect(out.transform.height).toBe(100);
  });

  it('AC #20a: rotate(45deg) maps to transform.rotation = 45', () => {
    const el = firstElement(
      '<div style="left: 0; top: 0; width: 100px; height: 100px; transform: rotate(45deg)"></div>',
    );
    const out = extractTransform(el, {
      gsapContext: false,
      fallbackWidth: 1080,
      fallbackHeight: 1920,
    });
    expect(out.transform.rotation).toBe(45);
  });

  it('AC #21: missing width/height => dimensionsInferred = true', () => {
    const el = firstElement('<div style="left: 0; top: 0">hi</div>');
    const out = extractTransform(el, {
      gsapContext: false,
      fallbackWidth: 1080,
      fallbackHeight: 1920,
    });
    expect(out.dimensionsInferred).toBe(true);
    expect(out.transform.width).toBe(1080);
    expect(out.transform.height).toBe(1920);
  });

  it('AC #22: opacity:0 + GSAP context => opacityNormalized; opacity becomes 1', () => {
    const el = firstElement(
      '<div style="left: 0; top: 0; width: 100px; height: 100px; opacity: 0"></div>',
    );
    const out = extractTransform(el, {
      gsapContext: true,
      fallbackWidth: 1080,
      fallbackHeight: 1920,
    });
    expect(out.opacityNormalized).toBe(true);
    expect(out.transform.opacity).toBe(1);
  });

  it('opacity 0.5 (no GSAP) is preserved', () => {
    const el = firstElement(
      '<div style="left: 0; top: 0; width: 100px; height: 100px; opacity: 0.5"></div>',
    );
    const out = extractTransform(el, {
      gsapContext: false,
      fallbackWidth: 1080,
      fallbackHeight: 1920,
    });
    expect(out.transform.opacity).toBe(0.5);
    expect(out.opacityNormalized).toBe(false);
  });
});

describe('hasClassStyleLoss', () => {
  it('AC #23: class-styled element with no inline typography props => true', () => {
    const el = firstElement('<div class="stat-text blue-text" style="left: 0; top: 0"></div>');
    expect(hasClassStyleLoss(el)).toBe(true);
  });

  it('class-styled element with inline color/font-size => false (typography preserved)', () => {
    const el = firstElement('<div class="stat-text" style="color: #fff; font-size: 60px"></div>');
    expect(hasClassStyleLoss(el)).toBe(false);
  });

  it('no class attribute => false', () => {
    const el = firstElement('<div style="left: 0"></div>');
    expect(hasClassStyleLoss(el)).toBe(false);
  });

  it('empty class attribute => false', () => {
    const el = firstElement('<div class="" style="left: 0"></div>');
    expect(hasClassStyleLoss(el)).toBe(false);
  });
});

describe('hasGsapTimeline', () => {
  it('detects gsap.timeline()', () => {
    expect(hasGsapTimeline('const tl = gsap.timeline({});')).toBe(true);
    expect(hasGsapTimeline('gsap . timeline ( )')).toBe(true);
  });

  it('returns false for unrelated scripts', () => {
    expect(hasGsapTimeline('console.log("hi")')).toBe(false);
  });
});

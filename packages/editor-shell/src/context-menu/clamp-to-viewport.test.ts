// packages/editor-shell/src/context-menu/clamp-to-viewport.test.ts

import { describe, expect, it } from 'vitest';
import { clampToViewport } from './context-menu';

describe('clampToViewport', () => {
  it('returns the requested origin when the menu fits', () => {
    expect(clampToViewport(100, 200, 180, 240, 1280, 720)).toEqual({ x: 100, y: 200 });
  });

  it('flips to the left when the menu would overflow the right edge', () => {
    // Menu (180 wide) at x=1200 in a 1280-wide viewport → right edge 1380.
    // Expected: x = 1280 - 180 - 4 = 1096.
    expect(clampToViewport(1200, 100, 180, 240, 1280, 720)).toEqual({ x: 1096, y: 100 });
  });

  it('flips up when the menu would overflow the bottom edge', () => {
    // Menu (240 tall) at y=600 in 720 viewport → bottom 840. Expected: y=476.
    expect(clampToViewport(100, 600, 180, 240, 1280, 720)).toEqual({ x: 100, y: 476 });
  });

  it('clamps both axes at the same time for bottom-right corner clicks', () => {
    const out = clampToViewport(1270, 715, 180, 240, 1280, 720);
    expect(out.x).toBe(1096);
    expect(out.y).toBe(476);
  });

  it('never produces a negative origin (small viewport fallback)', () => {
    const out = clampToViewport(50, 50, 1000, 1000, 400, 400);
    expect(out.x).toBeGreaterThanOrEqual(0);
    expect(out.y).toBeGreaterThanOrEqual(0);
  });

  it('leaves the origin alone when dimensions are not yet measured', () => {
    expect(clampToViewport(9999, 9999, 0, 0, 1280, 720)).toEqual({ x: 9999, y: 9999 });
  });
});

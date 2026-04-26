// packages/import-google-slides/src/geometry/affine.test.ts
// Pin AC #6 (composeAffines) and AC #7 (emuToPx) plus axis-aligned bbox
// derivation for the slide canvas.

import { describe, expect, it } from 'vitest';
import {
  type Affine2x3,
  IDENTITY,
  applyAffineToUnitSquare,
  composeAffines,
  emuToPx,
  fromApi,
} from './affine.js';

describe('composeAffines (AC #6)', () => {
  it('child translateX=100 inside parent {translateX=200, scaleX=2} → world translateX = 400', () => {
    const parent: Affine2x3 = { ...IDENTITY, translateX: 200, scaleX: 2 };
    const child: Affine2x3 = { ...IDENTITY, translateX: 100 };
    const composed = composeAffines(parent, child);
    expect(composed.translateX).toBe(400);
    expect(composed.scaleX).toBe(2);
    expect(composed.translateY).toBe(0);
  });

  it('IDENTITY is the right neutral element: compose(P, IDENTITY) === P', () => {
    const P: Affine2x3 = {
      scaleX: 2,
      scaleY: 3,
      shearX: 0.1,
      shearY: 0.2,
      translateX: 5,
      translateY: 7,
    };
    expect(composeAffines(P, IDENTITY)).toEqual(P);
  });

  it('IDENTITY is the left neutral element: compose(IDENTITY, C) === C', () => {
    const C: Affine2x3 = {
      scaleX: 2,
      scaleY: 3,
      shearX: 0.1,
      shearY: 0.2,
      translateX: 5,
      translateY: 7,
    };
    expect(composeAffines(IDENTITY, C)).toEqual(C);
  });

  it('preserves scale composition: compose({scaleX=2}, {scaleX=3}) → scaleX=6', () => {
    const composed = composeAffines({ ...IDENTITY, scaleX: 2 }, { ...IDENTITY, scaleX: 3 });
    expect(composed.scaleX).toBe(6);
  });

  it('non-commutative: compose(A,B) !== compose(B,A) for translation+scale', () => {
    const A: Affine2x3 = { ...IDENTITY, translateX: 100 };
    const B: Affine2x3 = { ...IDENTITY, scaleX: 2 };
    const ab = composeAffines(A, B);
    const ba = composeAffines(B, A);
    expect(ab.translateX).toBe(100);
    expect(ba.translateX).toBe(200);
  });
});

describe('fromApi', () => {
  it('fills missing fields with identity defaults', () => {
    expect(fromApi({})).toEqual(IDENTITY);
    expect(fromApi(undefined)).toEqual(IDENTITY);
  });

  it('preserves provided fields', () => {
    expect(fromApi({ scaleX: 2, translateX: 5 })).toEqual({
      ...IDENTITY,
      scaleX: 2,
      translateX: 5,
    });
  });
});

describe('emuToPx (AC #7)', () => {
  it('default 16:9 page (9144000 × 5143500 EMU) at 1600×900 → ~0.0001749 per axis', () => {
    const ratio = emuToPx({
      pageSizeEmu: { width: 9144000, height: 5143500 },
      renderSize: { width: 1600, height: 900 },
    });
    expect(ratio.x).toBeCloseTo(1600 / 9144000, 12);
    expect(ratio.y).toBeCloseTo(900 / 5143500, 12);
    expect(Math.abs(ratio.x - 0.0001749) < 1e-7).toBe(true);
    expect(Math.abs(ratio.y - 0.0001749) < 1e-7).toBe(true);
  });

  it('returns per-axis distinct factors for non-uniform scaling', () => {
    const ratio = emuToPx({
      pageSizeEmu: { width: 1000, height: 500 },
      renderSize: { width: 100, height: 200 },
    });
    expect(ratio.x).toBe(0.1);
    expect(ratio.y).toBe(0.4);
  });
});

describe('applyAffineToUnitSquare', () => {
  it('identity transform on a 100×50 EMU box at unit emuPerPx → bbox (0,0,100,50)', () => {
    const bbox = applyAffineToUnitSquare({
      worldTransform: IDENTITY,
      sizeEmu: { width: 100, height: 50 },
      emuPerPx: { x: 1, y: 1 },
    });
    expect(bbox).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });

  it('translates and scales correctly through emuPerPx', () => {
    const bbox = applyAffineToUnitSquare({
      worldTransform: { ...IDENTITY, translateX: 1000, translateY: 500 },
      sizeEmu: { width: 200, height: 100 },
      emuPerPx: { x: 0.1, y: 0.2 },
    });
    expect(bbox).toEqual({ x: 100, y: 100, width: 20, height: 20 });
  });
});

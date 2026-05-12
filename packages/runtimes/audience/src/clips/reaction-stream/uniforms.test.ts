// packages/runtimes/audience/src/clips/reaction-stream/uniforms.test.ts
// T-470 — Tests for the pure `computeReactionStreamUniforms` helper.
// Verifies:
//   - byte-identical `uDensities.buffer` for identical inputs (the
//     determinism perimeter — primary §13 evidence for T-470);
//   - missing palette entries (emojiCounts row absent) → density 0;
//   - density saturates at recentBurst ≥ 10 (clamp to 1);
//   - density clamps to 0 for negative recentBurst (defensive);
//   - empty palette → empty `uDensities` + `uPaletteSize: 0`;
//   - `uTime = localFrame / fps` (deterministic seconds);
//   - `uTotalReactions` = sum of `count` across emojiCounts.

import { describe, expect, it } from 'vitest';

import { computeReactionStreamUniforms } from './uniforms.js';

const PALETTE = [
  { emojiId: 'heart', glyph: '❤️' },
  { emojiId: 'thumbs-up', glyph: '👍' },
  { emojiId: 'fire', glyph: '🔥' },
];

const COUNTS = [
  { emojiId: 'heart', count: 42, recentBurst: 8 },
  { emojiId: 'thumbs-up', count: 35, recentBurst: 5 },
  { emojiId: 'fire', count: 17, recentBurst: 12 },
];

describe('computeReactionStreamUniforms', () => {
  it('produces a Float32Array of length === palette.length', () => {
    const out = computeReactionStreamUniforms(COUNTS, PALETTE, 0, 30);
    expect(out.uDensities).toBeInstanceOf(Float32Array);
    expect(out.uDensities.length).toBe(3);
    expect(out.uPaletteSize).toBe(3);
  });

  it('is deterministic — same input bytes → bit-identical uDensities.buffer', () => {
    const a = computeReactionStreamUniforms(COUNTS, PALETTE, 0, 30);
    const b = computeReactionStreamUniforms(COUNTS, PALETTE, 0, 30);
    expect(a.uDensities.length).toBe(b.uDensities.length);
    let identical = true;
    for (let i = 0; i < a.uDensities.length; i += 1) {
      if (a.uDensities[i] !== b.uDensities[i]) {
        identical = false;
        break;
      }
    }
    expect(identical).toBe(true);
    // Byte-buffer equality via DataView comparison.
    const va = new Uint8Array(a.uDensities.buffer);
    const vb = new Uint8Array(b.uDensities.buffer);
    expect(va.length).toBe(vb.length);
    for (let i = 0; i < va.length; i += 1) {
      expect(va[i]).toBe(vb[i]);
    }
  });

  it('maps recentBurst / 10 to density [0, 1] (mid range)', () => {
    const out = computeReactionStreamUniforms(COUNTS, PALETTE, 0, 30);
    expect(out.uDensities[0]).toBeCloseTo(0.8, 5);
    expect(out.uDensities[1]).toBeCloseTo(0.5, 5);
    // recentBurst > 10 clamps to 1.
    expect(out.uDensities[2]).toBe(1);
  });

  it('clamps density to 1 when recentBurst exceeds the cap', () => {
    const out = computeReactionStreamUniforms(
      [{ emojiId: 'heart', count: 100, recentBurst: 50 }],
      [{ emojiId: 'heart', glyph: '❤️' }],
      0,
      30,
    );
    expect(out.uDensities[0]).toBe(1);
  });

  it('clamps density to 0 for negative recentBurst (defensive)', () => {
    const out = computeReactionStreamUniforms(
      [{ emojiId: 'heart', count: 0, recentBurst: -5 }],
      [{ emojiId: 'heart', glyph: '❤️' }],
      0,
      30,
    );
    expect(out.uDensities[0]).toBe(0);
  });

  it('returns density 0 for a palette entry without a matching emojiCounts row', () => {
    const out = computeReactionStreamUniforms(
      [{ emojiId: 'heart', count: 10, recentBurst: 7 }],
      [
        { emojiId: 'heart', glyph: '❤️' },
        { emojiId: 'thumbs-up', glyph: '👍' },
      ],
      0,
      30,
    );
    expect(out.uDensities[0]).toBeCloseTo(0.7, 5);
    expect(out.uDensities[1]).toBe(0);
  });

  it('handles an empty palette without throwing', () => {
    const out = computeReactionStreamUniforms(COUNTS, [], 0, 30);
    expect(out.uDensities.length).toBe(0);
    expect(out.uPaletteSize).toBe(0);
    expect(out.uTotalReactions).toBe(42 + 35 + 17);
  });

  it('handles an empty emojiCounts array — all densities zero', () => {
    const out = computeReactionStreamUniforms([], PALETTE, 0, 30);
    for (let i = 0; i < out.uDensities.length; i += 1) {
      expect(out.uDensities[i]).toBe(0);
    }
    expect(out.uTotalReactions).toBe(0);
  });

  it('computes uTime = localFrame / fps in seconds', () => {
    expect(computeReactionStreamUniforms([], [], 0, 30).uTime).toBe(0);
    expect(computeReactionStreamUniforms([], [], 30, 30).uTime).toBe(1);
    expect(computeReactionStreamUniforms([], [], 15, 30).uTime).toBe(0.5);
    expect(computeReactionStreamUniforms([], [], 60, 60).uTime).toBe(1);
  });

  it('guards against fps <= 0 (defensive — uTime stays finite)', () => {
    const out = computeReactionStreamUniforms([], [], 30, 0);
    expect(Number.isFinite(out.uTime)).toBe(true);
  });

  it('sums uTotalReactions across emojiCounts', () => {
    const out = computeReactionStreamUniforms(COUNTS, PALETTE, 0, 30);
    expect(out.uTotalReactions).toBe(42 + 35 + 17);
  });

  it('uTime varies with localFrame across two calls (frame-scheduled animation hook)', () => {
    const at0 = computeReactionStreamUniforms(COUNTS, PALETTE, 0, 30);
    const at30 = computeReactionStreamUniforms(COUNTS, PALETTE, 30, 30);
    expect(at0.uTime).toBe(0);
    expect(at30.uTime).toBe(1);
    // densities + totalReactions invariant across frames (snapshot pinned).
    const a0 = new Uint8Array(at0.uDensities.buffer);
    const a30 = new Uint8Array(at30.uDensities.buffer);
    for (let i = 0; i < a0.length; i += 1) {
      expect(a0[i]).toBe(a30[i]);
    }
    expect(at0.uTotalReactions).toBe(at30.uTotalReactions);
  });
});

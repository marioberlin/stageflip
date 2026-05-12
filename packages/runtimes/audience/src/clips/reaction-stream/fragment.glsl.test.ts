// packages/runtimes/audience/src/clips/reaction-stream/fragment.glsl.test.ts
// T-470 — Verifies the ReactionStream fragment shader source. The shader
// MUST:
//   - declare an explicit float precision (T-065 invariant);
//   - pass `validateFragmentShader` from `@stageflip/runtimes-shader`;
//   - use compile-time constant loop bounds (GLSL ES 1.0 requirement);
//   - keep `REACTION_STREAM_MAX_PALETTE` in sync with the schema cap.

import { validateFragmentShader } from '@stageflip/runtimes-shader';
import { describe, expect, it } from 'vitest';

import {
  REACTION_STREAM_FRAGMENT,
  REACTION_STREAM_MAX_PALETTE,
  REACTION_STREAM_PARTICLES_PER_EMOJI,
} from './fragment.glsl.js';

describe('REACTION_STREAM_FRAGMENT', () => {
  it('is a non-empty string', () => {
    expect(typeof REACTION_STREAM_FRAGMENT).toBe('string');
    expect(REACTION_STREAM_FRAGMENT.length).toBeGreaterThan(0);
  });

  it('declares explicit `precision highp float;` per T-065', () => {
    expect(REACTION_STREAM_FRAGMENT).toMatch(/\bprecision\s+highp\s+float\s*;/);
  });

  it('passes validateFragmentShader (T-065 explicit-precision gate)', () => {
    expect(() => validateFragmentShader(REACTION_STREAM_FRAGMENT, 'reaction-stream')).not.toThrow();
  });

  it('declares the expected uniform names', () => {
    expect(REACTION_STREAM_FRAGMENT).toMatch(/uniform\s+float\s+uTime\s*;/);
    expect(REACTION_STREAM_FRAGMENT).toMatch(/uniform\s+float\s+uDensities\[12\]\s*;/);
    expect(REACTION_STREAM_FRAGMENT).toMatch(/uniform\s+float\s+uPaletteSize\s*;/);
    expect(REACTION_STREAM_FRAGMENT).toMatch(/uniform\s+float\s+uTotalReactions\s*;/);
  });

  it('uses compile-time constant loop bounds (GLSL ES 1.0)', () => {
    // Outer loop: `for (int i = 0; i < 12; i++)`. Inner loop: `j < 10`.
    expect(REACTION_STREAM_FRAGMENT).toMatch(/for\s*\(\s*int\s+i\s*=\s*0\s*;\s*i\s*<\s*12\s*;/);
    expect(REACTION_STREAM_FRAGMENT).toMatch(/for\s*\(\s*int\s+j\s*=\s*0\s*;\s*j\s*<\s*10\s*;/);
  });

  it('REACTION_STREAM_MAX_PALETTE matches the loop bound in the shader', () => {
    expect(REACTION_STREAM_MAX_PALETTE).toBe(12);
  });

  it('REACTION_STREAM_PARTICLES_PER_EMOJI matches the inner loop bound', () => {
    expect(REACTION_STREAM_PARTICLES_PER_EMOJI).toBe(10);
  });

  it('avoids non-deterministic GLSL — no `noise()` builtin reference', () => {
    // The `noise1/2/3/4` GLSL builtins are implementation-defined and
    // implementations are free to return 0. We never call them.
    expect(REACTION_STREAM_FRAGMENT).not.toMatch(/\bnoise[1-4]\s*\(/);
  });
});

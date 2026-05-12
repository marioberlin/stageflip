// packages/runtimes/audience/src/clips/reaction-stream/fragment.glsl.ts
// T-470 — Fragment shader source for the ReactionStream clip. Rendered
// via the T-383 `<ShaderClipHost>` against a fullscreen-quad vertex
// shader the host supplies. Inlined as a TypeScript string for easier
// distribution + a tighter loop for the explicit-precision check
// (T-065) — the host validates this at define / mount time via
// `validateFragmentShader`.
//
// Visual posture (v1):
//   - For each palette entry `i ∈ [0, uPaletteSize)`, emit up to 10
//     coloured circular particles whose density scales with
//     `uDensities[i]`.
//   - Particles orbit the canvas centre on per-particle phase offsets so
//     adjacent emoji clouds remain distinguishable.
//   - Per-emoji colour derives deterministically from the palette index
//     (no texture lookups — texture upload is OUT OF SCOPE per T-470 §spec).
//
// Determinism (T-065 + CLAUDE.md §3):
//   - `precision highp float;` at the top — required by the
//     `validateFragmentShader` gate; implicit precision causes
//     cross-device drift.
//   - All loops use compile-time constant bounds (GLSL ES 1.0
//     requirement) — break when the dynamic index exceeds `uPaletteSize`
//     / `density * 10.0`.
//   - No `mod(_, randomness)` and no time-dependent hash; the only
//     mutable axis is `uTime`, which is itself a deterministic function
//     of `localFrame / fps`.

/**
 * Maximum palette entries the shader iterates over. Bounded by the
 * schema (palette.max(12)) so the compile-time constant loop bound is
 * sound. Surfaced as an exported constant so the schema-side test can
 * assert the two bounds stay in sync.
 */
export const REACTION_STREAM_MAX_PALETTE = 12;

/**
 * Particles-per-emoji upper bound. Each emoji is drawn as up to 10
 * coloured circles whose visibility scales with the per-emoji density.
 */
export const REACTION_STREAM_PARTICLES_PER_EMOJI = 10;

/**
 * GLSL ES 1.0 fragment shader source for the ReactionStream clip.
 * Validated at `defineShaderClip` / mount time via
 * `validateFragmentShader` from `@stageflip/runtimes-shader`. Authors
 * must NOT remove the `precision highp float;` declaration at the top —
 * implicit precision is rejected by the T-065 invariant.
 */
export const REACTION_STREAM_FRAGMENT = `
precision highp float;

uniform float uTime;
uniform float uDensities[12];
uniform float uPaletteSize;
uniform float uTotalReactions;

varying vec2 v_uv;

void main() {
  vec3 col = vec3(0.0);
  float t = uTime;
  for (int i = 0; i < 12; i++) {
    if (float(i) >= uPaletteSize) break;
    float density = uDensities[i];
    for (int j = 0; j < 10; j++) {
      if (float(j) >= density * 10.0) break;
      float particleId = float(i * 10 + j);
      float angle = particleId * 2.4 + t * 0.3;
      float radius = 0.35 + 0.05 * sin(particleId * 1.7 + t * 0.4);
      vec2 pos = vec2(0.5 + radius * cos(angle), 0.5 + radius * sin(angle * 1.3));
      float d = distance(v_uv, pos);
      vec3 emojiColor = vec3(
        0.5 + 0.5 * sin(float(i) * 1.7),
        0.5 + 0.5 * cos(float(i) * 2.3),
        0.5 + 0.5 * sin(float(i) * 3.1 + 1.5)
      );
      col += emojiColor * smoothstep(0.05, 0.0, d);
    }
  }
  gl_FragColor = vec4(col, 1.0);
}
`.trim();

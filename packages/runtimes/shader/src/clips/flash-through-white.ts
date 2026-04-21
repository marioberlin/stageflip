// packages/runtimes/shader/src/clips/flash-through-white.ts
// Demo: full-screen white flash crossing the midpoint. Scanned by
// check-determinism — no wall-clock APIs; motion is parameterised by the
// u_progress uniform fed by the host from the FrameClock.

import { defineShaderClip } from '../index.js';

const FRAGMENT = `
precision highp float;
varying vec2 v_uv;
uniform float u_progress;

void main() {
  // Triangular pulse peaking at progress=0.5.
  float flash = smoothstep(0.35, 0.5, u_progress) - smoothstep(0.5, 0.65, u_progress);
  vec3 background = vec3(0.04, 0.05, 0.08);
  vec3 color = mix(background, vec3(1.0), flash);
  gl_FragColor = vec4(color, 1.0);
}
`.trim();

/** Demo clip — screen flashes white around the midpoint. */
export const flashThroughWhite = defineShaderClip({
  kind: 'flash-through-white',
  fragmentShader: FRAGMENT,
});

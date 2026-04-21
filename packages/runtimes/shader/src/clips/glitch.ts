// packages/runtimes/shader/src/clips/glitch.ts
// Demo: intermittent RGB-channel displacement + scanline tearing. Scanned
// by check-determinism. The "randomness" is deterministic hash noise keyed
// on v_uv.y and u_progress — no Math.random, no wall-clock.

import { defineShaderClip } from '../index.js';

const FRAGMENT = `
precision highp float;
varying vec2 v_uv;
uniform float u_progress;

float hash(float x) {
  return fract(sin(x) * 43758.5453);
}

void main() {
  float t = u_progress;
  // Deterministic per-scanline noise keyed on y + a time-like axis.
  float noise = hash(v_uv.y * 120.0 + floor(t * 60.0));
  float glitch = step(0.85, noise) * step(0.05, t);
  float dx = glitch * (hash(floor(t * 60.0)) - 0.5) * 0.2;
  vec2 shifted = v_uv + vec2(dx, 0.0);
  vec3 color = vec3(
    mix(v_uv.x, 1.0 - shifted.x, 0.6),
    v_uv.y,
    mix(1.0 - v_uv.x, shifted.x, 0.4)
  );
  color = mix(color, vec3(1.0), glitch * 0.3);
  gl_FragColor = vec4(color, 1.0);
}
`.trim();

/** Demo clip — stochastic-looking channel shift / scanline tear. */
export const glitch = defineShaderClip({
  kind: 'glitch',
  fragmentShader: FRAGMENT,
});

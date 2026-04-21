// packages/runtimes/shader/src/clips/swirl-vortex.ts
// Demo: banded color field rotating around the canvas center. Scanned by
// check-determinism.

import { defineShaderClip } from '../index.js';

const FRAGMENT = `
precision highp float;
varying vec2 v_uv;
uniform float u_progress;

void main() {
  vec2 uv = v_uv - 0.5;
  float r = length(uv);
  float angle = u_progress * 6.2831853 + r * 10.0;
  float c = cos(angle);
  float s = sin(angle);
  vec2 rotated = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);
  float band = 0.5 + 0.5 * sin(rotated.x * 20.0);
  vec3 color = mix(vec3(0.05, 0.02, 0.10), vec3(0.00, 0.83, 1.00), band);
  color = mix(color, vec3(1.00, 0.00, 0.50), band * 0.4);
  gl_FragColor = vec4(color, 1.0);
}
`.trim();

/** Demo clip — hypnotic rotating band. */
export const swirlVortex = defineShaderClip({
  kind: 'swirl-vortex',
  fragmentShader: FRAGMENT,
});

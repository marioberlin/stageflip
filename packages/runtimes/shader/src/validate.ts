// packages/runtimes/shader/src/validate.ts
// Shader source validation. Enforces the explicit-precision rule called out
// in T-065: every fragment shader authored against this runtime must
// declare a float precision (`precision lowp|mediump|highp float;`) before
// it can be registered. Compile-time failures would be slower and
// cross-device-inconsistent; catching this at defineShaderClip time surfaces
// the mistake at author loop.

/**
 * Remove single-line `//` and multi-line `/* *\/` comments. Not a full GLSL
 * preprocessor — just enough to make the precision regex tolerant to
 * decorative comments.
 */
function stripComments(source: string): string {
  return source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

const PRECISION_RE = /\bprecision\s+(?:lowp|mediump|highp)\s+float\s*;/;

/**
 * Throw with a targeted message if `source` does not declare an explicit
 * float precision. The runtime itself does NOT prepend one on the author's
 * behalf — we surface the requirement at definition time.
 */
export function validateFragmentShader(source: string, kind: string): void {
  if (typeof source !== 'string' || source.length === 0) {
    throw new Error(
      `defineShaderClip: fragment shader for kind '${kind}' must be a non-empty string`,
    );
  }
  const stripped = stripComments(source);
  if (!PRECISION_RE.test(stripped)) {
    throw new Error(
      `defineShaderClip: fragment shader for kind '${kind}' must declare an explicit float precision (e.g., \`precision highp float;\`). Implicit precision is rejected to avoid cross-device drift.`,
    );
  }
}

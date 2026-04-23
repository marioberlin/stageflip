// packages/runtimes/shader/src/host.tsx
// Private React host for a single shader clip instance. Creates a canvas,
// obtains a WebGL context via the injected factory, compiles + links the
// user's fragment shader against a standard fullscreen-quad vertex shader,
// and re-draws on every frame change.
//
// Deterministic render: no wall-clock APIs. Uniforms come from the
// ClipRenderContext-derived fields (frame, fps, progress). The GL context
// itself is the only stateful dependency; it's created on mount and
// disposed on unmount.

import { type ReactElement, useEffect, useRef } from 'react';

import { type GlContextFactory, type UniformValue, defaultGlContextFactory } from './types.js';

/** Fullscreen-quad vertex shader — authors only supply the fragment. */
const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`.trim();

export interface ShaderClipHostProps {
  fragmentShader: string;
  /** Width of the clip canvas in CSS pixels. */
  width: number;
  /** Height of the clip canvas in CSS pixels. */
  height: number;
  /** Map of uniform name → value computed per frame by the caller. */
  uniforms: Readonly<Record<string, UniformValue>>;
  /** Test seam — swap in a stub WebGL context. */
  glContextFactory?: GlContextFactory;
}

interface GlState {
  gl: WebGL2RenderingContext | WebGLRenderingContext;
  program: WebGLProgram;
  uniformLocs: Map<string, WebGLUniformLocation | null>;
  posBuffer: WebGLBuffer | null;
}

function compileShader(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (shader === null) {
    throw new Error('shader runtime: gl.createShader returned null');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? '(no info log)';
    gl.deleteShader(shader);
    throw new Error(`shader runtime: shader compilation failed — ${info}`);
  }
  return shader;
}

function linkProgram(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  fragmentShader: string,
): WebGLProgram {
  const program = gl.createProgram();
  if (program === null) {
    throw new Error('shader runtime: gl.createProgram returned null');
  }
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? '(no info log)';
    gl.deleteProgram(program);
    throw new Error(`shader runtime: program link failed — ${info}`);
  }
  return program;
}

function setupFullscreenQuad(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  program: WebGLProgram,
): WebGLBuffer | null {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  return buffer;
}

function applyUniform(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  loc: WebGLUniformLocation | null,
  value: UniformValue,
): void {
  if (loc === null) return;
  if (typeof value === 'number') {
    gl.uniform1f(loc, value);
    return;
  }
  switch (value.length) {
    case 1:
      gl.uniform1f(loc, value[0] as number);
      return;
    case 2:
      gl.uniform2f(loc, value[0] as number, value[1] as number);
      return;
    case 3:
      gl.uniform3f(loc, value[0] as number, value[1] as number, value[2] as number);
      return;
    case 4:
      gl.uniform4f(
        loc,
        value[0] as number,
        value[1] as number,
        value[2] as number,
        value[3] as number,
      );
      return;
    default:
      throw new Error(`shader runtime: unsupported uniform length ${value.length} — expected 1..4`);
  }
}

export function ShaderClipHost({
  fragmentShader,
  width,
  height,
  uniforms,
  glContextFactory,
}: ShaderClipHostProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GlState | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    canvas.width = width;
    canvas.height = height;
    const factory = glContextFactory ?? defaultGlContextFactory;
    const gl = factory(canvas);
    if (gl === null) {
      // WebGL unavailable (happy-dom test env, disabled by user, etc.).
      // Bail silently — the canvas stays blank. Real browsers always get GL.
      return;
    }
    // Silent-fallback on compile/link failure. Authored clips validate at
    // define time so this path is reserved for the T-131d.2 user-shader
    // variant (`shader-bg`) where GLSL comes from props. A bad shader
    // leaves the canvas blank rather than crashing the surrounding deck.
    let program: WebGLProgram;
    try {
      program = linkProgram(gl, fragmentShader);
    } catch {
      return;
    }
    gl.useProgram(program);
    const posBuffer = setupFullscreenQuad(gl, program);
    stateRef.current = {
      gl,
      program,
      uniformLocs: new Map(),
      posBuffer,
    };
    return () => {
      const s = stateRef.current;
      if (s === null) return;
      if (s.posBuffer !== null) s.gl.deleteBuffer(s.posBuffer);
      s.gl.deleteProgram(s.program);
      stateRef.current = null;
    };
  }, [fragmentShader, width, height, glContextFactory]);

  useEffect(() => {
    const s = stateRef.current;
    if (s === null) return;
    const { gl, program, uniformLocs } = s;
    gl.useProgram(program);
    for (const [name, value] of Object.entries(uniforms)) {
      let loc = uniformLocs.get(name);
      if (loc === undefined) {
        loc = gl.getUniformLocation(program, name);
        uniformLocs.set(name, loc);
      }
      applyUniform(gl, loc, value);
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [uniforms, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
      data-stageflip-shader="true"
    />
  );
}

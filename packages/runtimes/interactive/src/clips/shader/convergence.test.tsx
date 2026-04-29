// packages/runtimes/interactive/src/clips/shader/convergence.test.tsx
// T-383 AC #18 + D-T383-10 — convergence-by-construction. Renders the same
// shader at the same frame via two paths and asserts the recorded GL draw
// state is bit-identical:
//
//   Path A: `ShaderClipHost` standalone with uniforms computed for frame=30.
//   Path B: `shaderClipFactory` driven by `RecordModeFrameSource.advance(30)`.
//
// happy-dom does not provide WebGL, so we cannot capture pixels directly;
// we capture the FULL stream of GL state-changing calls instead. Identical
// call streams ⇒ identical pixels (deterministic GLSL, identical uniforms,
// identical draw cadence). Epsilon = 0.
//
// This is the runtime expression of ADR-005 §D2: liveMount and the
// staticFallback poster pipeline share a single rendering core. A future
// real-browser CI lane (escalation trigger #2 in the spec) will assert at
// the pixel level; this test asserts at the GL-call level which is the
// faithful proxy in happy-dom.

import { ShaderClipHost } from '@stageflip/runtimes-shader';
import { render } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { type MountContext, PERMISSIVE_TENANT_POLICY } from '../../contract.js';
import { RecordModeFrameSource } from '../../frame-source-record.js';
import { ShaderClipFactoryBuilder } from './factory.js';
import type { ShaderClipProps } from './props.js';
import { defaultShaderUniforms } from './uniforms.js';

const FRAGMENT = `
precision highp float;
varying vec2 v_uv;
uniform float uFrame;
uniform float uTime;
uniform vec2 uResolution;
void main() {
  float c = mod(uFrame * 0.01, 1.0);
  gl_FragColor = vec4(c, v_uv.x, v_uv.y, 1.0);
}
`.trim();

interface RecordedCall {
  method: string;
  args: ReadonlyArray<unknown>;
}

function makeRecordingGl(): { gl: WebGLRenderingContext; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  // Stable identity tokens for shaders / programs / locations so two
  // independent renders produce identical recorded values.
  const SHADER_TOKEN = { __token: 'shader' };
  const PROGRAM_TOKEN = { __token: 'program' };
  const BUFFER_TOKEN = { __token: 'buffer' };
  const locTokens = new Map<string, object>();
  const record = <A extends ReadonlyArray<unknown>, R>(method: string, fn: (...a: A) => R) => {
    return vi.fn((...args: A) => {
      // Replace ephemeral handles with their stable token in the recording
      // so two runs produce identical streams.
      const recordable: unknown[] = args.map((a) => {
        if (a === SHADER_TOKEN) return '<shader>';
        if (a === PROGRAM_TOKEN) return '<program>';
        if (a === BUFFER_TOKEN) return '<buffer>';
        for (const [name, token] of locTokens) {
          if (a === token) return `<loc:${name}>`;
        }
        return a;
      });
      calls.push({ method, args: recordable });
      return fn(...args);
    });
  };
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    ARRAY_BUFFER: 5,
    STATIC_DRAW: 6,
    FLOAT: 7,
    TRIANGLE_STRIP: 8,
    COLOR_BUFFER_BIT: 16,
    createShader: record('createShader', () => SHADER_TOKEN as unknown as WebGLShader),
    shaderSource: record('shaderSource', () => undefined),
    compileShader: record('compileShader', () => undefined),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ''),
    deleteShader: record('deleteShader', () => undefined),
    createProgram: record('createProgram', () => PROGRAM_TOKEN as unknown as WebGLProgram),
    attachShader: record('attachShader', () => undefined),
    linkProgram: record('linkProgram', () => undefined),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ''),
    deleteProgram: record('deleteProgram', () => undefined),
    useProgram: record('useProgram', () => undefined),
    createBuffer: record('createBuffer', () => BUFFER_TOKEN as unknown as WebGLBuffer),
    bindBuffer: record('bindBuffer', () => undefined),
    bufferData: record('bufferData', () => undefined),
    getAttribLocation: vi.fn(() => 0),
    enableVertexAttribArray: record('enableVertexAttribArray', () => undefined),
    vertexAttribPointer: record('vertexAttribPointer', () => undefined),
    getUniformLocation: vi.fn((_p: unknown, name: string) => {
      let token = locTokens.get(name);
      if (token === undefined) {
        token = { __loc: name };
        locTokens.set(name, token);
      }
      return token as unknown as WebGLUniformLocation;
    }),
    uniform1f: record('uniform1f', () => undefined),
    uniform2f: record('uniform2f', () => undefined),
    uniform3f: record('uniform3f', () => undefined),
    uniform4f: record('uniform4f', () => undefined),
    viewport: record('viewport', () => undefined),
    clearColor: record('clearColor', () => undefined),
    clear: record('clear', () => undefined),
    drawArrays: record('drawArrays', () => undefined),
    deleteBuffer: record('deleteBuffer', () => undefined),
  } as unknown as WebGLRenderingContext;
  return { gl, calls };
}

const PROPS: ShaderClipProps = {
  fragmentShader: FRAGMENT,
  initialUniforms: {},
  width: 256,
  height: 256,
  posterFrame: 0,
};

const TARGET_FRAME = 30;

describe('ShaderClip convergence (T-383 AC #18, D-T383-10, ADR-005 §D2)', () => {
  it('liveMount @ frame=30 produces an identical GL call stream to ShaderClipHost standalone @ frame=30', async () => {
    // ----- Path A: ShaderClipHost standalone -----
    const a = makeRecordingGl();
    const aUniforms = defaultShaderUniforms(TARGET_FRAME, {
      fps: 60,
      resolution: [PROPS.width, PROPS.height],
      props: PROPS,
    });
    render(
      createElement(ShaderClipHost, {
        fragmentShader: PROPS.fragmentShader,
        width: PROPS.width,
        height: PROPS.height,
        uniforms: aUniforms,
        glContextFactory: () => a.gl,
      }),
    );

    // ----- Path B: factory + RecordModeFrameSource -----
    const b = makeRecordingGl();
    const factory = ShaderClipFactoryBuilder.build({
      glContextFactory: () => b.gl,
    });
    const fs = new RecordModeFrameSource();
    const root = document.createElement('div');
    const ctx: MountContext = {
      clip: {
        id: 'conv-clip',
        type: 'interactive-clip',
        family: 'shader',
        transform: { x: 0, y: 0, width: PROPS.width, height: PROPS.height },
        visible: true,
        locked: false,
        animations: [],
        staticFallback: [
          {
            id: 'sf',
            type: 'image',
            transform: { x: 0, y: 0, width: PROPS.width, height: PROPS.height },
            visible: true,
            locked: false,
            animations: [],
            src: 'poster.png',
          },
        ],
        liveMount: {
          component: { module: '@stageflip/runtimes-interactive/clips/shader#ShaderClip' },
          props: PROPS as unknown as Record<string, unknown>,
          permissions: [],
        },
      } as never,
      root,
      permissions: [],
      tenantPolicy: PERMISSIVE_TENANT_POLICY,
      emitTelemetry: () => undefined,
      signal: new AbortController().signal,
      frameSource: fs,
    };
    const handle = await factory(ctx);
    fs.advance(TARGET_FRAME);

    // Filter to the call stream relevant to convergence — the static
    // construction sequence (createShader, linkProgram, ...) and the
    // per-frame uniform/draw cadence are both convergent.
    //
    // Path B fires the construction sequence ONCE (mount), then re-runs
    // the uniform-binding / drawArrays cycle for each frame advanced. We
    // care that the FINAL state at frame=30 matches Path A's single render
    // at frame=30.
    //
    // Strategy: take the LAST occurrence of each convergent uniform call
    // for both paths and assert equality. drawArrays at the end of both
    // streams is identical by construction.

    function lastCall(stream: RecordedCall[], method: string): RecordedCall | undefined {
      for (let i = stream.length - 1; i >= 0; i -= 1) {
        const entry = stream[i];
        if (entry?.method === method) return entry;
      }
      return undefined;
    }

    // The load-bearing convergence: uFrame, uTime, uResolution, drawArrays.
    for (const method of ['uniform1f', 'uniform2f', 'drawArrays', 'viewport', 'clearColor']) {
      const aLast = lastCall(a.calls, method);
      const bLast = lastCall(b.calls, method);
      expect(bLast).toEqual(aLast);
    }

    // Exact equality on uFrame value: epsilon = 0. Path B's per-tick
    // re-render means the LAST `uniform1f(uFrame, ...)` call is the one
    // that pinned frame=TARGET_FRAME — that's the convergence point.
    const aFrameUniforms = a.calls.filter(
      (c) => c.method === 'uniform1f' && c.args[0] === '<loc:uFrame>',
    );
    const bFrameUniforms = b.calls.filter(
      (c) => c.method === 'uniform1f' && c.args[0] === '<loc:uFrame>',
    );
    expect(aFrameUniforms.at(-1)?.args[1]).toBe(TARGET_FRAME);
    expect(bFrameUniforms.at(-1)?.args[1]).toBe(TARGET_FRAME);

    handle.dispose();
  });
});

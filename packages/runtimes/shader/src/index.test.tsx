// packages/runtimes/shader/src/index.test.tsx
// Unit tests for the shader runtime. WebGL is NOT available in happy-dom,
// so all tests route through a glContextFactory stub — the real GL paths
// are verified by the dev harness + T-067 parity fixtures.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ClipRenderContext } from '@stageflip/runtimes-contract';

import {
  type GlContextFactory,
  type UniformValue,
  createShaderRuntime,
  defineShaderClip,
  flashThroughWhite,
  glitch,
  swirlVortex,
  validateFragmentShader,
} from './index.js';

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Minimal GL stub — each method records its calls so tests can assert on
// lifecycle + draw flow without needing an actual GPU.
// ---------------------------------------------------------------------------

interface GlCalls {
  createShader: number;
  shaderSource: Array<[unknown, string]>;
  compileShader: number;
  createProgram: number;
  attachShader: number;
  linkProgram: number;
  useProgram: number;
  createBuffer: number;
  drawArrays: Array<[number, number, number]>;
  uniform1f: Array<[string, number]>;
  uniform2f: Array<[string, number, number]>;
  viewport: Array<[number, number, number, number]>;
}

function makeGlStub(): { gl: WebGLRenderingContext; calls: GlCalls } {
  const calls: GlCalls = {
    createShader: 0,
    shaderSource: [],
    compileShader: 0,
    createProgram: 0,
    attachShader: 0,
    linkProgram: 0,
    useProgram: 0,
    createBuffer: 0,
    drawArrays: [],
    uniform1f: [],
    uniform2f: [],
    viewport: [],
  };
  const uniformLocs = new Map<string, object>();
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
    createShader: vi.fn(() => {
      calls.createShader += 1;
      return { __shader: true } as unknown as WebGLShader;
    }),
    shaderSource: vi.fn((shader: unknown, source: string) => {
      calls.shaderSource.push([shader, source]);
    }),
    compileShader: vi.fn(() => {
      calls.compileShader += 1;
    }),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ''),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => {
      calls.createProgram += 1;
      return { __prog: true } as unknown as WebGLProgram;
    }),
    attachShader: vi.fn(() => {
      calls.attachShader += 1;
    }),
    linkProgram: vi.fn(() => {
      calls.linkProgram += 1;
    }),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ''),
    deleteProgram: vi.fn(),
    useProgram: vi.fn(() => {
      calls.useProgram += 1;
    }),
    createBuffer: vi.fn(() => {
      calls.createBuffer += 1;
      return { __buf: true } as unknown as WebGLBuffer;
    }),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    getUniformLocation: vi.fn((_p: unknown, name: string) => {
      let loc = uniformLocs.get(name);
      if (loc === undefined) {
        loc = { name };
        uniformLocs.set(name, loc);
      }
      return loc as unknown as WebGLUniformLocation;
    }),
    uniform1f: vi.fn((loc: unknown, v: number) => {
      calls.uniform1f.push([(loc as { name: string }).name, v]);
    }),
    uniform2f: vi.fn((loc: unknown, a: number, b: number) => {
      calls.uniform2f.push([(loc as { name: string }).name, a, b]);
    }),
    uniform3f: vi.fn(),
    uniform4f: vi.fn(),
    viewport: vi.fn((x: number, y: number, w: number, h: number) => {
      calls.viewport.push([x, y, w, h]);
    }),
    clearColor: vi.fn(),
    clear: vi.fn(),
    drawArrays: vi.fn((mode: number, first: number, count: number) => {
      calls.drawArrays.push([mode, first, count]);
    }),
    deleteBuffer: vi.fn(),
  } as unknown as WebGLRenderingContext;
  return { gl, calls };
}

function makeCtx<P>(overrides: Partial<ClipRenderContext<P>> & { props: P }): ClipRenderContext<P> {
  return {
    frame: 0,
    fps: 30,
    width: 1920,
    height: 1080,
    clipFrom: 0,
    clipDurationInFrames: 60,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validateFragmentShader
// ---------------------------------------------------------------------------

describe('validateFragmentShader', () => {
  it('accepts highp float precision', () => {
    expect(() =>
      validateFragmentShader('precision highp float; void main(){}', 'ok'),
    ).not.toThrow();
  });

  it('accepts mediump + lowp', () => {
    expect(() =>
      validateFragmentShader('precision mediump float; void main(){}', 'ok'),
    ).not.toThrow();
    expect(() => validateFragmentShader('precision lowp float; void main(){}', 'ok')).not.toThrow();
  });

  it('tolerates comments before the precision declaration', () => {
    const src = '// my shader\n/* block */\nprecision highp float;\nvoid main(){}';
    expect(() => validateFragmentShader(src, 'ok')).not.toThrow();
  });

  it('throws when precision is missing', () => {
    expect(() => validateFragmentShader('void main(){}', 'implicit')).toThrow(
      /explicit float precision/,
    );
  });

  it("ignores 'precision' inside a comment", () => {
    const src = '// precision highp float; would be needed\nvoid main(){}';
    expect(() => validateFragmentShader(src, 'fake')).toThrow(/explicit float precision/);
  });

  it('throws on empty or non-string', () => {
    expect(() => validateFragmentShader('', 'empty')).toThrow(/non-empty/);
  });
});

// ---------------------------------------------------------------------------
// Runtime shape
// ---------------------------------------------------------------------------

describe('createShaderRuntime — runtime shape', () => {
  it("produces a ClipRuntime with id 'shader' and tier 'live'", () => {
    const rt = createShaderRuntime();
    expect(rt.id).toBe('shader');
    expect(rt.tier).toBe('live');
    expect(rt.clips.size).toBe(0);
  });

  it('accepts clips at construction time', () => {
    const rt = createShaderRuntime([flashThroughWhite, swirlVortex, glitch]);
    expect(rt.clips.get('flash-through-white')).toBe(flashThroughWhite);
    expect(rt.clips.get('swirl-vortex')).toBe(swirlVortex);
    expect(rt.clips.get('glitch')).toBe(glitch);
  });

  it('throws on duplicate kind', () => {
    const a = defineShaderClip({
      kind: 'dup',
      fragmentShader: 'precision highp float; void main(){}',
    });
    const b = defineShaderClip({
      kind: 'dup',
      fragmentShader: 'precision highp float; void main(){}',
    });
    expect(() => createShaderRuntime([a, b])).toThrow(/duplicate/);
  });
});

// ---------------------------------------------------------------------------
// defineShaderClip — validation + window gating
// ---------------------------------------------------------------------------

describe('defineShaderClip — precision validation', () => {
  it('throws when fragment shader omits precision declaration', () => {
    expect(() =>
      defineShaderClip({ kind: 'no-precision', fragmentShader: 'void main(){}' }),
    ).toThrow(/explicit float precision/);
  });

  it('accepts a shader with explicit precision', () => {
    expect(() =>
      defineShaderClip({
        kind: 'ok',
        fragmentShader: 'precision highp float; void main(){}',
      }),
    ).not.toThrow();
  });
});

describe('defineShaderClip — window gating', () => {
  const okFragment = 'precision highp float; void main(){}';
  const clip = defineShaderClip({
    kind: 'gated-probe',
    fragmentShader: okFragment,
  });

  it('returns null before the clip window', () => {
    expect(clip.render(makeCtx({ frame: 4, clipFrom: 5, props: {} }))).toBeNull();
  });

  it('returns null at the exclusive end', () => {
    expect(
      clip.render(makeCtx({ frame: 10, clipFrom: 5, clipDurationInFrames: 5, props: {} })),
    ).toBeNull();
  });

  it('renders at inclusive start', () => {
    expect(clip.render(makeCtx({ frame: 5, clipFrom: 5, props: {} }))).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ShaderClipHost lifecycle (via glContextFactory stub)
// ---------------------------------------------------------------------------

describe('defineShaderClip — WebGL lifecycle (via stub)', () => {
  it('compiles both shaders and links a program on mount', () => {
    const { gl, calls } = makeGlStub();
    const factory: GlContextFactory = () => gl;
    const clip = defineShaderClip({
      kind: 'lifecycle',
      fragmentShader: 'precision highp float; void main(){}',
      glContextFactory: factory,
    });
    const el = clip.render(makeCtx({ frame: 0, props: {} }));
    render(el as React.ReactElement);
    // 2 shaders created + compiled (vertex + fragment), 1 program linked.
    expect(calls.createShader).toBe(2);
    expect(calls.compileShader).toBe(2);
    expect(calls.createProgram).toBe(1);
    expect(calls.linkProgram).toBe(1);
    expect(calls.drawArrays.length).toBeGreaterThanOrEqual(1);
    expect(calls.drawArrays[0]).toEqual([gl.TRIANGLE_STRIP, 0, 4]);
  });

  it('feeds the default uniforms (u_progress, u_time, u_resolution)', () => {
    const { gl, calls } = makeGlStub();
    const clip = defineShaderClip({
      kind: 'uniforms-default',
      fragmentShader: 'precision highp float; void main(){}',
      glContextFactory: () => gl,
    });
    // frame=15 at fps=30 with duration=60: progress=0.25, time=0.5
    const el = clip.render(makeCtx({ frame: 15, fps: 30, clipDurationInFrames: 60, props: {} }));
    render(el as React.ReactElement);
    const progressCall = calls.uniform1f.find(([n]) => n === 'u_progress');
    expect(progressCall?.[1]).toBeCloseTo(0.25, 6);
    const timeCall = calls.uniform1f.find(([n]) => n === 'u_time');
    expect(timeCall?.[1]).toBeCloseTo(0.5, 6);
    const resolutionCall = calls.uniform2f.find(([n]) => n === 'u_resolution');
    expect(resolutionCall?.[1]).toBe(1920);
    expect(resolutionCall?.[2]).toBe(1080);
  });

  it('calls a custom uniforms function with the correct context', () => {
    const { gl } = makeGlStub();
    const spy = vi.fn(() => ({ u_custom: 0.42 as UniformValue }));
    const clip = defineShaderClip<{ amp: number }>({
      kind: 'uniforms-custom',
      fragmentShader: 'precision highp float; void main(){}',
      uniforms: spy,
      glContextFactory: () => gl,
    });
    const el = clip.render(
      makeCtx<{ amp: number }>({
        frame: 30,
        fps: 30,
        clipDurationInFrames: 60,
        props: { amp: 0.9 },
      }),
    );
    render(el as React.ReactElement);
    expect(spy).toHaveBeenCalled();
    const args = spy.mock.calls[0]?.[0];
    expect(args?.progress).toBeCloseTo(0.5, 6);
    expect(args?.timeSec).toBeCloseTo(1, 6);
    expect(args?.frame).toBe(30);
    expect(args?.fps).toBe(30);
    expect(args?.resolution).toEqual([1920, 1080]);
    expect(args?.props).toEqual({ amp: 0.9 });
  });

  it('renders a canvas carrying the data-stageflip-shader marker', () => {
    const { gl } = makeGlStub();
    const clip = defineShaderClip({
      kind: 'canvas-marker',
      fragmentShader: 'precision highp float; void main(){}',
      glContextFactory: () => gl,
    });
    const el = clip.render(makeCtx({ frame: 0, props: {} }));
    const { container } = render(el as React.ReactElement);
    const canvas = container.querySelector('[data-stageflip-shader="true"]');
    expect(canvas).not.toBeNull();
    expect(canvas?.tagName).toBe('CANVAS');
  });

  it('bails silently when the context factory returns null (no GL available)', () => {
    const clip = defineShaderClip({
      kind: 'no-gl',
      fragmentShader: 'precision highp float; void main(){}',
      glContextFactory: () => null,
    });
    const el = clip.render(makeCtx({ frame: 0, props: {} }));
    expect(() => render(el as React.ReactElement)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Demo clips
// ---------------------------------------------------------------------------

describe('demo clips', () => {
  it('flashThroughWhite, swirlVortex, glitch have the canonical kinds', () => {
    expect(flashThroughWhite.kind).toBe('flash-through-white');
    expect(swirlVortex.kind).toBe('swirl-vortex');
    expect(glitch.kind).toBe('glitch');
  });

  it('all three demos pass precision validation', () => {
    // defineShaderClip would have thrown at import time otherwise; this test
    // documents the invariant rather than re-runs it.
    expect(flashThroughWhite).toBeDefined();
    expect(swirlVortex).toBeDefined();
    expect(glitch).toBeDefined();
  });
});

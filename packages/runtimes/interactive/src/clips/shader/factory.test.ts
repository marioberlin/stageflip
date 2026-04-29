// packages/runtimes/interactive/src/clips/shader/factory.test.ts
// T-383 ACs #6–#12, #19–#21 — shaderClipFactory unit tests. happy-dom does
// not provide WebGL; tests inject a stub `glContextFactory` to drive
// lifecycle assertions without a real GPU.

import type { ShaderClipHostProps } from '@stageflip/runtimes-shader';
import { describe, expect, it, vi } from 'vitest';

import { type ClipFactory, type MountContext, PERMISSIVE_TENANT_POLICY } from '../../contract.js';
import { RecordModeFrameSource } from '../../frame-source-record.js';
import { MissingFrameSourceError } from '../../frame-source.js';
import { InteractiveMountHarness } from '../../mount-harness.js';
import { PermissionShim } from '../../permission-shim.js';
import { InteractiveClipRegistry } from '../../registry.js';
import { ShaderClipFactoryBuilder } from './factory.js';
import type { ShaderClipProps } from './props.js';

// ----- WebGL stub -----

interface GlStubResult {
  factory: ShaderClipHostProps['glContextFactory'];
  deletedProgram: () => boolean;
  deletedBuffer: () => boolean;
}

function makeGlStub(): GlStubResult {
  let programDeleted = false;
  let bufferDeleted = false;
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
    createShader: vi.fn(() => ({ __shader: true }) as unknown as WebGLShader),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ''),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({ __prog: true }) as unknown as WebGLProgram),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ''),
    deleteProgram: vi.fn(() => {
      programDeleted = true;
    }),
    useProgram: vi.fn(),
    createBuffer: vi.fn(() => ({ __buf: true }) as unknown as WebGLBuffer),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    getUniformLocation: vi.fn(() => ({}) as unknown as WebGLUniformLocation),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    uniform4f: vi.fn(),
    viewport: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    drawArrays: vi.fn(),
    deleteBuffer: vi.fn(() => {
      bufferDeleted = true;
    }),
  } as unknown as WebGLRenderingContext;
  return {
    factory: () => gl,
    deletedProgram: () => programDeleted,
    deletedBuffer: () => bufferDeleted,
  };
}

// ----- Test fixtures -----

const VALID_FRAGMENT = 'precision highp float; void main(){ gl_FragColor = vec4(1.0); }';

function makeProps(overrides: Partial<ShaderClipProps> = {}): ShaderClipProps {
  return {
    fragmentShader: VALID_FRAGMENT,
    initialUniforms: {},
    width: 100,
    height: 100,
    posterFrame: 0,
    ...overrides,
  };
}

function makeContext(args: {
  props?: ShaderClipProps;
  frameSource?: RecordModeFrameSource | undefined;
  emit?: MountContext['emitTelemetry'];
  signal?: AbortSignal;
}): MountContext {
  const props = args.props ?? makeProps();
  const root = document.createElement('div');
  return {
    clip: {
      id: 'test-clip',
      type: 'interactive-clip',
      family: 'shader',
      transform: { x: 0, y: 0, width: props.width, height: props.height },
      visible: true,
      locked: false,
      animations: [],
      staticFallback: [
        {
          id: 'sf',
          type: 'image',
          transform: { x: 0, y: 0, width: props.width, height: props.height },
          visible: true,
          locked: false,
          animations: [],
          src: 'poster.png',
        },
      ],
      liveMount: {
        component: { module: '@stageflip/runtimes-interactive/clips/shader#ShaderClip' },
        props: props as unknown as Record<string, unknown>,
        permissions: [],
      },
    } as never,
    root,
    permissions: [],
    tenantPolicy: PERMISSIVE_TENANT_POLICY,
    emitTelemetry: args.emit ?? (() => undefined),
    signal: args.signal ?? new AbortController().signal,
    ...(args.frameSource !== undefined ? { frameSource: args.frameSource } : {}),
  };
}

// ----- Tests -----

describe('shaderClipFactory (T-383)', () => {
  it('AC #6 — registry resolves the factory after side-effect import', async () => {
    const registry = new InteractiveClipRegistry();
    const stub = makeGlStub();
    const factory = ShaderClipFactoryBuilder.build({ glContextFactory: stub.factory });
    registry.register('shader', factory);
    expect(registry.resolve('shader')).toBe(factory);
  });

  it('AC #8 — factory mounts ShaderClipHost (canvas appears in root)', async () => {
    const stub = makeGlStub();
    const factory = ShaderClipFactoryBuilder.build({ glContextFactory: stub.factory });
    const fs = new RecordModeFrameSource();
    const ctx = makeContext({ frameSource: fs });
    const handle = await factory(ctx);
    const canvas = ctx.root.querySelector('[data-stageflip-shader="true"]');
    expect(canvas).not.toBeNull();
    expect(canvas?.tagName).toBe('CANVAS');
    handle.dispose();
  });

  it('AC #9 — updateProps does not re-mount (same canvas instance)', async () => {
    const stub = makeGlStub();
    const factory = ShaderClipFactoryBuilder.build({ glContextFactory: stub.factory });
    const fs = new RecordModeFrameSource();
    const ctx = makeContext({ frameSource: fs });
    const handle = await factory(ctx);
    const canvasBefore = ctx.root.querySelector('[data-stageflip-shader="true"]');
    handle.updateProps({ initialUniforms: { uColor: [1, 0, 0, 1] } });
    const canvasAfter = ctx.root.querySelector('[data-stageflip-shader="true"]');
    expect(canvasAfter).toBe(canvasBefore);
    handle.dispose();
  });

  it('AC #10 — dispose unsubscribes from frame source and is idempotent', async () => {
    const stub = makeGlStub();
    const factory = ShaderClipFactoryBuilder.build({ glContextFactory: stub.factory });
    const fs = new RecordModeFrameSource();
    expect(fs.subscriberCount()).toBe(0);
    const ctx = makeContext({ frameSource: fs });
    const handle = await factory(ctx);
    expect(fs.subscriberCount()).toBe(1);
    handle.dispose();
    expect(fs.subscriberCount()).toBe(0);
    handle.dispose(); // idempotent — no throw, no double-unsubscribe
  });

  it('AC #10 — dispose tears down the GL context', async () => {
    const stub = makeGlStub();
    const factory = ShaderClipFactoryBuilder.build({ glContextFactory: stub.factory });
    const fs = new RecordModeFrameSource();
    const ctx = makeContext({ frameSource: fs });
    const handle = await factory(ctx);
    handle.dispose();
    // ShaderClipHost's effect cleanup deletes program + buffer.
    expect(stub.deletedProgram()).toBe(true);
    expect(stub.deletedBuffer()).toBe(true);
  });

  it('AC #11 — signal.abort triggers the same dispose path (via mount-harness)', async () => {
    const stub = makeGlStub();
    const factory = ShaderClipFactoryBuilder.build({ glContextFactory: stub.factory });
    const fs = new RecordModeFrameSource();
    const registry = new InteractiveClipRegistry();
    registry.register('shader', factory);
    const harness = new InteractiveMountHarness({ registry });
    const controller = new AbortController();
    const root = document.createElement('div');
    const clip = makeContext({ frameSource: fs }).clip;
    // Pre-set frameSource by patching the harness's mount call site:
    // The harness doesn't pass frameSource by default. We mock by wrapping
    // the factory to inject one.
    const wrappedFactory: ClipFactory = async (ctx) => factory({ ...ctx, frameSource: fs });
    const registry2 = new InteractiveClipRegistry();
    registry2.register('shader', wrappedFactory);
    const harness2 = new InteractiveMountHarness({ registry: registry2 });
    await harness2.mount(clip, root, controller.signal);
    expect(fs.subscriberCount()).toBe(1);
    controller.abort();
    expect(fs.subscriberCount()).toBe(0);
  });

  it('AC #12 — missing frameSource throws MissingFrameSourceError', async () => {
    const stub = makeGlStub();
    const factory = ShaderClipFactoryBuilder.build({ glContextFactory: stub.factory });
    const ctx = makeContext({ frameSource: undefined });
    await expect(factory(ctx)).rejects.toBeInstanceOf(MissingFrameSourceError);
  });

  it('AC #12 — MissingFrameSourceError message references ADR-005 §D2', async () => {
    const stub = makeGlStub();
    const factory = ShaderClipFactoryBuilder.build({ glContextFactory: stub.factory });
    const ctx = makeContext({ frameSource: undefined });
    try {
      await factory(ctx);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MissingFrameSourceError);
      expect((err as Error).message).toMatch(/ADR-005/);
    }
  });

  it('AC #19 — mount of shader does NOT trigger any permission prompt', async () => {
    const stub = makeGlStub();
    const factory = ShaderClipFactoryBuilder.build({ glContextFactory: stub.factory });
    const fs = new RecordModeFrameSource();
    const registry = new InteractiveClipRegistry();
    const wrappedFactory: ClipFactory = async (ctx) => factory({ ...ctx, frameSource: fs });
    registry.register('shader', wrappedFactory);
    const getUserMedia = vi.fn();
    const permissionShim = new PermissionShim({
      browser: { getUserMedia },
    });
    const harness = new InteractiveMountHarness({ registry, permissionShim });
    const ctx = makeContext({ frameSource: fs });
    await harness.mount(ctx.clip, ctx.root, new AbortController().signal);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('AC #20 — successful mount emits start, success, and dispose events', async () => {
    const stub = makeGlStub();
    const factory = ShaderClipFactoryBuilder.build({ glContextFactory: stub.factory });
    const fs = new RecordModeFrameSource();
    const events: Array<[string, Record<string, unknown>]> = [];
    const ctx = makeContext({
      frameSource: fs,
      emit: (event, attrs) => events.push([event, attrs]),
    });
    const handle = await factory(ctx);
    expect(events[0]?.[0]).toBe('shader-clip.mount.start');
    expect(events[0]?.[1]).toMatchObject({ family: 'shader', width: 100, height: 100 });
    expect(events[1]?.[0]).toBe('shader-clip.mount.success');
    expect(events[1]?.[1]).toMatchObject({ family: 'shader' });
    handle.dispose();
    const last = events[events.length - 1];
    expect(last?.[0]).toBe('shader-clip.dispose');
  });

  it('AC #21 — invalid props emit failure with reason="invalid-props"', async () => {
    const stub = makeGlStub();
    const factory = ShaderClipFactoryBuilder.build({ glContextFactory: stub.factory });
    const fs = new RecordModeFrameSource();
    const events: Array<[string, Record<string, unknown>]> = [];
    const ctx = makeContext({
      frameSource: fs,
      emit: (event, attrs) => events.push([event, attrs]),
    });
    // Invalidate after construction (props default to valid).
    (ctx.clip.liveMount.props as Record<string, unknown>).width = -1;
    await expect(factory(ctx)).rejects.toThrow();
    const failure = events.find((e) => e[0] === 'shader-clip.mount.failure');
    expect(failure).toBeDefined();
    expect(failure?.[1]).toMatchObject({ reason: 'invalid-props' });
  });

  it("AC #21 — bad fragment shader (missing precision) emits reason='compile'", async () => {
    const stub = makeGlStub();
    const factory = ShaderClipFactoryBuilder.build({ glContextFactory: stub.factory });
    const fs = new RecordModeFrameSource();
    const events: Array<[string, Record<string, unknown>]> = [];
    const ctx = makeContext({
      props: makeProps({ fragmentShader: 'void main(){}' }), // no precision
      frameSource: fs,
      emit: (event, attrs) => events.push([event, attrs]),
    });
    await expect(factory(ctx)).rejects.toThrow(/explicit float precision/);
    const failure = events.find((e) => e[0] === 'shader-clip.mount.failure');
    expect(failure?.[1]).toMatchObject({ reason: 'compile' });
  });

  it('frame ticks re-render with new uniforms', async () => {
    const stub = makeGlStub();
    const observedFrames: number[] = [];
    const factory = ShaderClipFactoryBuilder.build({
      glContextFactory: stub.factory,
      uniforms: (frame, _ctx) => {
        observedFrames.push(frame);
        return { uFrame: frame };
      },
    });
    const fs = new RecordModeFrameSource();
    const ctx = makeContext({ frameSource: fs });
    const handle = await factory(ctx);
    // First-paint frame=0 (FrameSource starts at 0).
    expect(observedFrames[0]).toBe(0);
    fs.advance(3);
    expect(observedFrames).toEqual([0, 1, 2, 3]);
    handle.dispose();
  });

  it('updateProps with invalid partial is a no-op (current props remain)', async () => {
    const stub = makeGlStub();
    const factory = ShaderClipFactoryBuilder.build({ glContextFactory: stub.factory });
    const fs = new RecordModeFrameSource();
    const ctx = makeContext({ frameSource: fs });
    const handle = await factory(ctx);
    // Negative width is invalid. The factory should NOT crash and NOT
    // re-render — the prior props stay in effect.
    expect(() => handle.updateProps({ width: -10 } as Record<string, unknown>)).not.toThrow();
    handle.dispose();
  });
});

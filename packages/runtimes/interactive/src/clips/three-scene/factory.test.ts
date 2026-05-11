// packages/runtimes/interactive/src/clips/three-scene/factory.test.ts
// T-384 ACs #6–#14, #27–#30 — threeSceneClipFactory unit tests. happy-dom
// does not provide WebGL, but the factory's logic does NOT require GL — it
// dynamic-imports the author setup, calls it, mounts `ThreeClipHost`, and
// wires the FrameSource clock through. Author-side WebGL failures bubble
// up through the host's silent-bail seam (host.tsx).

import type { ThreeClipHandle, ThreeClipSetup } from '@stageflip/runtimes-three';
import { describe, expect, it, vi } from 'vitest';

import { type ClipFactory, type MountContext, PERMISSIVE_TENANT_POLICY } from '../../contract.js';
import { RecordModeFrameSource } from '../../frame-source-record.js';
import { MissingFrameSourceError } from '../../frame-source.js';
import { InteractiveMountHarness } from '../../mount-harness.js';
import { PermissionShim } from '../../permission-shim.js';
import { InteractiveClipRegistry } from '../../registry.js';
import { ThreeSceneClipFactoryBuilder } from './factory.js';

// ----- test fixtures -----

interface SceneState {
  setupCalled: number;
  renderCalled: number;
  disposeCalled: number;
  lastProps: Record<string, unknown> | undefined;
  lastFrame: number | undefined;
  lastPRNGSample: number | undefined;
}

function makeFakeSetup(state: SceneState): ThreeClipSetup<Record<string, unknown>> {
  return ({ container, props }) => {
    state.setupCalled += 1;
    state.lastProps = props;
    // Append a sentinel node so DOM assertions can find the mount.
    const sentinel = document.createElement('div');
    sentinel.setAttribute('data-stageflip-three-scene-test', 'true');
    container.appendChild(sentinel);
    const handle: ThreeClipHandle<Record<string, unknown>> = {
      render: (args) => {
        state.renderCalled += 1;
        state.lastFrame = args.frame;
        state.lastProps = args.props;
      },
      dispose: () => {
        state.disposeCalled += 1;
      },
    };
    return handle;
  };
}

function freshSceneState(): SceneState {
  return {
    setupCalled: 0,
    renderCalled: 0,
    disposeCalled: 0,
    lastProps: undefined,
    lastFrame: undefined,
    lastPRNGSample: undefined,
  };
}

const VALID_REF = '@author/scene#MySetup';

interface ContextArgs {
  setupRef?: string;
  setupProps?: Record<string, unknown>;
  prngSeed?: number;
  width?: number;
  height?: number;
  frameSource?: RecordModeFrameSource | undefined;
  emit?: MountContext['emitTelemetry'];
  signal?: AbortSignal;
}

function makeContext(args: ContextArgs = {}): MountContext {
  const width = args.width ?? 100;
  const height = args.height ?? 100;
  const root = document.createElement('div');
  return {
    clip: {
      id: 'test-three-clip',
      type: 'interactive-clip',
      family: 'three-scene',
      transform: { x: 0, y: 0, width, height },
      visible: true,
      locked: false,
      animations: [],
      staticFallback: [
        {
          id: 'sf',
          type: 'image',
          transform: { x: 0, y: 0, width, height },
          visible: true,
          locked: false,
          animations: [],
          src: 'poster.png',
        },
      ],
      liveMount: {
        component: {
          module: '@stageflip/runtimes-interactive/clips/three-scene#ThreeSceneClip',
        },
        props: {
          setupRef: { module: args.setupRef ?? VALID_REF },
          width,
          height,
          setupProps: args.setupProps ?? {},
          prngSeed: args.prngSeed ?? 0,
          posterFrame: 0,
        },
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

// ----- tests -----

describe('threeSceneClipFactory (T-384)', () => {
  it('AC #6 — registry resolves the factory after side-effect import', () => {
    const registry = new InteractiveClipRegistry();
    const state = freshSceneState();
    const factory = ThreeSceneClipFactoryBuilder.build({
      importer: async () => ({ MySetup: makeFakeSetup(state) }),
    });
    registry.register('three-scene', factory);
    expect(registry.resolve('three-scene')).toBe(factory);
  });

  it('AC #8 — factory dynamic-imports setupRef, calls setup, mounts ThreeClipHost', async () => {
    const state = freshSceneState();
    const factory = ThreeSceneClipFactoryBuilder.build({
      importer: async () => ({ MySetup: makeFakeSetup(state) }),
    });
    const fs = new RecordModeFrameSource();
    const ctx = makeContext({ frameSource: fs });
    const handle = await factory(ctx);
    // Setup ran exactly once.
    expect(state.setupCalled).toBe(1);
    // ThreeClipHost is mounted in the root.
    expect(ctx.root.querySelector('[data-stageflip-three="true"]')).not.toBeNull();
    // Author's sentinel rendered too (proves ThreeClipHost called setup).
    expect(ctx.root.querySelector('[data-stageflip-three-scene-test="true"]')).not.toBeNull();
    handle.dispose();
  });

  it('AC #9 — setup throw → mount.failure with reason setup-throw', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const factory = ThreeSceneClipFactoryBuilder.build({
      importer: async () => ({
        MySetup: () => {
          throw new Error('setup blew up');
        },
      }),
    });
    const fs = new RecordModeFrameSource();
    const ctx = makeContext({
      frameSource: fs,
      emit: (e, a) => events.push([e, a]),
    });
    await expect(factory(ctx)).rejects.toThrow(/setup blew up/);
    const failure = events.find((e) => e[0] === 'three-scene-clip.mount.failure');
    expect(failure).toBeDefined();
    expect(failure?.[1]).toMatchObject({ reason: 'setup-throw' });
  });

  it('AC #10 — unresolvable setupRef → mount.failure with reason setupRef-resolve', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const factory = ThreeSceneClipFactoryBuilder.build({
      importer: async () => ({}),
    });
    const fs = new RecordModeFrameSource();
    const ctx = makeContext({
      frameSource: fs,
      emit: (e, a) => events.push([e, a]),
    });
    await expect(factory(ctx)).rejects.toThrow();
    const failure = events.find((e) => e[0] === 'three-scene-clip.mount.failure');
    expect(failure?.[1]).toMatchObject({ reason: 'setupRef-resolve' });
  });

  it('AC #11 — updateProps does not re-mount; setup stays at 1 call', async () => {
    const state = freshSceneState();
    const factory = ThreeSceneClipFactoryBuilder.build({
      importer: async () => ({ MySetup: makeFakeSetup(state) }),
    });
    const fs = new RecordModeFrameSource();
    const ctx = makeContext({ frameSource: fs });
    const handle = await factory(ctx);
    expect(state.setupCalled).toBe(1);
    handle.updateProps({ setupProps: { color: 'red' } });
    // Setup still 1 — host re-renders with new props, does not re-mount.
    expect(state.setupCalled).toBe(1);
    handle.dispose();
  });

  it('AC #12 — dispose unsubscribes, calls author dispose, idempotent', async () => {
    const state = freshSceneState();
    const factory = ThreeSceneClipFactoryBuilder.build({
      importer: async () => ({ MySetup: makeFakeSetup(state) }),
    });
    const fs = new RecordModeFrameSource();
    expect(fs.subscriberCount()).toBe(0);
    const ctx = makeContext({ frameSource: fs });
    const handle = await factory(ctx);
    expect(fs.subscriberCount()).toBe(1);
    handle.dispose();
    expect(fs.subscriberCount()).toBe(0);
    expect(state.disposeCalled).toBe(1);
    handle.dispose(); // idempotent
    expect(state.disposeCalled).toBe(1);
  });

  it('AC #12 — dispose uninstalls the rAF shim', async () => {
    const originalRAF = window.requestAnimationFrame;
    const state = freshSceneState();
    const factory = ThreeSceneClipFactoryBuilder.build({
      importer: async () => ({ MySetup: makeFakeSetup(state) }),
    });
    const fs = new RecordModeFrameSource();
    const ctx = makeContext({ frameSource: fs });
    const handle = await factory(ctx);
    // Shim is installed.
    expect(window.requestAnimationFrame).not.toBe(originalRAF);
    handle.dispose();
    // Shim restored.
    expect(window.requestAnimationFrame).toBe(originalRAF);
  });

  it('AC #13 — signal.abort triggers the same dispose path (via mount-harness)', async () => {
    const state = freshSceneState();
    const factory = ThreeSceneClipFactoryBuilder.build({
      importer: async () => ({ MySetup: makeFakeSetup(state) }),
    });
    const fs = new RecordModeFrameSource();
    const wrapped: ClipFactory = async (ctx) => factory({ ...ctx, frameSource: fs });
    const registry = new InteractiveClipRegistry();
    registry.register('three-scene', wrapped);
    const harness = new InteractiveMountHarness({ registry });
    const controller = new AbortController();
    const root = document.createElement('div');
    const ctx = makeContext({ frameSource: fs });
    await harness.mount(ctx.clip, root, controller.signal);
    expect(fs.subscriberCount()).toBe(1);
    controller.abort();
    expect(fs.subscriberCount()).toBe(0);
    expect(state.disposeCalled).toBe(1);
  });

  it('AC #14 — missing frameSource throws MissingFrameSourceError referencing ADR-005', async () => {
    const state = freshSceneState();
    const factory = ThreeSceneClipFactoryBuilder.build({
      importer: async () => ({ MySetup: makeFakeSetup(state) }),
    });
    const ctx = makeContext({ frameSource: undefined });
    try {
      await factory(ctx);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MissingFrameSourceError);
      expect((err as Error).message).toMatch(/ADR-005/);
    }
  });

  it('invalid-props telemetry — failure emits reason="invalid-props"', async () => {
    const state = freshSceneState();
    const factory = ThreeSceneClipFactoryBuilder.build({
      importer: async () => ({ MySetup: makeFakeSetup(state) }),
    });
    const fs = new RecordModeFrameSource();
    const events: Array<[string, Record<string, unknown>]> = [];
    const ctx = makeContext({
      frameSource: fs,
      emit: (e, a) => events.push([e, a]),
    });
    // Invalidate after construction.
    (ctx.clip.liveMount.props as Record<string, unknown>).width = -1;
    await expect(factory(ctx)).rejects.toThrow();
    const failure = events.find((e) => e[0] === 'three-scene-clip.mount.failure');
    expect(failure?.[1]).toMatchObject({ reason: 'invalid-props' });
  });

  it('AC #27 — mount of three-scene does NOT trigger any permission prompt', async () => {
    const state = freshSceneState();
    const factory = ThreeSceneClipFactoryBuilder.build({
      importer: async () => ({ MySetup: makeFakeSetup(state) }),
    });
    const fs = new RecordModeFrameSource();
    const wrapped: ClipFactory = async (ctx) => factory({ ...ctx, frameSource: fs });
    const registry = new InteractiveClipRegistry();
    registry.register('three-scene', wrapped);
    const getUserMedia = vi.fn();
    const permissionShim = new PermissionShim({
      browser: { getUserMedia },
    });
    const harness = new InteractiveMountHarness({ registry, permissionShim });
    const ctx = makeContext({ frameSource: fs });
    await harness.mount(ctx.clip, ctx.root, new AbortController().signal);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('AC #28 — successful mount emits start, success, and dispose events', async () => {
    const state = freshSceneState();
    const factory = ThreeSceneClipFactoryBuilder.build({
      importer: async () => ({ MySetup: makeFakeSetup(state) }),
    });
    const fs = new RecordModeFrameSource();
    const events: Array<[string, Record<string, unknown>]> = [];
    const ctx = makeContext({
      frameSource: fs,
      emit: (event, attrs) => events.push([event, attrs]),
    });
    const handle = await factory(ctx);
    expect(events[0]?.[0]).toBe('three-scene-clip.mount.start');
    expect(events[0]?.[1]).toMatchObject({
      family: 'three-scene',
      width: 100,
      height: 100,
    });
    const success = events.find((e) => e[0] === 'three-scene-clip.mount.success');
    expect(success?.[1]).toMatchObject({ family: 'three-scene' });
    handle.dispose();
    const last = events[events.length - 1];
    expect(last?.[0]).toBe('three-scene-clip.dispose');
  });

  it('frame ticks re-render with new frame numbers', async () => {
    const state = freshSceneState();
    const factory = ThreeSceneClipFactoryBuilder.build({
      importer: async () => ({ MySetup: makeFakeSetup(state) }),
    });
    const fs = new RecordModeFrameSource();
    const ctx = makeContext({ frameSource: fs });
    const handle = await factory(ctx);
    // Initial render is at frame=0; advance fires further renders.
    expect(state.lastFrame).toBe(0);
    fs.advance(3);
    expect(state.lastFrame).toBe(3);
    handle.dispose();
  });

  it('updateProps with invalid partial is a no-op (current props remain)', async () => {
    const state = freshSceneState();
    const factory = ThreeSceneClipFactoryBuilder.build({
      importer: async () => ({ MySetup: makeFakeSetup(state) }),
    });
    const fs = new RecordModeFrameSource();
    const ctx = makeContext({ frameSource: fs });
    const handle = await factory(ctx);
    expect(() => handle.updateProps({ width: -10 } as Record<string, unknown>)).not.toThrow();
    handle.dispose();
  });

  // ---------------------------------------------------------------------
  // T-437 — asset-gen resolver hook
  // ---------------------------------------------------------------------

  it('T-437 — assetGenResolver merges ok result under setupProps.__assetGen', async () => {
    const state = freshSceneState();
    const sampleBytes = new Uint8Array([0x67, 0x6c, 0x54, 0x46]);
    const factory = ThreeSceneClipFactoryBuilder.build({
      importer: async () => ({ MySetup: makeFakeSetup(state) }),
      assetGenResolver: async (seedSrc) => {
        expect(seedSrc.kind).toBe('asset-gen');
        expect(seedSrc.cacheKey).toBe('three-d/abc123');
        expect(seedSrc.provider).toBe('tripo');
        return { ok: true, bytes: sampleBytes, provider: 'tripo' };
      },
    });
    const fs = new RecordModeFrameSource();
    const ctx = makeContext({
      frameSource: fs,
      setupProps: {
        seedSrc: { kind: 'asset-gen', cacheKey: 'three-d/abc123', provider: 'tripo' },
      },
    });
    const handle = await factory(ctx);
    expect(state.setupCalled).toBe(1);
    const merged = state.lastProps as Record<string, unknown> | undefined;
    expect(merged).toBeDefined();
    const ag = merged?.__assetGen as { ok: true; bytes: Uint8Array; provider: string } | undefined;
    expect(ag?.ok).toBe(true);
    expect(ag?.bytes).toBe(sampleBytes);
    expect(ag?.provider).toBe('tripo');
    handle.dispose();
  });

  it('T-437 — assetGenResolver merges failure result under setupProps.__assetGen', async () => {
    const state = freshSceneState();
    const factory = ThreeSceneClipFactoryBuilder.build({
      importer: async () => ({ MySetup: makeFakeSetup(state) }),
      assetGenResolver: async () => ({ ok: false, reason: 'cache-miss' }),
    });
    const fs = new RecordModeFrameSource();
    const ctx = makeContext({
      frameSource: fs,
      setupProps: {
        seedSrc: { kind: 'asset-gen', cacheKey: 'three-d/abc123', provider: 'tripo' },
      },
    });
    const handle = await factory(ctx);
    const merged = state.lastProps as Record<string, unknown> | undefined;
    const ag = merged?.__assetGen as { ok: false; reason: string } | undefined;
    expect(ag?.ok).toBe(false);
    expect(ag?.reason).toBe('cache-miss');
    handle.dispose();
  });

  it('T-437 — no assetGenResolver option → setupProps is byte-identical to T-384 default', async () => {
    const state = freshSceneState();
    const factory = ThreeSceneClipFactoryBuilder.build({
      importer: async () => ({ MySetup: makeFakeSetup(state) }),
    });
    const fs = new RecordModeFrameSource();
    const ctx = makeContext({
      frameSource: fs,
      setupProps: {
        seedSrc: { kind: 'asset-gen', cacheKey: 'three-d/abc123', provider: 'tripo' },
      },
    });
    const handle = await factory(ctx);
    const merged = state.lastProps as Record<string, unknown> | undefined;
    expect(merged?.__assetGen).toBeUndefined();
    // The original seedSrc is preserved as schema-opaque setupProps content.
    expect(merged?.seedSrc).toEqual({
      kind: 'asset-gen',
      cacheKey: 'three-d/abc123',
      provider: 'tripo',
    });
    handle.dispose();
  });

  it('T-437 — assetGenResolver is NOT invoked when setupProps.seedSrc is absent', async () => {
    const state = freshSceneState();
    const resolver = vi.fn(async () => ({ ok: true, bytes: new Uint8Array(4), provider: 'tripo' }));
    const factory = ThreeSceneClipFactoryBuilder.build({
      importer: async () => ({ MySetup: makeFakeSetup(state) }),
      // Cast: production callers pass the typed AssetGenResolver — this
      // test uses a structurally-compatible stub for invocation-count
      // assertions.
      assetGenResolver: resolver as never,
    });
    const fs = new RecordModeFrameSource();
    const ctx = makeContext({ frameSource: fs });
    const handle = await factory(ctx);
    expect(resolver).not.toHaveBeenCalled();
    handle.dispose();
  });
});

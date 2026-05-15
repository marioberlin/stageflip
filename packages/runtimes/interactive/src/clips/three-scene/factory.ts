// packages/runtimes/interactive/src/clips/three-scene/factory.ts
// `threeSceneClipFactory` — produces the `ClipFactory` for `family: 'three-scene'`.
// Wraps `ThreeClipHost` from `@stageflip/runtimes-three` (T-384 D-T384-1) so
// `liveMount` and `staticFallback` poster generation share a single rendering
// core (convergence-by-construction per ADR-005 §D2).
//
// STRUCTURAL NOTE — DETERMINISM SUB-RULE (T-309a, PR #270): T-309a's
// tightened sub-rule scans both top-level functions AND class methods on
// path-matched files; the missing-frame-parameter check was DROPPED. T-384
// therefore ships clean top-level functions in this directory rather than
// the static-class workaround that T-383 used inside `clips/shader/**`.
// The forbidden-API check alone is sufficient: this file calls no
// `Date.now`, `performance.now`, `Math.random`, `setTimeout/setInterval`,
// or `requestAnimationFrame/cancelAnimationFrame` — its rAF-shim sibling
// captures the original references and assigns replacements without
// invoking them.
//
// Browser-safe: React 19 + DOM. No Node imports.

import {
  type ThreeClipHandle,
  ThreeClipHost,
  type ThreeClipHostProps,
} from '@stageflip/runtimes-three';
import { type ThreeSceneClipProps, threeSceneClipPropsSchema } from '@stageflip/schema';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';

import type { ClipFactory, MountContext, MountHandle } from '../../contract.js';
import { tenantScopedEmitter } from '../../contract.js';
import { MissingFrameSourceError } from '../../frame-source.js';
import {
  ASSET_GEN_SETUP_PROPS_KEY,
  type AssetGenGlbResult,
  type AssetGenSeedSrc,
} from './asset-gen-consumer.js';
import { type SeededPRNG, createSeededPRNG } from './prng.js';
import { type RAFShimHandle, installRAFShim } from './raf-shim.js';
import { type SetupImporter, resolveSetupRef } from './setup-resolver.js';

/**
 * Telemetry reasons routed via `MountContext.emitTelemetry`. T-384 D-T384-9
 * pins these strings; the security-review build (T-403/T-404) consumes them.
 */
export type ThreeSceneMountFailureReason = 'setup-throw' | 'setupRef-resolve' | 'invalid-props';

/**
 * Caller-supplied hook that resolves an `asset-gen` seedSrc descriptor
 * (T-437) against the host's `AssetCacheStore`. When set, the factory
 * invokes the resolver once per mount BEFORE the author's setup
 * callback runs and merges the result under
 * `setupProps.__assetGen` so the setup callback can mount the cached
 * GLB bytes (or fall back to a placeholder) inside the Three.js scene.
 *
 * The resolver receives the raw `seedSrc` descriptor read off
 * `ThreeSceneClipProps.setupProps.seedSrc` (a host-side convention
 * documented in the three-runtime SKILL). Hosts that don't use
 * asset-gen mounting omit this option and the factory's behavior is
 * byte-identical to T-384.
 *
 * Never throws — the resolver returns a structured `AssetGenGlbResult`
 * (success or failure reason) and the failure path is silent.
 */
export type AssetGenResolver = (seedSrc: AssetGenSeedSrc) => Promise<AssetGenGlbResult>;

/**
 * Optional caller-injected hooks.
 */
export interface ThreeSceneClipFactoryOptions {
  /** Override the dynamic `import()` used to resolve `setupRef` (test seam). */
  importer?: SetupImporter;
  /** Composition fps — defaults to 60. Forwarded to `ThreeClipHost`. */
  fps?: number;
  /** Clip duration in frames — defaults to `Number.POSITIVE_INFINITY`. */
  clipDurationInFrames?: number;
  /**
   * Optional 3D asset-gen resolver hook (T-437). When set, the factory
   * looks for `setupProps.seedSrc` on the parsed clip props; if present
   * and structurally a `{ kind, cacheKey, provider }` descriptor, the
   * resolver runs and the result is merged into setupProps under
   * `__assetGen` before the author's `setup` callback fires.
   * When absent, this code path is skipped entirely.
   */
  assetGenResolver?: AssetGenResolver;
}

/**
 * Read a `seedSrc` descriptor off the parsed `setupProps`. Returns
 * `undefined` when the slot is absent or structurally wrong — the
 * resolver fires only when at least `kind` is a string (the resolver's
 * own checks handle missing provider / cacheKey).
 */
function readSeedSrc(setupProps: Record<string, unknown>): AssetGenSeedSrc | undefined {
  const raw = setupProps.seedSrc;
  if (raw === null || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.kind !== 'string') return undefined;
  return {
    kind: obj.kind,
    cacheKey: typeof obj.cacheKey === 'string' ? obj.cacheKey : '',
    ...(typeof obj.provider === 'string' ? { provider: obj.provider } : {}),
  };
}

/**
 * Convenience namespace for the factory builder. Top-level function — the
 * static-class workaround used by T-383 is unnecessary under T-309a.
 */
export const ThreeSceneClipFactoryBuilder = {
  /**
   * Build a `ClipFactory` bound to `options`. Production code calls this
   * once at module-load time and registers the result with
   * `interactiveClipRegistry`. Tests can call it per-test to inject the
   * `importer` seam without touching the global registry.
   */
  build(options: ThreeSceneClipFactoryOptions = {}): ClipFactory {
    return (ctx: MountContext): Promise<MountHandle> => mountThreeScene(ctx, options);
  },
};

/**
 * Mount routine. Top-level function — the file's structural note explains
 * why this is now safe (T-309a tightened the sub-rule; missing-frame is no
 * longer a violation).
 */
async function mountThreeScene(
  ctx: MountContext,
  options: ThreeSceneClipFactoryOptions,
): Promise<MountHandle> {
  const family = ctx.clip.family;
  // T-403 R-13 — tenant-scoped emitter; pass-through when ctx.tenantId
  // is undefined (back-compat with pre-R-13 fixtures).
  const emit = tenantScopedEmitter(ctx);
  const fps = options.fps ?? 60;
  const clipDurationInFrames = options.clipDurationInFrames ?? Number.POSITIVE_INFINITY;

  // 1. Frame source — frame-driven family invariant per AC #14.
  const frameSource = ctx.frameSource;
  if (frameSource === undefined) {
    throw new MissingFrameSourceError(family);
  }

  // 2. Parse + narrow `liveMount.props`.
  const propsResult = threeSceneClipPropsSchema.safeParse(ctx.clip.liveMount.props);
  if (!propsResult.success) {
    emit('three-scene-clip.mount.failure', {
      family,
      reason: 'invalid-props' satisfies ThreeSceneMountFailureReason,
      issues: propsResult.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
    throw new Error(
      `threeSceneClipFactory: liveMount.props failed threeSceneClipPropsSchema — ${propsResult.error.message}`,
    );
  }
  let currentProps: ThreeSceneClipProps = propsResult.data;

  // 2b. Asset-gen resolver hook (T-437). When the host wired an
  //     `assetGenResolver` AND `setupProps.seedSrc` is a structurally
  //     valid `{ kind, cacheKey, provider }` descriptor, resolve the
  //     cached GLB bytes and merge the result into setupProps under
  //     `__assetGen`. The resolver itself never throws — pre-flight or
  //     cache-miss failures surface as a typed failure-shape that the
  //     author's setup callback inspects to choose between mounting
  //     the bytes and falling back to a placeholder.
  if (options.assetGenResolver !== undefined) {
    const seedSrc = readSeedSrc(currentProps.setupProps);
    if (seedSrc !== undefined) {
      const assetGenResult = await options.assetGenResolver(seedSrc);
      currentProps = {
        ...currentProps,
        setupProps: {
          ...currentProps.setupProps,
          [ASSET_GEN_SETUP_PROPS_KEY]: assetGenResult,
        },
      };
    }
  }

  // 3. Resolve `setupRef` via dynamic-import (D-T384-3).
  emit('three-scene-clip.mount.start', {
    family,
    width: currentProps.width,
    height: currentProps.height,
    setupRefModule: currentProps.setupRef.module,
  });

  let setup: Awaited<ReturnType<typeof resolveSetupRef>>;
  try {
    const resolveOptions = options.importer === undefined ? {} : { importer: options.importer };
    setup = await resolveSetupRef(currentProps.setupRef, resolveOptions);
  } catch (err) {
    emit('three-scene-clip.mount.failure', {
      family,
      reason: 'setupRef-resolve' satisfies ThreeSceneMountFailureReason,
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  // 4. Wrap the author's setup so we can intercept the throw path. The
  //    seeded PRNG (D-T384-5) flows in through the optional `prng` arg on
  //    `ThreeClipSetupArgs` rather than being merged into `props` — this
  //    keeps the author's `setupProps` byte-identical between the two
  //    convergence paths (factory vs. standalone host).
  const prng: SeededPRNG = createSeededPRNG(currentProps.prngSeed);
  let setupThrown: unknown;
  const wrappedSetup: typeof setup = (args) => {
    try {
      return setup(args);
    } catch (err) {
      setupThrown = err;
      throw err;
    }
  };

  // 5. Install the rAF shim for the lifetime of this mount.
  const shim: RAFShimHandle = installRAFShim(frameSource);

  // 6. Build a React root + render the host. The cast on `ThreeClipHost`
  //    pins the generic to `Record<string, unknown>` once so React sees a
  //    stable component reference across re-renders (a fresh `as` cast on
  //    every render would still be the same runtime value, but pinning
  //    here is structurally clearer).
  const TypedThreeClipHost = ThreeClipHost as (
    p: ThreeClipHostProps<Record<string, unknown>>,
  ) => ReturnType<typeof ThreeClipHost>;

  const state = {
    reactRoot: createRoot(ctx.root) as Root,
    currentProps,
    disposed: false,
    renderHost(frame: number, props: ThreeSceneClipProps): void {
      const hostProps: ThreeClipHostProps<Record<string, unknown>> = {
        setup: wrappedSetup,
        width: props.width,
        height: props.height,
        props: props.setupProps,
        localFrame: frame,
        fps,
        clipDurationInFrames,
        prng,
      };
      this.reactRoot.render(createElement(TypedThreeClipHost, hostProps));
    },
  };

  // First paint — flushSync so callers can assert on DOM immediately.
  try {
    flushSync(() => {
      state.renderHost(frameSource.current(), state.currentProps);
    });
  } catch (err) {
    // ThreeClipHost's effect catches setup errors silently — in that path
    // `setupThrown` is populated by `wrappedSetup` above. If a different
    // error escaped, prefer it.
    const failure = setupThrown ?? err;
    emit('three-scene-clip.mount.failure', {
      family,
      reason: 'setup-throw' satisfies ThreeSceneMountFailureReason,
      message: failure instanceof Error ? failure.message : String(failure),
    });
    shim.uninstall();
    state.reactRoot.unmount();
    throw failure;
  }

  // ThreeClipHost runs setup in a useEffect — by the time flushSync
  // returns, the setup has either succeeded or thrown into the silent-bail
  // try/catch. If it threw, surface that as the mount failure rather than
  // leaving the caller with a frozen first paint.
  if (setupThrown !== undefined) {
    emit('three-scene-clip.mount.failure', {
      family,
      reason: 'setup-throw' satisfies ThreeSceneMountFailureReason,
      message: setupThrown instanceof Error ? setupThrown.message : String(setupThrown),
    });
    shim.uninstall();
    state.reactRoot.unmount();
    throw setupThrown;
  }

  // Telemetry — success path. No time-to-first-paint attribute (same
  // `performance.now` constraint as T-383 in this directory).
  emit('three-scene-clip.mount.success', {
    family,
  });

  // Subscribe to frame ticks. flushSync per tick so render side-effects
  // run before the next tick advances the clock.
  const unsubscribe = frameSource.subscribe((frame) => {
    if (state.disposed) return;
    flushSync(() => {
      state.renderHost(frame, state.currentProps);
    });
  });

  return {
    updateProps(next) {
      const merged = {
        ...state.currentProps,
        ...(next as Partial<ThreeSceneClipProps>),
      };
      const reparsed = threeSceneClipPropsSchema.safeParse(merged);
      if (!reparsed.success) {
        // Invalid update is a no-op; prior props remain in effect.
        return;
      }
      state.currentProps = reparsed.data;
      flushSync(() => {
        state.renderHost(frameSource.current(), state.currentProps);
      });
    },
    dispose() {
      if (state.disposed) return;
      state.disposed = true;
      unsubscribe();
      shim.uninstall();
      // ThreeClipHost's effect-cleanup invokes the author's dispose handle
      // via React's normal unmount path.
      state.reactRoot.unmount();
      emit('three-scene-clip.dispose', { family });
    },
  };
}

/**
 * The default factory instance — no options, native importer. The
 * `clips/three-scene/index.ts` subpath registers this against
 * `interactiveClipRegistry` at import time.
 */
export const threeSceneClipFactory: ClipFactory = ThreeSceneClipFactoryBuilder.build();

// `ThreeClipHandle` is re-exported for ergonomic author-side typing.
export type { ThreeClipHandle };

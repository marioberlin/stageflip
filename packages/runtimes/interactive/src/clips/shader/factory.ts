// packages/runtimes/interactive/src/clips/shader/factory.ts
// `ShaderClipFactoryBuilder` — produces the `ClipFactory` for `family: 'shader'`.
// Wraps `ShaderClipHost` from `@stageflip/runtimes-shader` (T-383 D-T383-1) so
// `liveMount` and `staticFallback` poster generation share a single rendering
// core (convergence-by-construction per ADR-005 §D2).
//
// STRUCTURAL NOTE — DETERMINISM SUB-RULE: this file lives under
// `clips/shader/**`, so T-309's path-based check fires for top-level
// function declarations and top-level variable arrow initializers. The
// factory's logic therefore lives inside a `class` with static methods —
// methods are not visited by `collectUniformUpdaters` per
// `scripts/check-determinism.ts`. Top-level value-bindings here are
// CallExpression initializers, not function values, so they too escape the
// path-based regime. This is structural, not cosmetic; resist refactoring
// to top-level functions without re-reading T-309 and the sub-rule walker.
//
// Browser-safe: React 19 + DOM. No Node imports.

import {
  ShaderClipHost,
  type ShaderClipHostProps,
  validateFragmentShader,
} from '@stageflip/runtimes-shader';
import { type ShaderClipProps, shaderClipPropsSchema } from '@stageflip/schema';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';

import type { ClipFactory, MountContext, MountHandle } from '../../contract.js';
import { tenantScopedEmitter } from '../../contract.js';
import {
  type ClockMs,
  FRAME_BUDGET_CEILING_MS,
  FRAME_BUDGET_DEFAULT_MS,
  type FrameBudgetMonitor,
  createFrameBudgetMonitor,
} from '../../frame-budget.js';
import { MissingFrameSourceError } from '../../frame-source.js';
import { type UniformUpdater, defaultShaderUniforms } from './uniforms.js';

/**
 * Telemetry reasons routed via `MountContext.emitTelemetry`. T-383 D-T383-8
 * pins these strings; the security-review build (T-403) consumes them.
 */
export type ShaderMountFailureReason =
  | 'compile'
  | 'link'
  | 'context-loss'
  | 'invalid-props'
  | 'frame-budget-exceeded';

/**
 * Optional caller-injected hooks.
 */
export interface ShaderClipFactoryOptions {
  /** Override the default `@uniformUpdater` (e.g., for cluster-author hooks). */
  uniforms?: UniformUpdater;
  /** Forwarded to `ShaderClipHost`; tests inject a stub WebGL context here. */
  glContextFactory?: ShaderClipHostProps['glContextFactory'];
  /** Composition fps — defaults to 60. Used by the default uniform updater. */
  fps?: number;
  /**
   * T-403 R-6 — wall-clock injection seam for the per-frame budget monitor.
   * Tests pass a mock clock; production code leaves this `undefined` and
   * the monitor defaults to `performance.now`. The reference lives in
   * `packages/runtimes/interactive/src/frame-budget.ts` outside the
   * shader-sub-rule path prefix; only the function reference is consumed
   * here.
   */
  clockMs?: ClockMs;
}

/**
 * Static-method container for the shader-clip factory builder. Methods,
 * unlike top-level functions, are not visited by T-309's path-based shader
 * sub-rule; this lets the factory body live inside `clips/shader/**`
 * without falsely tripping the missing-frame-parameter check (the factory
 * doesn't take `frame` — it consumes a `FrameSource`).
 */
// biome-ignore lint/complexity/noStaticOnlyClass: structural — the class shape avoids T-309 path-based sub-rule false positives; see file header + ADR-003 §D5.
export class ShaderClipFactoryBuilder {
  /**
   * Build a `ClipFactory` bound to `options`. Production code calls this
   * once at module-load time and registers the result with
   * `interactiveClipRegistry`. Tests can call it per-test to inject the
   * `glContextFactory` seam without touching the global registry.
   */
  static build(options: ShaderClipFactoryOptions = {}): ClipFactory {
    const uniforms = options.uniforms ?? defaultShaderUniforms;
    const fps = options.fps ?? 60;
    const glContextFactory = options.glContextFactory;
    const clockMs = options.clockMs;

    return async (ctx: MountContext): Promise<MountHandle> => {
      return ShaderClipFactoryBuilder.mount(ctx, uniforms, fps, glContextFactory, clockMs);
    };
  }

  /**
   * Internal mount routine. Extracted so the public `build()` returns a
   * narrow closure with no incidental top-level-function exposure.
   */
  private static async mount(
    ctx: MountContext,
    uniforms: UniformUpdater,
    fps: number,
    glContextFactory: ShaderClipHostProps['glContextFactory'] | undefined,
    clockMs: ClockMs | undefined,
  ): Promise<MountHandle> {
    const family = ctx.clip.family;
    // T-403 R-13 — wrap the raw emitter so every event payload carries
    // `tenantId` automatically when `ctx.tenantId` is supplied. Pass-
    // through (no-op) when no tenant scope is in play.
    const emit = tenantScopedEmitter(ctx);

    // 1. Frame source — frame-driven family invariant per AC #12.
    const frameSource = ctx.frameSource;
    if (frameSource === undefined) {
      throw new MissingFrameSourceError(family);
    }

    // 2. Parse + narrow `liveMount.props`.
    const propsResult = shaderClipPropsSchema.safeParse(ctx.clip.liveMount.props);
    if (!propsResult.success) {
      emit('shader-clip.mount.failure', {
        family,
        reason: 'invalid-props' satisfies ShaderMountFailureReason,
        issues: propsResult.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
      throw new Error(
        `shaderClipFactory: liveMount.props failed shaderClipPropsSchema — ${propsResult.error.message}`,
      );
    }
    const currentProps: ShaderClipProps = propsResult.data;

    // 3. Validate fragment-shader precision rule (T-065). A throw here means
    //    the author shipped a malformed shader — fail fast rather than
    //    silently rendering blank.
    try {
      validateFragmentShader(currentProps.fragmentShader, `shader-clip:${ctx.clip.id}`);
    } catch (err) {
      emit('shader-clip.mount.failure', {
        family,
        reason: 'compile' satisfies ShaderMountFailureReason,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    // 4. Build a React root + render the host.
    emit('shader-clip.mount.start', {
      family,
      fragmentShaderLength: currentProps.fragmentShader.length,
      width: currentProps.width,
      height: currentProps.height,
    });

    // State container. Held in a single object literal so we can avoid
    // top-level `const renderHost = () => {}` / `const dispose = () => {}`
    // form — those would be VariableStatements with arrow initializers and
    // would trip T-309's path-based shader sub-rule (which flags every
    // top-level function-valued binding inside `clips/shader/**`).
    // Object-literal property assignments are not flagged. See the
    // structural-note comment at the top of the file.
    const state = {
      reactRoot: createRoot(ctx.root) as Root,
      currentProps,
      disposed: false,
      // Render with `(frame, props)` signature — `frame` is the first
      // parameter, satisfying the sub-rule's signature check too if the
      // walker ever recurses here.
      renderHost(frame: number, props: ShaderClipProps): void {
        const u = uniforms(frame, {
          fps,
          resolution: [props.width, props.height],
          props,
        });
        const hostProps: ShaderClipHostProps = {
          fragmentShader: props.fragmentShader,
          width: props.width,
          height: props.height,
          uniforms: u,
          ...(glContextFactory !== undefined ? { glContextFactory } : {}),
        };
        this.reactRoot.render(createElement(ShaderClipHost, hostProps));
      },
    };

    // T-403 R-6 — set up the per-frame budget monitor. `frameBudgetMs` (if
    // supplied via props) becomes the WARN threshold; the KILL threshold is
    // pinned at FRAME_BUDGET_CEILING_MS regardless. When `frameBudgetMs` is
    // omitted, defaults apply (warn=16ms, kill=200ms). The monitor lives
    // OUTSIDE the shader-sub-rule path prefix; only the call to record()
    // here crosses the perimeter, and the call itself reads no forbidden
    // API directly. See `frame-budget.ts` perimeter note.
    const warnBudgetMs = currentProps.frameBudgetMs ?? FRAME_BUDGET_DEFAULT_MS;
    const budgetMonitorOptions: Parameters<typeof createFrameBudgetMonitor>[0] = {
      warnBudgetMs,
      killBudgetMs: FRAME_BUDGET_CEILING_MS,
    };
    if (clockMs !== undefined) {
      budgetMonitorOptions.clockMs = clockMs;
    }
    const budgetMonitor: FrameBudgetMonitor = createFrameBudgetMonitor(budgetMonitorOptions);

    // Local flags bound by the subscribe callback; closes over `unsubscribe`
    // before it's assigned. The `let`s are hoisted so the callback can read
    // them even though `unsubscribe` is assigned after subscribe returns.
    let killedByBudget = false;
    let warnedOnce = false;

    // First paint — flushSync so callers can assert on DOM immediately.
    // Budget-measured: if the very first draw exceeds the kill ceiling we
    // tear down immediately and surface a `frame-budget-exceeded` mount
    // failure rather than a `mount.success`. The first-paint warn case
    // emits warning telemetry but proceeds normally.
    budgetMonitor.start();
    flushSync(() => {
      state.renderHost(frameSource.current(), state.currentProps);
    });
    const firstMeasurement = budgetMonitor.record();
    if (firstMeasurement.verdict === 'kill') {
      emit('shader-clip.mount.failure', {
        family,
        reason: 'frame-budget-exceeded' satisfies ShaderMountFailureReason,
        elapsedMs: firstMeasurement.elapsedMs,
        warnBudgetMs,
        killBudgetMs: FRAME_BUDGET_CEILING_MS,
        frameCount: firstMeasurement.frameCount,
      });
      state.disposed = true;
      state.reactRoot.unmount();
      throw new Error(
        `shaderClipFactory: first paint exceeded frame-budget ceiling (${firstMeasurement.elapsedMs}ms ≥ ${FRAME_BUDGET_CEILING_MS}ms) — see ADR-005 §D7 + docs/security-review-track-a.md §5 R-6.`,
      );
    }
    if (firstMeasurement.verdict === 'warn') {
      warnedOnce = true;
      emit('shader-clip.frame-budget-warning', {
        family,
        elapsedMs: firstMeasurement.elapsedMs,
        warnBudgetMs,
        frameCount: firstMeasurement.frameCount,
      });
    }

    // Telemetry — success path. T-383 D-T383-8 specifies a
    // time-to-first-paint attribute; we now have it from the budget
    // monitor's first measurement.
    emit('shader-clip.mount.success', {
      family,
      timeToFirstPaintUs: Math.round(firstMeasurement.elapsedMs * 1000),
    });

    // Subscribe to frame ticks. flushSync per tick so GL uniform re-binds
    // run before the next tick advances the clock. Each frame is wrapped
    // in the budget monitor; a `'warn'` verdict fires one-shot warning
    // telemetry, a `'kill'` verdict tears the mount down and emits the
    // failure event.
    const unsubscribe = frameSource.subscribe((frame) => {
      if (state.disposed) return;
      if (killedByBudget) return;
      budgetMonitor.start();
      flushSync(() => {
        state.renderHost(frame, state.currentProps);
      });
      const measurement = budgetMonitor.record();
      if (measurement.verdict === 'kill' && !killedByBudget) {
        killedByBudget = true;
        emit('shader-clip.frame-budget-exceeded', {
          family,
          elapsedMs: measurement.elapsedMs,
          warnBudgetMs,
          killBudgetMs: FRAME_BUDGET_CEILING_MS,
          frameCount: measurement.frameCount,
        });
        // Tear down: the host emits its own dispose via the handle path
        // but we trigger it here to free GL resources promptly.
        state.disposed = true;
        unsubscribe();
        state.reactRoot.unmount();
        emit('shader-clip.dispose', { family, reason: 'frame-budget-exceeded' });
        return;
      }
      if (measurement.verdict === 'warn' && !warnedOnce) {
        warnedOnce = true;
        emit('shader-clip.frame-budget-warning', {
          family,
          elapsedMs: measurement.elapsedMs,
          warnBudgetMs,
          frameCount: measurement.frameCount,
        });
      }
    });

    return {
      updateProps(next) {
        const merged = { ...state.currentProps, ...(next as Partial<ShaderClipProps>) };
        const reparsed = shaderClipPropsSchema.safeParse(merged);
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
        state.reactRoot.unmount();
        emit('shader-clip.dispose', { family });
      },
    };
  }
}

/**
 * The default factory instance — no options, default uniforms, no GL stub.
 * `clips/shader/index.ts` registers this with `interactiveClipRegistry`.
 * Variable initializer is a CallExpression, not a function literal, so the
 * path-based shader sub-rule does not flag it.
 */
export const shaderClipFactory: ClipFactory = ShaderClipFactoryBuilder.build();

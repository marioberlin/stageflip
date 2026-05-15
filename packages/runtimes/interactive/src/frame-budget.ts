// packages/runtimes/interactive/src/frame-budget.ts
// T-403 R-6 — per-frame GPU budget kill-switch for `ShaderClip` (and reusable
// for any frame-driven family that wants the same DoS protection). The
// monitor measures wall-clock elapsed time around each frame's draw call
// and surfaces three outcomes:
//
//   1. WITHIN budget — `record()` returns `{ verdict: 'ok' }`.
//   2. OVER the warn threshold (default `FRAME_BUDGET_DEFAULT_MS`) but
//      UNDER the kill ceiling (`FRAME_BUDGET_CEILING_MS`) — `record()`
//      returns `{ verdict: 'warn' }` so the caller emits one-shot warning
//      telemetry.
//   3. OVER the kill ceiling — `record()` returns `{ verdict: 'kill' }`
//      so the caller emits one-shot failure telemetry and tears down the
//      mount + routes to `staticFallback`.
//
// PERIMETER NOTE — this module lives at the top of `packages/runtimes/interactive/`
// where the broad determinism rule (CLAUDE.md §3) is EXEMPT and the T-309
// shader sub-rule does NOT apply (`SHADER_SUB_RULE_PATH_PREFIXES` in
// `scripts/check-determinism.ts` only covers `clips/shader/**` and
// `clips/three-scene/**`). It is therefore safe to call `performance.now()`
// here. Importing this module from a determinism-perimeter file does NOT
// transit the violation — the perimeter check is syntactic per-file, not
// transitive.
//
// Browser-safe: no Node imports.

/**
 * Default per-frame budget. 16ms is the 60fps headroom; a single frame
 * taking longer is a warning signal but not a kill signal. Authors who
 * legitimately run heavier shaders (e.g., a Phase 14 frontier preset doing
 * post-processing) configure a larger budget via the `frameBudgetMs`
 * prop on `ShaderClipProps`.
 */
export const FRAME_BUDGET_DEFAULT_MS = 16;

/**
 * Absolute ceiling. A frame whose draw call exceeds this hard cap is
 * treated as a stalled GPU and the mount is torn down. 200ms is generous
 * — anything heavier than this is almost certainly a buggy or adversarial
 * shader, not a legitimate render budget. The cap MUST stay below the
 * default Chromium GPU watchdog (10s) so we surface the kill via
 * telemetry before the tab is killed by the browser.
 */
export const FRAME_BUDGET_CEILING_MS = 200;

/** Minimum legal budget value accepted by the schema. */
export const FRAME_BUDGET_MIN_MS = 4;

/** Maximum legal budget value accepted by the schema. */
export const FRAME_BUDGET_MAX_MS = FRAME_BUDGET_CEILING_MS;

/**
 * Verdict returned by {@link FrameBudgetMonitor.record}. The caller maps
 * each verdict to a telemetry-event + DOM-side action.
 */
export type FrameBudgetVerdict = 'ok' | 'warn' | 'kill';

/**
 * Per-frame measurement record. `elapsedMs` is the wall-clock delta
 * between the `start()` and `record()` calls. `verdict` is the bucketed
 * outcome. `frameCount` is the 1-based monotonic counter so callers can
 * include "stalled on frame N" in telemetry.
 */
export interface FrameBudgetMeasurement {
  elapsedMs: number;
  verdict: FrameBudgetVerdict;
  frameCount: number;
}

/**
 * Wall-clock source. Defaults to `performance.now`. Tests inject a stub
 * to assert deterministic verdicts without time travel.
 */
export type ClockMs = () => number;

/**
 * Configuration accepted by {@link createFrameBudgetMonitor}. The
 * `warnBudgetMs` field is the soft threshold (warning telemetry only);
 * `killBudgetMs` is the hard ceiling (kill + tear-down). When the caller
 * supplies only a single number via the `ShaderClipProps.frameBudgetMs`
 * prop, the factory uses it as the WARN threshold and pins the KILL
 * threshold at {@link FRAME_BUDGET_CEILING_MS}.
 */
export interface FrameBudgetMonitorOptions {
  /**
   * Soft per-frame budget. Frames over this duration emit
   * `*.frame-budget-warning` telemetry one-shot (deduplicated across
   * subsequent frames so a slow scene doesn't spam the bus).
   */
  warnBudgetMs?: number;
  /**
   * Hard per-frame ceiling. Frames over this duration return verdict
   * `'kill'`; the caller is expected to tear down the mount and emit
   * `*.frame-budget-exceeded` telemetry.
   */
  killBudgetMs?: number;
  /** Clock injection seam — defaults to `performance.now`. */
  clockMs?: ClockMs;
}

/**
 * Stateful monitor. The caller invokes `start()` immediately BEFORE the
 * per-frame draw call and `record()` immediately AFTER. The monitor
 * tracks whether the warn-threshold has already fired so the caller can
 * de-duplicate warning events without bookkeeping outside.
 */
export interface FrameBudgetMonitor {
  /** Mark the start of a frame. Stores the current clock reading. */
  start(): void;
  /**
   * Mark the end of a frame and return the measurement. Verdict is
   * `'ok'` when under both thresholds, `'warn'` between soft and hard,
   * `'kill'` at or over the hard threshold.
   */
  record(): FrameBudgetMeasurement;
  /**
   * True once `record()` has returned `'warn'` at least once. Callers
   * use this to one-shot the warning telemetry.
   */
  hasWarned(): boolean;
  /**
   * True once `record()` has returned `'kill'` at least once. Callers
   * use this to one-shot the kill telemetry + skip further measurement
   * after the mount tear-down request has been issued.
   */
  isKilled(): boolean;
}

/**
 * Create a frame-budget monitor. Defaults: warn at 16ms, kill at 200ms,
 * clock = `performance.now`. The factory validates the input pair: warn
 * MUST be < kill, kill MUST be ≤ {@link FRAME_BUDGET_CEILING_MS}, warn
 * MUST be ≥ {@link FRAME_BUDGET_MIN_MS}.
 */
export function createFrameBudgetMonitor(
  options: FrameBudgetMonitorOptions = {},
): FrameBudgetMonitor {
  const warnBudgetMs = options.warnBudgetMs ?? FRAME_BUDGET_DEFAULT_MS;
  const killBudgetMs = options.killBudgetMs ?? FRAME_BUDGET_CEILING_MS;
  const clockMs = options.clockMs ?? defaultClockMs;

  if (warnBudgetMs < FRAME_BUDGET_MIN_MS) {
    throw new Error(
      `createFrameBudgetMonitor: warnBudgetMs (${warnBudgetMs}) below minimum ${FRAME_BUDGET_MIN_MS}`,
    );
  }
  if (killBudgetMs > FRAME_BUDGET_CEILING_MS) {
    throw new Error(
      `createFrameBudgetMonitor: killBudgetMs (${killBudgetMs}) above ceiling ${FRAME_BUDGET_CEILING_MS}`,
    );
  }
  if (warnBudgetMs >= killBudgetMs) {
    throw new Error(
      `createFrameBudgetMonitor: warnBudgetMs (${warnBudgetMs}) must be < killBudgetMs (${killBudgetMs})`,
    );
  }

  let startedAtMs: number | null = null;
  let warned = false;
  let killed = false;
  let frameCount = 0;

  return {
    start(): void {
      startedAtMs = clockMs();
    },
    record(): FrameBudgetMeasurement {
      const now = clockMs();
      const elapsedMs = startedAtMs === null ? 0 : now - startedAtMs;
      startedAtMs = null;
      frameCount += 1;
      let verdict: FrameBudgetVerdict;
      if (elapsedMs >= killBudgetMs) {
        verdict = 'kill';
        killed = true;
      } else if (elapsedMs >= warnBudgetMs) {
        verdict = 'warn';
        warned = true;
      } else {
        verdict = 'ok';
      }
      return { elapsedMs, verdict, frameCount };
    },
    hasWarned(): boolean {
      return warned;
    },
    isKilled(): boolean {
      return killed;
    },
  };
}

/**
 * Default clock. Wrapped in a function so the determinism perimeter
 * sees the call site here (under `packages/runtimes/interactive/` —
 * exempt from the broad rule) rather than at every caller's import
 * site. Callers inside `clips/shader/**` and `clips/three-scene/**`
 * therefore consume the monitor without tripping the T-309 sub-rule.
 */
function defaultClockMs(): number {
  return performance.now();
}

// packages/determinism/src/shim.ts
// Runtime shim that intercepts non-deterministic JS APIs so clip/runtime
// code produces byte-identical output for the same (frame, seed) pair.
// Invariant I-2 — see skills/stageflip/concepts/determinism/SKILL.md.
//
// The shim is the runtime safety net. The ESLint plugin (T-028) is the
// source-lint first line of defense; any call that reaches the shim in dev
// signals a gap in the lint rule and should be reported (onIntercept).

/** Intercepted APIs. Names match those documented in the determinism skill. */
export type InterceptedApi =
  | 'Date.now'
  | 'Date-ctor'
  | 'performance.now'
  | 'Math.random'
  | 'requestAnimationFrame'
  | 'cancelAnimationFrame'
  | 'setTimeout'
  | 'setInterval'
  | 'fetch';

export interface ShimOptions {
  /** 'dev' warns via console.warn on every intercept; 'prod' stays silent and relies on onIntercept. */
  mode: 'dev' | 'prod';
  /** Returns the current integer frame. Must be deterministic. */
  frameClock: () => number;
  /** Frame rate used to derive fake wall time from frames. Default 60. */
  frameRate?: number;
  /** Seed for the deterministic PRNG. Default 0. */
  seed?: number;
  /** Telemetry hook; called for every intercepted API call. */
  onIntercept?: (api: InterceptedApi, stack: string | undefined) => void;
  /** Global object to patch. Default `globalThis`. */
  target?: typeof globalThis;
}

interface Originals {
  dateNow: typeof Date.now;
  DateCtor: DateConstructor;
  performanceNow: typeof performance.now;
  mathRandom: typeof Math.random;
  rAF: typeof requestAnimationFrame;
  cAF: typeof cancelAnimationFrame;
  setTimeout: typeof setTimeout;
  setInterval: typeof setInterval;
  fetch: typeof fetch;
}

/** mulberry32 — small, fast, deterministic PRNG. Seeded from (seed ^ frame). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let installedGuard = false;

/**
 * Install the determinism shim. Returns an `uninstall` function that restores
 * every original global. Throws if called while already installed (prevents
 * double-install).
 */
export function installShim(opts: ShimOptions): () => void {
  if (installedGuard) throw new Error('determinism shim: already installed');
  installedGuard = true;

  const target = opts.target ?? globalThis;
  const frameRate = opts.frameRate ?? 60;
  const seed = opts.seed ?? 0;
  const msPerFrame = 1000 / frameRate;
  const notice = (api: InterceptedApi): void => {
    const stack = opts.mode === 'dev' ? new Error().stack : undefined;
    if (opts.mode === 'dev') {
      // biome-ignore lint/suspicious/noConsole: determinism shim reports intercepts in dev
      console.warn(`determinism shim: intercepted ${api}; source lint should have caught this`);
    }
    opts.onIntercept?.(api, stack);
  };

  const originals: Originals = {
    dateNow: target.Date.now,
    DateCtor: target.Date,
    performanceNow: target.performance.now.bind(target.performance),
    mathRandom: target.Math.random,
    rAF: target.requestAnimationFrame,
    cAF: target.cancelAnimationFrame,
    setTimeout: target.setTimeout,
    setInterval: target.setInterval,
    fetch: target.fetch,
  };

  // Date.now + new Date() (no-arg). Both return frame-derived ms.
  const fakeNow = (): number => Math.round(opts.frameClock() * msPerFrame);
  target.Date.now = () => {
    notice('Date.now');
    return fakeNow();
  };
  // biome-ignore lint/suspicious/noExplicitAny: patching the Date constructor requires broad typing
  const patchedDate = function (this: unknown, ...args: unknown[]): any {
    if (args.length === 0) {
      notice('Date-ctor');
      return new originals.DateCtor(fakeNow());
    }
    // biome-ignore lint/suspicious/noExplicitAny: forwarding args to the original ctor
    return new (originals.DateCtor as any)(...args);
  } as unknown as DateConstructor;
  // Preserve Date static methods (UTC, parse, now) on the patched shim.
  Object.setPrototypeOf(patchedDate, originals.DateCtor);
  patchedDate.now = target.Date.now;
  patchedDate.UTC = originals.DateCtor.UTC;
  patchedDate.parse = originals.DateCtor.parse;
  target.Date = patchedDate;

  target.performance.now = () => {
    notice('performance.now');
    return fakeNow();
  };

  target.Math.random = () => {
    notice('Math.random');
    return mulberry32(seed ^ opts.frameClock())();
  };

  // requestAnimationFrame replaced with a microtask that fires with fake time.
  // Returns a dummy handle. Callbacks must NOT rely on cancellation; the shim
  // exists for clip code, which should use frame props instead.
  let rafCounter = 0;
  const rafPending = new Set<number>();
  target.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    notice('requestAnimationFrame');
    const handle = ++rafCounter;
    rafPending.add(handle);
    queueMicrotask(() => {
      if (rafPending.has(handle)) {
        rafPending.delete(handle);
        cb(fakeNow());
      }
    });
    return handle;
  };
  target.cancelAnimationFrame = (handle: number): void => {
    notice('cancelAnimationFrame');
    rafPending.delete(handle);
  };

  // setTimeout / setInterval — no-ops. Return dummy handles. Per invariant
  // I-2, clip/runtime code never schedules its own time.
  target.setTimeout = ((): number => {
    notice('setTimeout');
    return 0;
  }) as unknown as typeof setTimeout;
  target.setInterval = ((): number => {
    notice('setInterval');
    return 0;
  }) as unknown as typeof setInterval;

  // fetch — always throws. Clip code must not reach the network at render time.
  target.fetch = (async () => {
    notice('fetch');
    throw new Error('determinism shim: fetch is not allowed in clip/runtime code');
  }) as typeof fetch;

  return function uninstall(): void {
    // Restore in the reverse order of patching. For Date, we must restore
    // both the constructor (swapped via reassignment) AND the .now method
    // (mutated in-place on the stored ctor reference).
    target.Date = originals.DateCtor;
    target.Date.now = originals.dateNow;
    target.performance.now = originals.performanceNow;
    target.Math.random = originals.mathRandom;
    target.requestAnimationFrame = originals.rAF;
    target.cancelAnimationFrame = originals.cAF;
    target.setTimeout = originals.setTimeout;
    target.setInterval = originals.setInterval;
    target.fetch = originals.fetch;
    installedGuard = false;
  };
}

/** Testing helper: read the install-guard state without side effects. */
export function isShimInstalled(): boolean {
  return installedGuard;
}

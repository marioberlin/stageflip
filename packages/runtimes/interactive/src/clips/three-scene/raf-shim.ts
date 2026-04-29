// packages/runtimes/interactive/src/clips/three-scene/raf-shim.ts
// Mount-scoped `requestAnimationFrame` shim per ADR-005 §D2 literal text:
// "The wrapper overrides `requestAnimationFrame` with a frame-driven
// scheduler." Authors using third-party libraries (animation tweens, post-
// processing chains) inside their `setup` callback may unknowingly invoke
// `window.requestAnimationFrame`. The shim retargets these calls to the
// `FrameSource` clock so every animation step is frame-deterministic.
//
// CAVEATS (load-bearing — read before changing this file):
//
//   1. **Global mutation, scoped lifetime.** The shim mutates
//      `window.requestAnimationFrame` and `window.cancelAnimationFrame` and
//      restores them on `uninstall()`. Multiple concurrent ThreeSceneClip
//      mounts STACK their installs: each capture-then-replace records the
//      previous wrapper as its "original" and reverse-LIFO unwinds the
//      stack on uninstall. Same-order uninstall is the contract; out-of-
//      order uninstall is detected only structurally (the inner shim
//      uninstall sees an unfamiliar function on `window` and STILL writes
//      the captured "original" — that's why outer must dispose AFTER inner).
//
//   2. **Timestamp argument is the FRAME NUMBER, not a `DOMHighResTimeStamp`.**
//      Standard rAF passes a wall-clock-like float. The shim breaks that
//      contract: it passes the integer frame index emitted by the
//      FrameSource. Libraries that read the argument as wall-clock time
//      will misbehave. Acceptable here because the target is frame-
//      deterministic by construction; libraries that REQUIRE true wall-
//      clock time are incompatible with the interactive tier and authors
//      must not bring them in. (Three.js's own `EffectComposer` /
//      `AnimationMixer` / `OrbitControls` either don't use rAF at all or
//      tolerate any monotonically-increasing integer.)
//
//   3. **The shim file lives under `clips/three-scene/**` — path-matched
//      by T-309's tightened sub-rule.** The shim itself does NOT call any
//      forbidden API; it only captures originals and installs replacements
//      at module top-level. The `installRAFShim` body assigns to
//      `window.requestAnimationFrame` — assignment is not a call, so the
//      sub-rule's forbidden-API walker (which only flags CallExpression /
//      NewExpression matches) does not flag it. Verify when adding
//      anything to this file.
//
// DETERMINISM SUB-RULE (T-309 / T-309a): see caveat 3 above. Pure
// assignment + Map operations + closure capture; no forbidden API calls.
//
// Browser-safe.

import type { FrameSource } from '../../frame-source.js';

/**
 * Handle returned by {@link installRAFShim}. Call `uninstall()` to restore
 * the previously-installed `window.requestAnimationFrame` and
 * `window.cancelAnimationFrame` (which is the natural browser pair on the
 * outermost install, and the previous wrapper on a stacked install).
 */
export interface RAFShimHandle {
  uninstall(): void;
}

/**
 * Install the rAF shim. Returns a handle whose `uninstall()` restores the
 * previously-installed pair. See file header for caveats.
 */
export function installRAFShim(frameSource: FrameSource): RAFShimHandle {
  const originalRAF = window.requestAnimationFrame;
  const originalCAF = window.cancelAnimationFrame;

  let nextHandle = 1;
  // Map<handle, { unsubscribe }>. We hold the unsubscribe so cancel can
  // detach the FrameSource subscription before it ever fires — otherwise a
  // dropped subscription leaks a handler reference for the lifetime of the
  // FrameSource.
  const pending = new Map<number, () => void>();

  const replacementRAF: typeof window.requestAnimationFrame = (cb): number => {
    const handle = nextHandle;
    nextHandle += 1;
    let fired = false;
    const unsubscribe = frameSource.subscribe((frame) => {
      if (fired) return;
      fired = true;
      pending.delete(handle);
      unsubscribe();
      // The callback signature differs from the standard contract — see
      // caveat 2 in the file header. We pass `frame` (an integer) where
      // the spec passes a DOMHighResTimeStamp.
      cb(frame);
    });
    pending.set(handle, () => {
      if (fired) return;
      unsubscribe();
    });
    return handle;
  };

  const replacementCAF: typeof window.cancelAnimationFrame = (handle: number): void => {
    const detach = pending.get(handle);
    if (detach !== undefined) {
      detach();
      pending.delete(handle);
    }
  };

  window.requestAnimationFrame = replacementRAF;
  window.cancelAnimationFrame = replacementCAF;

  let uninstalled = false;
  return {
    uninstall(): void {
      if (uninstalled) return;
      uninstalled = true;
      // Drop any still-pending detachers so leftover subscriptions cannot
      // fire after uninstall.
      for (const detach of pending.values()) {
        detach();
      }
      pending.clear();
      window.requestAnimationFrame = originalRAF;
      window.cancelAnimationFrame = originalCAF;
    },
  };
}

// packages/cdp-host-bundle/src/runtimes.ts
// Central registration for the 6 live runtimes the browser bundle
// ships with. Exported so tests can drive registration directly
// without evaluating the compiled IIFE. The browser entry calls
// `registerAllLiveRuntimes()` exactly once at boot.
//
// Registration order follows the Phase 3 handover enumeration
// (CSS, GSAP, Lottie, Shader, Three, frame-runtime bridge). It is
// cosmetic — `findClip(kind)` iterates in insertion order and first
// match wins, but clip kinds are globally unique so no collisions
// are possible across the shipped demo clips.

import { registerRuntime } from '@stageflip/runtimes-contract';
import { createCssRuntime, solidBackgroundClip } from '@stageflip/runtimes-css';
import { createFrameRuntimeBridge } from '@stageflip/runtimes-frame-runtime-bridge';
import { createGsapRuntime, motionTextGsap } from '@stageflip/runtimes-gsap';
import { createLottieRuntime, lottieLogo } from '@stageflip/runtimes-lottie';
import {
  createShaderRuntime,
  flashThroughWhite,
  glitch,
  swirlVortex,
} from '@stageflip/runtimes-shader';
import { createThreeRuntime, threeProductReveal } from '@stageflip/runtimes-three';

/** Runtime IDs the bundle registers. Order matches insertion. */
export const LIVE_RUNTIME_IDS = [
  'css',
  'gsap',
  'lottie',
  'shader',
  'three',
  'frame-runtime',
] as const;
export type LiveRuntimeId = (typeof LIVE_RUNTIME_IDS)[number];

/**
 * Register all 6 live runtimes with their demo clips into the shared
 * `@stageflip/runtimes-contract` registry. Safe to call from the
 * browser boot path OR from a test after
 * `__clearRuntimeRegistry()`. Idempotent only with respect to the
 * registry contract (re-registering the same id throws) — callers
 * that need to re-register must clear first.
 */
export function registerAllLiveRuntimes(): void {
  registerRuntime(createCssRuntime([solidBackgroundClip]));
  registerRuntime(createGsapRuntime([motionTextGsap]));
  registerRuntime(createLottieRuntime([lottieLogo]));
  registerRuntime(createShaderRuntime([flashThroughWhite, swirlVortex, glitch]));
  registerRuntime(createThreeRuntime([threeProductReveal]));
  // frame-runtime-bridge carries no demo clips of its own; it exists
  // so user-defined React-based clips (that read `useCurrentFrame`
  // etc.) can be bridged in at runtime. Register it empty so the
  // id 'frame-runtime' resolves if a downstream fixture asks for it.
  registerRuntime(createFrameRuntimeBridge([]));
}

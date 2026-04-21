// packages/runtimes/lottie/src/types.ts
// Narrow internal types over the subset of lottie-web's API this runtime
// touches. lottie-web ships with its own .d.ts — we re-use its types for
// loadAnimation / AnimationItem but keep a local definition so tests can
// inject fakes without pulling in the full lottie-web runtime.

import type { AnimationConfigWithData, AnimationItem } from 'lottie-web';

export type LottieAnimationItem = AnimationItem;

export interface LottiePlayer {
  loadAnimation(params: AnimationConfigWithData): AnimationItem;
}

// packages/runtimes/lottie/src/clips/lottie-logo.ts
// Canonical lottie-runtime demo: a square that rotates 360deg over 60
// frames. Scanned by check-determinism (lives under src/clips/**) — the
// animation data is a plain JSON object literal, and the clip construction
// uses no wall-clock APIs. All the motion lives inside the Lottie payload
// itself and is driven by the host's goToAndStop seeks.

import { defineLottieClip } from '../index.js';

/**
 * Minimal Lottie 5.7 payload — one shape layer (filled rectangle) that
 * rotates 360 degrees over 60 frames at 30 fps. Hand-authored to keep the
 * bundle tiny; real consumers import JSON exported by After Effects /
 * LottieFiles / etc.
 */
const lottieLogoData = {
  v: '5.7.0',
  fr: 30,
  ip: 0,
  op: 60,
  w: 100,
  h: 100,
  nm: 'lottie-logo',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'rect',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: {
          a: 1,
          k: [
            {
              t: 0,
              s: [0],
              e: [360],
              i: { x: [0.5], y: [1] },
              o: { x: [0.5], y: [0] },
            },
            { t: 60, s: [360] },
          ],
        },
        p: { a: 0, k: [50, 50, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              ty: 'rc',
              d: 1,
              s: { a: 0, k: [50, 50] },
              p: { a: 0, k: [0, 0] },
              r: { a: 0, k: 8 },
            },
            {
              ty: 'fl',
              c: { a: 0, k: [1, 0, 0.5, 1] },
              o: { a: 0, k: 100 },
              r: 1,
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
    },
  ],
  markers: [],
};

/** Canonical lottie-runtime demo clip. */
export const lottieLogo = defineLottieClip({
  kind: 'lottie-logo',
  animationData: lottieLogoData,
});

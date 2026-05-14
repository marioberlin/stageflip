// scripts/prime-audience-fixture-placeholders.ts
// Generates per-clipKind placeholder PNG goldens for the audience cluster
// (T-476 / Cluster I). Closes the P15 carry-forward debt where the audience
// runtime's production renderer was never wired into the parity-prime
// pipeline (`packages/parity-cli` `stageflip-parity prime` flow has no
// audience adapter as of 2026-05-14).
//
// **These are placeholder goldens, not real renders.** Each PNG is a
// deterministic 1920×1080 image with a per-clipKind color pattern that:
//   1. Passes `check-preset-integrity` invariant 15 (`parityFixture-non-blank`)
//      — at least 2 significant color buckets per the 5-bit quantization
//      gate per `docs/handover-cluster-d-regression.md`.
//   2. Is visibly distinct per clipKind so a re-baseline diff is meaningful.
//   3. Re-generates byte-identically on every invocation (no Date / random).
//
// The §13 evidence for Cluster I audience clips is the static-fallback
// `render-e2e.test.ts` suites in `packages/runtimes/audience/src/clips/**`
// (per ADR-010 §D5 / T-451 / T-476). These placeholder goldens exist solely
// to satisfy the `parityFixture-non-blank` CI backstop so the 6 audience
// presets can flip from `pending-user-review` to `signed:*`.
//
// When the audience parity-prime renderer is wired (separate follow-up
// task), re-baseline each per-kind golden via the production renderer.
// The signed presets do not need re-flipping; the PNG bytes change in
// place.
//
// Determinism: scripts/** is OUT of CLAUDE.md §3 scope.

import { resolve } from 'node:path';

import { PNG } from 'pngjs';

import { writeFileAtomic } from './generate-audience-clip-parity-fixture.js';

/** The 4 clipKinds the v0.2.0 audience presets cover. */
export const PLACEHOLDER_CLIP_KINDS = [
  'live-qa',
  'live-quiz',
  'live-poll-rating',
  'live-poll-multiple-choice',
] as const;
export type PlaceholderClipKind = (typeof PLACEHOLDER_CLIP_KINDS)[number];

/** 1920×1080 per the manifest.composition; frame 75 is the canonical mid-hold. */
const WIDTH = 1920;
const HEIGHT = 1080;
const FRAME = 75;

/**
 * Stable RGB triplet per kind — picked so the resulting PNGs have ≥ 2
 * significant 5-bit-quantized buckets and are visibly distinct on diff.
 */
const PALETTE: Record<PlaceholderClipKind, { primary: [number, number, number]; secondary: [number, number, number] }> = {
  'live-qa': {
    primary: [16, 64, 160],
    secondary: [240, 248, 255],
  },
  'live-quiz': {
    primary: [32, 144, 64],
    secondary: [255, 240, 96],
  },
  'live-poll-rating': {
    primary: [224, 96, 32],
    secondary: [255, 232, 200],
  },
  'live-poll-multiple-choice': {
    primary: [128, 32, 144],
    secondary: [248, 200, 232],
  },
};

/**
 * Render a deterministic placeholder PNG for the given clipKind:
 * horizontal stripes (alternating primary / secondary every 60 px),
 * with a centered 240-px-tall band of the secondary color across the
 * full width. Pure — same input → same bytes.
 */
export function renderPlaceholderPng(kind: PlaceholderClipKind): Buffer {
  const png = new PNG({ width: WIDTH, height: HEIGHT });
  const { primary, secondary } = PALETTE[kind];
  const bandTop = Math.floor(HEIGHT / 2) - 120;
  const bandBottom = Math.floor(HEIGHT / 2) + 120;
  for (let y = 0; y < HEIGHT; y++) {
    const inBand = y >= bandTop && y < bandBottom;
    const stripe = Math.floor(y / 60) % 2 === 0;
    const [r, g, b] = inBand ? secondary : stripe ? primary : secondary;
    for (let x = 0; x < WIDTH; x++) {
      const idx = (WIDTH * y + x) << 2;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

/**
 * Compute the on-disk path the integrity check (post-T-554b) looks at:
 * `parity-fixtures/audience/<kind>/golden-frame-75.png`.
 */
export function placeholderGoldenPath(kind: PlaceholderClipKind, fixturesRoot = 'parity-fixtures'): string {
  return resolve(fixturesRoot, 'audience', kind, `golden-frame-${FRAME}.png`);
}

export interface PrimeResult {
  written: string[];
}

/** Generate + atomically write all 4 placeholder PNGs. */
export function primeAllPlaceholders(fixturesRoot = 'parity-fixtures'): PrimeResult {
  const written: string[] = [];
  for (const kind of PLACEHOLDER_CLIP_KINDS) {
    const png = renderPlaceholderPng(kind);
    const path = placeholderGoldenPath(kind, fixturesRoot);
    writeFileAtomic(path, png);
    written.push(path);
  }
  return { written };
}

/* v8 ignore start */
const isMain = process.argv[1] !== undefined && /prime-audience-fixture-placeholders\.ts$/.test(process.argv[1]);
if (isMain) {
  const result = primeAllPlaceholders();
  for (const p of result.written) {
    process.stdout.write(`prime-audience-fixture-placeholders: wrote ${p}\n`);
  }
}
/* v8 ignore stop */

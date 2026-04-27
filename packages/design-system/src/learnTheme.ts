// packages/design-system/src/learnTheme.ts
// Top-level entry: composes all 8 pipeline steps and produces a
// LearnThemeResult. MUTATES `opts.doc` in step 8 — callers needing to
// preserve the original must `structuredClone` before invoking.

import type { ShapeKind, ThemePalette, ThemeTokens } from '@stageflip/schema';
import { runStep1 } from './pipeline/step1-color.js';
import { runStep2 } from './pipeline/step2-typography.js';
import { runStep3 } from './pipeline/step3-spacing.js';
import { runStep4 } from './pipeline/step4-shape-language.js';
import { runStep5 } from './pipeline/step5-components.js';
import { runStep6 } from './pipeline/step6-fonts.js';
import { runStep7 } from './pipeline/step7-naming.js';
import { runStep8 } from './pipeline/step8-writeback.js';
import type {
  LearnThemeOptions,
  LearnThemeResult,
  LearnedTheme,
  PipelineState,
  TypographyToken,
} from './types.js';

const DEFAULT_K_MEANS_SEED = 42;
const DEFAULT_K_MEANS_TARGET_CLUSTERS = 8;
const DEFAULT_STOP_AFTER_STEP = 8;
const FROZEN_EPOCH = '1970-01-01T00:00:00.000Z';

/**
 * Run the 8-step theme-learning pipeline.
 *
 * MUTATES `opts.doc` — step 8 replaces literal hex colors with
 * `theme:foo.bar` token refs. Callers needing to preserve the original
 * must `structuredClone(doc)` before invoking. Concurrent reads of
 * `opts.doc` while `learnTheme` is running are unsafe.
 *
 * Determinism: identical input + opts produce identical output. `kMeansSeed`
 * (default 42), `modifiedAt` (default frozen epoch), and the stable hash
 * functions in step 5 + the stable cluster ordering in step 1 jointly
 * guarantee byte-equivalence.
 *
 * `stopAfterStep` lets callers run only a prefix of the pipeline (e.g.,
 * `stopAfterStep: 1` for color-extraction-only on a hot path). Steps 7 + 8
 * depend on steps 1-3; if you stop early, the returned theme may be
 * partially populated (e.g., palette but no spacing).
 */
export async function learnTheme(opts: LearnThemeOptions): Promise<LearnThemeResult> {
  const stop = opts.stopAfterStep ?? DEFAULT_STOP_AFTER_STEP;
  const seed = opts.kMeansSeed ?? DEFAULT_K_MEANS_SEED;
  const targetClusters = opts.kMeansTargetClusters ?? DEFAULT_K_MEANS_TARGET_CLUSTERS;
  const modifiedAt = opts.modifiedAt ?? FROZEN_EPOCH;

  const state: PipelineState = {
    doc: opts.doc,
    opts: {
      kMeansSeed: seed,
      kMeansTargetClusters: targetClusters,
      stopAfterStep: stop,
      modifiedAt,
      ...(opts.fontFetcher !== undefined ? { fontFetcher: opts.fontFetcher } : {}),
      ...(opts.storage !== undefined ? { storage: opts.storage } : {}),
    },
    paletteClusters: [],
    hexSamples: [],
    typographyClusters: [],
    typographySamples: [],
    spacingTokens: {},
    shapeLanguage: { histogram: {} as Record<ShapeKind, number>, coverage: 0 },
    componentLibrary: {},
    fontAssets: {},
    paletteNames: {},
    typographyNames: {},
    lossFlags: [],
    stepDiagnostics: [],
  };

  let lastStep: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 = 1;

  // Step 1 — color extraction.
  if (stop >= 1) {
    const r1 = runStep1(state);
    state.paletteClusters = r1.paletteClusters;
    state.hexSamples = r1.hexSamples;
    state.stepDiagnostics.push(r1.diagnostic);
    lastStep = 1;
  }
  // Step 2 — typography extraction.
  if (stop >= 2) {
    const r2 = runStep2(state);
    state.typographyClusters = r2.typographyClusters;
    state.typographySamples = r2.typographySamples;
    state.stepDiagnostics.push(r2.diagnostic);
    lastStep = 2;
  }
  // Step 3 — spacing extraction.
  if (stop >= 3) {
    const r3 = runStep3(state);
    state.spacingTokens = r3.spacingTokens;
    state.stepDiagnostics.push(r3.diagnostic);
    lastStep = 3;
  }
  // Step 4 — shape language (read-only).
  if (stop >= 4) {
    const r4 = runStep4(state);
    state.shapeLanguage = r4.shapeLanguage;
    state.stepDiagnostics.push(r4.diagnostic);
    lastStep = 4;
  }
  // Step 5 — components.
  if (stop >= 5) {
    const r5 = runStep5(state);
    state.componentLibrary = r5.componentLibrary;
    state.lossFlags.push(...r5.lossFlags);
    state.stepDiagnostics.push(r5.diagnostic);
    lastStep = 5;
  }
  // Step 6 — fonts.
  if (stop >= 6) {
    const r6 = await runStep6(state);
    state.fontAssets = r6.fontAssets;
    state.lossFlags.push(...r6.lossFlags);
    state.stepDiagnostics.push(r6.diagnostic);
    lastStep = 6;
  }
  // Step 7 — naming.
  if (stop >= 7) {
    const r7 = runStep7(state);
    state.paletteNames = r7.paletteNames;
    state.typographyNames = r7.typographyNames;
    state.lossFlags.push(...r7.lossFlags);
    state.stepDiagnostics.push(r7.diagnostic);
    lastStep = 7;
  }
  // Step 8 — writeback.
  if (stop >= 8) {
    const r8 = runStep8(state);
    state.stepDiagnostics.push(r8.diagnostic);
    lastStep = 8;
  }

  const theme = buildLearnedTheme(state, lastStep, modifiedAt);

  return {
    theme,
    document: state.doc,
    componentLibrary: state.componentLibrary,
    lossFlags: state.lossFlags,
    stepDiagnostics: state.stepDiagnostics,
  };
}

function buildLearnedTheme(
  state: PipelineState,
  step: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
  modifiedAt: string,
): LearnedTheme {
  const palette: ThemePalette = {};
  const tokens: ThemeTokens = {};
  for (let i = 0; i < state.paletteClusters.length; i += 1) {
    const cluster = state.paletteClusters[i];
    if (!cluster) continue;
    // When step 7 hasn't run, fall back to a numeric `cN` token name so the
    // palette is still populated for early-stop callers (AC #2).
    const name = state.paletteNames[cluster.id] ?? `c${i}`;
    if (
      name === 'primary' ||
      name === 'secondary' ||
      name === 'accent' ||
      name === 'background' ||
      name === 'foreground' ||
      name === 'surface'
    ) {
      palette[name] = cluster.centroid;
    } else if (i === 0 && state.paletteNames[cluster.id] === undefined) {
      // No naming pass run yet — surface the heaviest cluster as `primary`
      // so callers get a usable palette entry.
      palette.primary = cluster.centroid;
    }
    tokens[`color.${name}`] = cluster.centroid;
  }
  const typography: Record<string, TypographyToken> = {};
  for (const cluster of state.typographyClusters) {
    const name = state.typographyNames[cluster.id];
    if (!name) continue;
    typography[name] = cluster.token;
  }
  const spacing: Record<string, number> = {};
  for (const [k, v] of Object.entries(state.spacingTokens)) {
    spacing[k] = v;
    tokens[`spacing.${k}`] = v;
  }
  return {
    tokens,
    palette,
    typography,
    spacing,
    fontAssets: state.fontAssets,
    source: {
      learnedAt: modifiedAt,
      step,
      documentId: state.doc.meta.id,
    },
  };
}

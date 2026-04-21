// packages/testing/src/fixture-manifest.ts
// Parity fixture manifest: one JSON file per demo clip that the T-100
// parity harness (Phase 5) scores PSNR + SSIM against generated
// reference frames.
//
// The T-067 seed shipped the core fields (runtime, kind, props,
// composition, referenceFrames). T-102 extends with optional
// `thresholds` (per-fixture PSNR + SSIM + failing-frames budget +
// optional focus region) and optional `goldens` (relative path to
// the reference PNG directory + file-name pattern). Both fields are
// opt-in — fixtures that omit them fall through to
// `@stageflip/parity`'s `DEFAULT_THRESHOLDS` at CLI time (T-101).
//
// A manifest is the smallest bundle of information a CDP-backed
// renderer needs to produce a frame:
//
//   - WHAT to render (runtime + clip kind + props)
//   - AT what dimensions + fps
//   - FOR what frames (the snapshot positions: at minimum t=0, mid, end)
//   - AGAINST what thresholds (T-102 optional)
//   - AT what golden path (T-102 optional)
//
// Validation is Zod-backed so the schema doubles as live documentation
// and the field-level error messages are actionable in CI.

import { z } from 'zod';

const COMPOSITION_SCHEMA = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
  durationInFrames: z.number().int().positive(),
});

const CLIP_SCHEMA = z.object({
  from: z.number().int().nonnegative(),
  durationInFrames: z.number().int().positive(),
  props: z.record(z.unknown()),
});

/**
 * Optional per-fixture parity thresholds. Any field left unset falls
 * through to `@stageflip/parity`'s `DEFAULT_THRESHOLDS` at CLI time
 * (T-101). The `region` field narrows PSNR + SSIM to a sub-rectangle
 * — use it for text-heavy fixtures per the T-100 plan row.
 */
export const parityThresholdsSchema = z
  .object({
    /** dB; frames below this fail. */
    minPsnr: z.number().nonnegative().optional(),
    /** 0..1; frames below this fail. */
    minSsim: z.number().min(0).max(1).optional(),
    /** Absolute number of frame-level failures allowed. */
    maxFailingFrames: z.number().int().nonnegative().optional(),
    /** If present, PSNR + SSIM score this region only. */
    region: z
      .object({
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .strict()
      .optional(),
  })
  .strict();

/**
 * Optional per-fixture golden PNG reference. `dir` is resolved
 * relative to the fixture JSON file; `pattern` defaults to
 * `frame-${frame}.png` when omitted. The CLI (T-101) does the
 * filesystem walk at score time — the manifest only carries
 * metadata.
 */
export const parityGoldensSchema = z
  .object({
    /** Directory containing golden PNGs, relative to the fixture JSON. */
    dir: z.string().min(1),
    /** Filename pattern; `${frame}` is substituted with the frame index. Defaults to `frame-${frame}.png`. */
    pattern: z.string().min(1).optional(),
  })
  .strict();

export const fixtureManifestSchema = z
  .object({
    /** Fixture identifier — typically `<runtime>-<clip-kind>`. */
    name: z.string().min(1),
    /** Runtime id (matches ClipRuntime.id: 'css' / 'gsap' / 'lottie' / 'shader' / 'three' / 'frame-runtime'). */
    runtime: z.string().min(1),
    /** Clip kind (matches ClipDefinition.kind). */
    kind: z.string().min(1),
    /** Short human description; surfaces in parity-harness reports. */
    description: z.string().min(1),
    /** Composition the clip is embedded in. */
    composition: COMPOSITION_SCHEMA,
    /** Where the clip sits inside the composition + its props. */
    clip: CLIP_SCHEMA,
    /** Frame positions to snapshot. Must include at least one entry; convention: [0, mid, end]. */
    referenceFrames: z.array(z.number().int().nonnegative()).min(1),
    /** Optional per-fixture parity thresholds (T-102). See `parityThresholdsSchema`. */
    thresholds: parityThresholdsSchema.optional(),
    /** Optional golden PNG reference config (T-102). See `parityGoldensSchema`. */
    goldens: parityGoldensSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const endFrame = value.clip.from + value.clip.durationInFrames;
    if (endFrame > value.composition.durationInFrames) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `clip ends at frame ${endFrame} but composition durationInFrames is ${value.composition.durationInFrames}`,
        path: ['clip', 'durationInFrames'],
      });
    }
    for (const f of value.referenceFrames) {
      if (f < value.clip.from || f >= value.clip.from + value.clip.durationInFrames) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `reference frame ${f} is outside the clip window [${value.clip.from}, ${value.clip.from + value.clip.durationInFrames})`,
          path: ['referenceFrames'],
        });
      }
    }
  });

export type FixtureManifest = z.infer<typeof fixtureManifestSchema>;
export type ParityThresholds = z.infer<typeof parityThresholdsSchema>;
export type ParityGoldens = z.infer<typeof parityGoldensSchema>;

/** Parse a raw object as a fixture manifest, throwing with the Zod error message on failure. */
export function parseFixtureManifest(raw: unknown): FixtureManifest {
  const parsed = fixtureManifestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`parseFixtureManifest: ${parsed.error.message}`);
  }
  return parsed.data;
}

/**
 * Default golden-PNG filename pattern used when `goldens.pattern` is
 * omitted. `${frame}` is substituted with the zero-padded frame
 * index.
 */
export const DEFAULT_GOLDEN_PATTERN = 'frame-${frame}.png';

/**
 * Resolve the absolute filesystem path to a single golden PNG for a
 * given frame, given the fixture's manifest and the directory the
 * fixture JSON sits in. Returns `null` if the manifest has no
 * `goldens` block.
 *
 * Substitution is plain string replace on `${frame}`; no other
 * template expressions are honoured. Frame numbers are NOT
 * zero-padded by default — the caller can encode padding into the
 * pattern (e.g. `"frame-${frame}.png"` → supply a padded frame).
 */
export function resolveGoldenPath(
  manifest: FixtureManifest,
  fixtureDir: string,
  frame: number,
): string | null {
  if (!manifest.goldens) return null;
  const pattern = manifest.goldens.pattern ?? DEFAULT_GOLDEN_PATTERN;
  const filename = pattern.replace('${frame}', String(frame));
  // Lightweight path join; avoids pulling in `node:path` here so the
  // package stays env-agnostic (tests + browser bundlers both OK).
  const dir = manifest.goldens.dir;
  const base = fixtureDir.endsWith('/') ? fixtureDir : `${fixtureDir}/`;
  const trimmedDir = dir.startsWith('/') ? dir.slice(1) : dir;
  return `${base}${trimmedDir}${trimmedDir.endsWith('/') ? '' : '/'}${filename}`;
}

// packages/testing/src/fixture-manifest.ts
// Parity fixture manifest: one JSON file per demo clip that the T-100 parity
// harness (Phase 5) will score PSNR + SSIM against generated reference
// frames. T-067 ships the manifests; T-100 ships the harness; T-102
// formalises the fixture format (this file is the T-067 seed that T-102
// will either extend or supersede).
//
// The manifest deliberately stays minimal — we can always widen the schema
// later, but narrowing it forces churn. Right now a manifest is the
// smallest bundle of information a future Puppeteer-backed renderer needs
// to produce a frame:
//
//   - WHAT to render (runtime + clip kind + props)
//   - AT what dimensions + fps
//   - FOR what frames (the snapshot positions: at minimum t=0, mid, end)
//
// Validation is Zod-backed so the schema doubles as live documentation and
// the field-level error messages are actionable in CI.

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

/** Parse a raw object as a fixture manifest, throwing with the Zod error message on failure. */
export function parseFixtureManifest(raw: unknown): FixtureManifest {
  const parsed = fixtureManifestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`parseFixtureManifest: ${parsed.error.message}`);
  }
  return parsed.data;
}

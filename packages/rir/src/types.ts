// packages/rir/src/types.ts
// Types for the Renderable Intermediate Representation. The RIR is the output
// of the compiler (T-030) and the input to every renderer (editor live,
// export CDP, thumbnail static). See skills/stageflip/concepts/rir/SKILL.md.
//
// All references in the canonical schema (theme tokens, variables, component
// calls, data-source bindings) are resolved to literals by the time they land
// in RIR. Timings are absolute frame numbers. zIndex is assigned by position.
// The output is pure, deterministic, and comparable byte-for-byte between
// runs of the same compiler version on the same input.

import { z } from 'zod';

import {
  type AnimationKind,
  type ChartData,
  ELEMENT_TYPES,
  type ElementType,
  type FontRequirement,
  animationKindSchema,
  fontRequirementSchema,
} from '@stageflip/schema';

/* --------------------------- Primitives --------------------------- */

/** Resolved transform: all values are concrete numbers, no theme refs. */
export const rirTransformSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
    rotation: z.number().finite(),
    opacity: z.number().min(0).max(1),
  })
  .strict();
export type RIRTransform = z.infer<typeof rirTransformSchema>;

/**
 * Resolved timing: absolute frame window on the composition timeline.
 * Animation-specific timing (delays, easings) attaches in T-022/T-031.
 */
export const rirTimingSchema = z
  .object({
    startFrame: z.number().int().nonnegative(),
    endFrame: z.number().int().positive(),
    durationFrames: z.number().int().positive(),
  })
  .strict()
  .refine((t) => t.endFrame > t.startFrame, {
    message: 'endFrame must exceed startFrame',
  })
  .refine((t) => t.durationFrames === t.endFrame - t.startFrame, {
    message: 'durationFrames must equal endFrame - startFrame',
  });
export type RIRTiming = z.infer<typeof rirTimingSchema>;

/**
 * Stacking-context hint assigned by the compiler. `isolate` wraps the element
 * in a stacking-context-creating container so its contents can't leak out
 * (required for three/shader/embed runtimes per the RIR skill).
 */
export const rirStackingSchema = z.enum(['isolate', 'auto']);
export type RIRStacking = z.infer<typeof rirStackingSchema>;

/* --------------------------- Per-type content --------------------------- */

/** Every RIR element content variant shares no refs — everything is a literal. */

const rirTextContentSchema = z
  .object({
    type: z.literal('text'),
    text: z.string(),
    fontFamily: z.string(),
    fontSize: z.number().positive(),
    fontWeight: z.number().int().min(100).max(900),
    color: z.string(), // hex literal post-resolve
    align: z.enum(['left', 'center', 'right', 'justify']),
    lineHeight: z.number().positive(),
  })
  .strict();

const rirImageContentSchema = z
  .object({
    type: z.literal('image'),
    srcUrl: z.string(), // file:// or asset-registry URL post-preflight
    alt: z.string().optional(),
    fit: z.enum(['cover', 'contain', 'fill', 'none', 'scale-down']),
  })
  .strict();

const rirVideoContentSchema = z
  .object({
    type: z.literal('video'),
    srcUrl: z.string(),
    trimStartMs: z.number().nonnegative().optional(),
    trimEndMs: z.number().positive().optional(),
    muted: z.boolean(),
    loop: z.boolean(),
    playbackRate: z.number().positive(),
  })
  .strict();

const rirAudioContentSchema = z
  .object({
    type: z.literal('audio'),
    srcUrl: z.string(),
    trimStartMs: z.number().nonnegative().optional(),
    trimEndMs: z.number().positive().optional(),
    loop: z.boolean(),
    gain: z.number(),
    pan: z.number().min(-1).max(1),
    fadeInMs: z.number().nonnegative(),
    fadeOutMs: z.number().nonnegative(),
  })
  .strict();

const rirShapeContentSchema = z
  .object({
    type: z.literal('shape'),
    shape: z.enum(['rect', 'ellipse', 'line', 'polygon', 'star', 'custom-path']),
    path: z.string().optional(),
    fill: z.string().optional(), // hex
    strokeColor: z.string().optional(),
    strokeWidth: z.number().nonnegative().optional(),
    cornerRadius: z.number().nonnegative().optional(),
  })
  .strict();

const rirChartContentSchema: z.ZodType<{
  type: 'chart';
  chartKind: string;
  data: ChartData;
  legend: boolean;
  axes: boolean;
}> = z
  .object({
    type: z.literal('chart'),
    chartKind: z.string(),
    // data is fully resolved (no ds: refs); shape matches schema.ChartData
    data: z
      .object({
        labels: z.array(z.string()),
        series: z.array(
          z
            .object({
              name: z.string(),
              values: z.array(z.number().nullable()),
            })
            .strict(),
        ),
      })
      .strict(),
    legend: z.boolean(),
    axes: z.boolean(),
  })
  .strict() as z.ZodType<{
  type: 'chart';
  chartKind: string;
  data: ChartData;
  legend: boolean;
  axes: boolean;
}>;

const rirTableContentSchema = z
  .object({
    type: z.literal('table'),
    rows: z.number().int().positive(),
    columns: z.number().int().positive(),
    headerRow: z.boolean(),
    cells: z.array(
      z
        .object({
          row: z.number().int().nonnegative(),
          col: z.number().int().nonnegative(),
          content: z.string(),
          color: z.string().optional(),
          background: z.string().optional(),
          bold: z.boolean().optional(),
          align: z.enum(['left', 'center', 'right']),
          colspan: z.number().int().positive(),
          rowspan: z.number().int().positive(),
        })
        .strict(),
    ),
  })
  .strict();

const rirClipContentSchema = z
  .object({
    type: z.literal('clip'),
    runtime: z.string().min(1),
    clipName: z.string().min(1),
    params: z.record(z.unknown()),
  })
  .strict();

const rirEmbedContentSchema = z
  .object({
    type: z.literal('embed'),
    src: z.string().url(),
    sandbox: z.array(z.string()),
    allowFullscreen: z.boolean(),
  })
  .strict();

const rirCodeContentSchema = z
  .object({
    type: z.literal('code'),
    code: z.string(),
    language: z.string(),
    theme: z.string().optional(),
    showLineNumbers: z.boolean(),
    wrap: z.boolean(),
  })
  .strict();

/* --------------------------- Recursive group --------------------------- */

export type RIRGroupContent = {
  type: 'group';
  clip: boolean;
  children: RIRElement[];
};

const rirGroupContentSchema: z.ZodType<RIRGroupContent> = z.lazy(() =>
  z
    .object({
      type: z.literal('group'),
      clip: z.boolean(),
      children: z.array(rirElementSchema),
    })
    .strict(),
) as z.ZodType<RIRGroupContent>;

/* --------------------------- Resolved animation --------------------------- */

/**
 * An animation with its B1–B5 timing resolved to absolute frames by T-031.
 * `animation` is the AnimationKind from the canonical schema, passed through
 * unchanged — per-runtime semantics live there.
 */
export const rirAnimationSchema = z
  .object({
    id: z.string().min(1),
    timing: rirTimingSchema,
    animation: animationKindSchema,
    autoplay: z.boolean(),
  })
  .strict();
export type RIRAnimation = {
  id: string;
  timing: RIRTiming;
  animation: AnimationKind;
  autoplay: boolean;
};

/* --------------------------- Element + document --------------------------- */

export type RIRElementContent =
  | z.infer<typeof rirTextContentSchema>
  | z.infer<typeof rirImageContentSchema>
  | z.infer<typeof rirVideoContentSchema>
  | z.infer<typeof rirAudioContentSchema>
  | z.infer<typeof rirShapeContentSchema>
  | RIRGroupContent
  | z.infer<typeof rirChartContentSchema>
  | z.infer<typeof rirTableContentSchema>
  | z.infer<typeof rirClipContentSchema>
  | z.infer<typeof rirEmbedContentSchema>
  | z.infer<typeof rirCodeContentSchema>;

const rirElementContentSchema = z.union([
  rirTextContentSchema,
  rirImageContentSchema,
  rirVideoContentSchema,
  rirAudioContentSchema,
  rirShapeContentSchema,
  rirGroupContentSchema,
  rirChartContentSchema,
  rirTableContentSchema,
  rirClipContentSchema,
  rirEmbedContentSchema,
  rirCodeContentSchema,
]) as unknown as z.ZodType<RIRElementContent>;

export interface RIRElement {
  id: string;
  type: ElementType;
  transform: RIRTransform;
  timing: RIRTiming;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  stacking: RIRStacking;
  animations: RIRAnimation[];
  content: RIRElementContent;
}

export const rirElementSchema: z.ZodType<RIRElement> = z.lazy(() =>
  z
    .object({
      id: z.string().min(1),
      type: z.enum(ELEMENT_TYPES),
      transform: rirTransformSchema,
      timing: rirTimingSchema,
      zIndex: z.number().int(),
      visible: z.boolean(),
      locked: z.boolean(),
      stacking: rirStackingSchema,
      animations: z.array(rirAnimationSchema),
      content: rirElementContentSchema,
    })
    .strict(),
) as z.ZodType<RIRElement>;

/** Stacking map exported by the compiler for the parity verifier. */
export const stackingMapSchema = z.record(rirStackingSchema);
export type StackingMap = z.infer<typeof stackingMapSchema>;

/** Compilation metadata. `compiledAt` is derived from the source doc, not wall-clock. */
export const rirMetaSchema = z
  .object({
    sourceDocId: z.string().min(1),
    sourceVersion: z.number().int().nonnegative(),
    compilerVersion: z.string(),
    // Not a timestamp — a deterministic hash or numeric version so outputs
    // diff stably across runs. See T-032 golden fixtures.
    digest: z.string().min(1),
  })
  .strict();
export type RIRMeta = z.infer<typeof rirMetaSchema>;

/** The compiled document. */
export const rirDocumentSchema = z
  .object({
    id: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    frameRate: z.number().int().positive(),
    durationFrames: z.number().int().positive(),
    mode: z.enum(['slide', 'video', 'display']),
    elements: z.array(rirElementSchema),
    stackingMap: stackingMapSchema,
    fontRequirements: z.array(fontRequirementSchema),
    meta: rirMetaSchema,
  })
  .strict();
export type RIRDocument = z.infer<typeof rirDocumentSchema>;

/* --------------------------- Compiler surface --------------------------- */

/** Diagnostic emitted by the compiler. */
export const compilerDiagnosticSchema = z
  .object({
    severity: z.enum(['info', 'warn', 'error']),
    code: z.string(),
    message: z.string(),
    elementId: z.string().optional(),
    pass: z.enum([
      'theme-resolve',
      'variable-resolve',
      'component-expand',
      'binding-resolve',
      'timing-flatten',
      'stacking-context',
      'font-aggregate',
      'validate',
    ]),
  })
  .strict();
export type CompilerDiagnostic = z.infer<typeof compilerDiagnosticSchema>;

/** Result of a compile. Implemented by T-030. */
export interface CompileResult {
  rir: RIRDocument;
  diagnostics: CompilerDiagnostic[];
}

/** Options accepted by `compileRIR`. */
export interface CompileOptions {
  /** Override the compiler version tag written to RIRMeta. */
  compilerVersion?: string;
  /** If true, stop at the first error diagnostic. Default false. */
  failFast?: boolean;
}

/** Re-exports for consumer convenience. */
export type { FontRequirement };

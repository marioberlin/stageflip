// packages/schema/src/clips/interactive.ts
// InteractiveClip element — the schema-level contract for the interactive
// runtime tier per ADR-003 §D2 / §D4 and ADR-005 §D1. Every frontier clip
// declares BOTH paths: a deterministic `staticFallback` for parity-safe
// exports and a `liveMount` for HTML / display-interactive / on-device-player
// targets. The `staticFallback` non-empty refine implements the type-level
// invariant that bare-liveMount clips are rejected (ADR-003 §D2).
//
// This file is BROWSER-SAFE — pure Zod. No `fs` / `path` / `child_process`
// imports. Per `feedback_t304_lessons.md`: `packages/schema/**` is consumed
// by browser apps; Node-only loaders live behind the `@stageflip/schema/presets/node`
// subpath. T-305 has no I/O surface, so no Node subpath is needed.
//
// `liveMount.props` is intentionally `z.record(z.unknown())` at T-305. Phase γ
// per-family clip implementations (T-383–T-396) extend with discriminated
// unions keyed by `family`.

import { z } from 'zod';

import { elementBaseSchema } from '../elements/base.js';
import { type Element, elementSchema } from '../elements/index.js';

/**
 * The seven frontier clip families enumerated by ADR-005 §D1. Closed enum;
 * adding a family is an ADR-005 amendment + a coordinated schema change.
 */
export const INTERACTIVE_CLIP_FAMILIES = [
  'shader',
  'three-scene',
  'voice',
  'ai-chat',
  'live-data',
  'web-embed',
  'ai-generative',
] as const;
export type InteractiveClipFamily = (typeof INTERACTIVE_CLIP_FAMILIES)[number];

/**
 * Permission envelope per ADR-003 §D4. The interactive tier checks these at
 * mount time; denial falls back to `staticFallback`. Widening this list
 * requires an ADR-003 amendment (per §D4 closing paragraph) plus a
 * coordinated change to the runtime's permission gate.
 */
export const permissionSchema = z.enum(['mic', 'network', 'camera']);
export type Permission = z.infer<typeof permissionSchema>;

/**
 * Typed reference to a runtime component the interactive tier can mount.
 * Format: `<package>#<ClassName>` where `<package>` is an optionally-scoped
 * npm package (`@scope/pkg`, `@scope/pkg/sub-path`, or `pkg`) and
 * `<ClassName>` is PascalCase. The `version` field is an optional semver
 * range for deployment-time validation.
 */
export const componentRefSchema = z
  .object({
    /**
     * Package-qualified component identifier — e.g.
     * `@stageflip/runtimes-interactive/clips/shader#ShaderClip`.
     */
    module: z.string().regex(/^@?[a-z0-9-]+(?:\/[a-z0-9-]+)*#[A-Z][A-Za-z0-9_]*$/, {
      message:
        'module must be `<package>#<PascalCaseClassName>` — package may be `@scope/pkg`, `@scope/pkg/sub`, or `pkg`',
    }),
    /** Optional semver range for deployment-time validation. */
    version: z.string().optional(),
  })
  .strict();
export type ComponentRef = z.infer<typeof componentRefSchema>;

/**
 * `liveMount` shape — ADR-003 §D2. Declares the runtime component to mount,
 * its props (untyped at this layer; per-family extensions in Phase γ), and
 * the static permission envelope.
 */
export const liveMountSchema = z
  .object({
    component: componentRefSchema,
    props: z.record(z.unknown()),
    permissions: z.array(permissionSchema).default([]),
  })
  .strict();
export type LiveMount = z.infer<typeof liveMountSchema>;

/**
 * `InteractiveClip` type. Declared explicitly because its `staticFallback`
 * field recursively references the `Element` union (which itself includes
 * `InteractiveClip`); TS cannot infer a self-referential shape from
 * `z.infer` alone. Same pattern as `GroupElement` in
 * `../elements/index.ts`.
 */
export type InteractiveClip = z.infer<typeof elementBaseSchema> & {
  type: 'interactive-clip';
  family: InteractiveClipFamily;
  staticFallback: Element[];
  liveMount: LiveMount;
  posterFrame?: number;
};

/**
 * `InteractiveClip` schema — ADR-003 §D2. A frontier clip that ships both a
 * deterministic `staticFallback` (an array of canonical elements rendered
 * by frame-runtime) and a `liveMount` (a component the interactive tier
 * mounts at playback). The `staticFallback.min(1)` refine enforces ADR-003
 * §D2's invariant at the type level: a clip declaring only `liveMount` is
 * rejected. `check-preset-integrity` (T-308) re-asserts this at CI time
 * against on-disk preset fixtures.
 *
 * `staticFallback` references the recursive `Element` union via `z.lazy`
 * to break the circular import between this module and `elements/index.ts`
 * (which adds `interactive-clip` to its discriminated union). The explicit
 * `z.ZodType<InteractiveClip>` annotation breaks TS's "implicit any in
 * circular reference" check, the same trick `groupElementSchema` uses.
 */
export const interactiveClipSchema: z.ZodType<InteractiveClip> = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('interactive-clip'),
      /** Frontier clip family — ADR-005 §D1. Narrows the contract per family. */
      family: z.enum(INTERACTIVE_CLIP_FAMILIES),
      /**
       * Deterministic fallback rendered by frame-runtime for parity-safe
       * export targets. Non-empty: ADR-003 §D2 forbids bare-liveMount clips.
       */
      staticFallback: z
        .array(z.lazy(() => elementSchema))
        .min(1, 'interactive clip must declare a non-empty staticFallback'),
      liveMount: liveMountSchema,
      /**
       * Optional poster-frame index — which frame of the static fallback
       * represents the clip in single-image contexts (PPTX thumbnails,
       * preview tiles). Non-negative integer.
       */
      posterFrame: z.number().int().nonnegative().optional(),
    }),
  )
  .strict() as unknown as z.ZodType<InteractiveClip>;

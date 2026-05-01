// packages/schema/src/clips/interactive/ai-generative-props.ts
// Per-family `liveMount.props` schema for `family: 'ai-generative'`
// (T-395 D-T395-2). Replicates the discriminator pattern set by
// shader / three-scene / voice / ai-chat / live-data / web-embed:
// strict-shaped Zod object, browser-safe, dispatched at gate time
// (`check-preset-integrity`) keyed on the clip's `family` field.
//
// BROWSER-SAFE — pure Zod. No `fs` / `path` / `child_process` / Node-
// only modules. `@stageflip/schema` is consumed by browser apps; per
// `feedback_t304_lessons.md` any new file under this package must
// keep the browser-bundle hazard surface zero.
//
// T-396 (D-T396-1) extends this schema with the optional
// `curatedExample?: { src, contentType? }` field consumed by
// `defaultAiGenerativeStaticFallback`. T-395 fixtures that omit the
// field continue to validate; the field is fully optional. v1
// accepts ONLY `data:` URLs (the refine in `curatedExampleSchema`
// enforces this) — same posture as T-394's posterImage (the F-2
// fix from spec PR #289 review).
//
// v1 IS IMAGE-ONLY. The schema does NOT carry a `modality` field — a
// single-value enum has no purpose. When a second modality lands
// (audio / video / 3D), the field is added with
// `z.enum(['image', 'audio', ...]).default('image')` as a non-
// breaking change for existing fixtures. Per T-395 D-T395-2 + the
// out-of-scope deferral. ADR-006 (Phase 14) covers the authoring-
// time asset-generation counterpart (frozen files); T-395/T-396 are
// the playback-time counterpart.

import { z } from 'zod';

/**
 * Captured curated example for the static fallback (T-396
 * D-T396-1). Strict-shaped: extra keys are rejected so authoring-
 * time typos do not silently become a no-op in the static-fallback
 * render.
 *
 * v1 accepts ONLY `data:` URLs (inline-baked at authoring time).
 * `http(s):` URLs are out of scope — they would intersect the
 * determinism floor (the frame-runtime would have to fetch the
 * image at export time, which `check-determinism` forbids inside
 * `clips/**`). Widening the schema is a separate task gated on a
 * determinism-skill ruling for the external-image fetch path. Same
 * posture as T-394 D-T394-1 (web-embed posterImage).
 */
const curatedExampleSchema = z
  .object({
    src: z
      .string()
      .refine(
        (s) => s.startsWith('data:'),
        'curatedExample.src must be a data: URL in v1; http(s) URLs are deferred per the out-of-scope table',
      ),
    contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']).optional(),
  })
  .strict();

/**
 * `liveMount.props` shape for `family: 'ai-generative'`. Strict-
 * shaped: unknown keys are rejected so a typo at author time does
 * not silently become a no-op.
 *
 * - `prompt` — the generation prompt. Per-clip identity baked into
 *   the schema. Non-empty.
 * - `provider` — provider name (`'openai' | 'stability' |
 *   'replicate' | tenant-supplied | ...`). Free-form so tenant
 *   adapters extend without a schema bump. The host's injected
 *   `AiGenerativeProvider` validates / dispatches on this.
 * - `model` — model identifier within the provider (`'dall-e-3'` /
 *   `'stable-diffusion-xl'` / etc.). Non-empty.
 * - `negativePrompt` — optional concepts to avoid. Forwarded
 *   verbatim to providers that support it; ignored by providers
 *   that don't.
 * - `seed` — optional integer for deterministic generation.
 *   Forwarded verbatim; providers that don't honour seeds (DALL-E)
 *   ignore it. Same-seed-same-output is the provider's
 *   responsibility, not the clip's.
 * - `width` / `height` — optional output dimensions. Default to the
 *   clip transform's dimensions when omitted. Some providers
 *   constrain to specific values (DALL-E requires 256/512/1024
 *   squares); the host's adapter is responsible for validation /
 *   quantisation.
 * - `posterFrame` — frame at which `staticFallback` (T-396 curated
 *   example) is sampled. Convention reused from shader /
 *   three-scene / voice / ai-chat / live-data / web-embed.
 * - `curatedExample` (T-396 D-T396-1) — optional captured curated
 *   example the `defaultAiGenerativeStaticFallback` generator
 *   renders on the static path. Strict shape: `{ src, contentType? }`.
 *   v1 accepts ONLY `data:` URLs. Absent → the generator emits a
 *   single placeholder TextElement.
 */
export const aiGenerativeClipPropsSchema = z
  .object({
    prompt: z.string().min(1, 'prompt must be a non-empty string'),
    provider: z.string().min(1, 'provider must be a non-empty string'),
    model: z.string().min(1, 'model must be a non-empty string'),
    negativePrompt: z.string().optional(),
    seed: z.number().int('seed must be an integer').optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    posterFrame: z.number().int().nonnegative().default(0),
    curatedExample: curatedExampleSchema.optional(),
  })
  .strict();

/** Inferred shape of {@link aiGenerativeClipPropsSchema.curatedExample}. */
export type AiGenerativeCuratedExample = z.infer<typeof curatedExampleSchema>;

/** Inferred shape of {@link aiGenerativeClipPropsSchema}. */
export type AiGenerativeClipProps = z.infer<typeof aiGenerativeClipPropsSchema>;

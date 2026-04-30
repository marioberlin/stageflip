// packages/schema/src/clips/interactive/voice-props.ts
// Per-family `liveMount.props` schema for `family: 'voice'` (T-387 D-T387-2).
// Replicates the discriminator pattern set by `shader-props.ts` /
// `three-scene-props.ts`: strict-shaped Zod object, browser-safe, dispatched
// at gate time (`check-preset-integrity`) keyed on the clip's `family` field.
//
// BROWSER-SAFE — pure Zod. No `fs` / `path` / `child_process` / Node-only
// modules. `@stageflip/schema` is consumed by browser apps; per
// `feedback_t304_lessons.md` any new file under this package must keep
// the browser-bundle hazard surface zero.

import { z } from 'zod';

/**
 * `liveMount.props` shape for `family: 'voice'`. Strict-shaped: unknown
 * keys are rejected so a typo at author time does not silently become a
 * no-op.
 *
 * - `mimeType` — audio MIME type for `MediaRecorder`. `'audio/webm'` is
 *   broadly supported (Chromium / Firefox); the runtime feature-detects
 *   and emits a telemetry failure if the configured MIME is unsupported
 *   on the active browser (T-387 D-T387-2 + AC #10).
 * - `maxDurationMs` — clip auto-stops at this duration. Positive integer
 *   in milliseconds. Default 60_000 (one minute).
 * - `partialTranscripts` — when `true`, the clip emits partial transcript
 *   events as the user speaks. When `false`, only finalized transcripts
 *   surface to handlers (the underlying `SpeechRecognition` may still
 *   produce partials internally; the clip filters them).
 * - `language` — BCP-47 tag forwarded to `SpeechRecognition.lang`. The
 *   schema rejects empty strings (AC #3); finer BCP-47 validation lives
 *   at the host application's discretion.
 * - `posterFrame` — frame at which `staticFallback` (T-388 waveform poster)
 *   is sampled. Default 0; convention reused from shader / three-scene.
 * - `posterText` (T-388 D-T388-1) — optional overlay copy rendered above the
 *   waveform poster on the static path. App-supplied; the package ships no
 *   English defaults (CLAUDE.md §10). Non-empty when present. Consumed by
 *   `defaultVoiceStaticFallback` to build the centred TextElement.
 */
export const voiceClipPropsSchema = z
  .object({
    mimeType: z.string().min(1, 'mimeType must be a non-empty string').default('audio/webm'),
    maxDurationMs: z
      .number()
      .int()
      .positive('maxDurationMs must be a positive integer')
      .default(60_000),
    partialTranscripts: z.boolean().default(true),
    language: z.string().min(1, 'language must be a non-empty BCP-47 tag').default('en-US'),
    posterFrame: z.number().int().nonnegative().default(0),
    posterText: z.string().min(1, 'posterText must be a non-empty string').optional(),
  })
  .strict();

/** Inferred shape of {@link voiceClipPropsSchema}. */
export type VoiceClipProps = z.infer<typeof voiceClipPropsSchema>;

// packages/schema/src/clips/interactive/ai-chat-props.ts
// Per-family `liveMount.props` schema for `family: 'ai-chat'` (T-389
// D-T389-2). Replicates the discriminator pattern set by `shader-props.ts`,
// `three-scene-props.ts`, and `voice-props.ts`: strict-shaped Zod object,
// browser-safe, dispatched at gate time (`check-preset-integrity`) keyed
// on the clip's `family` field.
//
// BROWSER-SAFE — pure Zod. No `fs` / `path` / `child_process` / Node-only
// modules. `@stageflip/schema` is consumed by browser apps; per
// `feedback_t304_lessons.md` any new file under this package must keep
// the browser-bundle hazard surface zero.
//
// T-390 (sister task) will add an optional `capturedTranscript?` field to
// this schema for the captured-transcript static fallback. T-389 keeps the
// shape cleanly separable so T-390's addition is a single optional field.

import { z } from 'zod';

/**
 * `liveMount.props` shape for `family: 'ai-chat'`. Strict-shaped: unknown
 * keys are rejected so a typo at author time does not silently become a
 * no-op.
 *
 * - `systemPrompt` — per-slide system prompt baked into the schema. The
 *   clip's identity. Non-empty.
 * - `provider` — LLM provider name. Forwarded to
 *   `@stageflip/llm-abstraction` (`'openai' | 'anthropic' | 'google'` in
 *   v1; the schema accepts any non-empty string so tenant-provided
 *   adapters can extend without a schema bump).
 * - `model` — model identifier within the provider. Non-empty.
 * - `maxTokens` — token cap per turn. Positive integer (D-T389-2). Used
 *   for backpressure and forwarded to the provider's request.
 * - `temperature` — sampling temperature in `[0, 1.5]`. Bound matches the
 *   provider-neutral primitive's accepted range.
 * - `multiTurn` — when `true`, the clip exposes a multi-turn chat. When
 *   `false`, a second `send` call rejects with `MultiTurnDisabledError`
 *   (D-T389-4 + AC #13). Default `true`.
 * - `posterFrame` — frame at which `staticFallback` (T-390 captured
 *   transcript) is sampled. Convention reused from shader / three-scene /
 *   voice (D-T389-2 + clip-elements skill).
 */
export const aiChatClipPropsSchema = z
  .object({
    systemPrompt: z.string().min(1, 'systemPrompt must be a non-empty string'),
    provider: z.string().min(1, 'provider must be a non-empty string'),
    model: z.string().min(1, 'model must be a non-empty string'),
    maxTokens: z.number().int().positive('maxTokens must be a positive integer').default(512),
    temperature: z
      .number()
      .min(0, 'temperature must be >= 0')
      .max(1.5, 'temperature must be <= 1.5')
      .default(0.7),
    multiTurn: z.boolean().default(true),
    posterFrame: z.number().int().nonnegative().default(0),
  })
  .strict();

/** Inferred shape of {@link aiChatClipPropsSchema}. */
export type AiChatClipProps = z.infer<typeof aiChatClipPropsSchema>;

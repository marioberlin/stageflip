// packages/schema/src/clips/interactive/web-embed-props.ts
// Per-family `liveMount.props` schema for `family: 'web-embed'` (T-393
// D-T393-2). Replicates the discriminator pattern set by shader /
// three-scene / voice / ai-chat / live-data: strict-shaped Zod object,
// browser-safe, dispatched at gate time (`check-preset-integrity`)
// keyed on the clip's `family` field.
//
// BROWSER-SAFE — pure Zod. No `fs` / `path` / `child_process` / Node-
// only modules. `@stageflip/schema` is consumed by browser apps; per
// `feedback_t304_lessons.md` any new file under this package must keep
// the browser-bundle hazard surface zero.
//
// T-394 (D-T394-1) extends this schema with the optional
// `posterImage?: { src, contentType? }` field consumed by
// `defaultWebEmbedStaticFallback`. T-393 fixtures that omit the field
// continue to validate; the field is fully optional and lands in T-394.

import { z } from 'zod';

/**
 * `liveMount.props` shape for `family: 'web-embed'`. Strict-shaped:
 * unknown keys are rejected so a typo at author time does not silently
 * become a no-op.
 *
 * - `url` — absolute URL of the embedded page. The clip does not
 *   resolve relative paths.
 * - `sandbox` — `sandbox` attribute tokens. Default `[]` — fully
 *   sandboxed (no scripts, no same-origin, no forms, no popups).
 *   Authors opt in to specific capabilities by adding tokens
 *   (`'allow-scripts'`, `'allow-same-origin'`, `'allow-forms'`, etc.).
 *   The schema does not enforce a token allowlist — the security
 *   review (T-403) decides which tokens are permitted at tenant level.
 *   Values are passed verbatim into the iframe's `sandbox` attribute
 *   as a space-separated string.
 * - `allowedOrigins` — origins permitted to dispatch via `onMessage`.
 *   Empty / undefined → `onMessage` never fires. Every `event.origin`
 *   MUST appear in this allowlist or the event is dropped + logged
 *   via `web-embed-clip.message.dropped`. Same posture as the T-391
 *   LiveData headers field — documentation, not security theatre; the
 *   real defence is the iframe's `sandbox` attribute + the host's CSP.
 * - `width` / `height` — optional iframe-size overrides. Default to
 *   the clip transform's dimensions when omitted.
 * - `posterFrame` — frame at which `staticFallback` (T-394
 *   poster screenshot) is sampled. Convention reused from shader /
 *   three-scene / voice / ai-chat / live-data.
 */
export const webEmbedClipPropsSchema = z
  .object({
    url: z.string().url('url must be a valid absolute URL'),
    sandbox: z.array(z.string()).default([]),
    allowedOrigins: z.array(z.string().url()).optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    posterFrame: z.number().int().nonnegative().default(0),
  })
  .strict();

/** Inferred shape of {@link webEmbedClipPropsSchema}. */
export type WebEmbedClipProps = z.infer<typeof webEmbedClipPropsSchema>;

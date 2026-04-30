// packages/schema/src/clips/interactive/live-data-props.ts
// Per-family `liveMount.props` schema for `family: 'live-data'` (T-391
// D-T391-2). Replicates the discriminator pattern set by `shader-props.ts`,
// `three-scene-props.ts`, `voice-props.ts`, and `ai-chat-props.ts`:
// strict-shaped Zod object, browser-safe, dispatched at gate time
// (`check-preset-integrity`) keyed on the clip's `family` field.
//
// BROWSER-SAFE — pure Zod. No `fs` / `path` / `child_process` / Node-only
// modules. `@stageflip/schema` is consumed by browser apps; per
// `feedback_t304_lessons.md` any new file under this package must keep
// the browser-bundle hazard surface zero.
//
// T-392 (D-T392-1) extends this schema with the optional
// `cachedSnapshot?: { capturedAt, status, body }` field consumed by
// `defaultLiveDataStaticFallback`. T-391 fixtures that omit the field
// continue to validate; the field is fully optional and lands in T-392.

import { z } from 'zod';

/**
 * Per-snapshot shape inside {@link liveDataClipPropsSchema.cachedSnapshot}
 * (T-392 D-T392-1). Strict: extra keys are rejected so authoring-time
 * typos do not silently become a no-op in the static-fallback render.
 */
const cachedSnapshotSchema = z
  .object({
    /** ISO-8601 timestamp at which the snapshot was captured (display only). */
    capturedAt: z.string().min(1, 'cachedSnapshot.capturedAt must be a non-empty string'),
    /** Status code at capture time (display only). */
    status: z.number().int('cachedSnapshot.status must be an integer'),
    /** Parsed body. The schema accepts arbitrary JSON-shaped values. */
    body: z.unknown(),
  })
  .strict();

/**
 * `liveMount.props` shape for `family: 'live-data'`. Strict-shaped: unknown
 * keys are rejected so a typo at author time does not silently become a
 * no-op.
 *
 * - `endpoint` — absolute URL the clip fetches at mount time. The clip
 *   does not resolve relative paths.
 * - `method` — HTTP method. v1 supports GET / POST.
 * - `headers` — Optional request headers. Free-shaped `Record<string, string>` —
 *   the schema does NOT validate header names. Credential headers
 *   (`Authorization`, `Cookie`, `X-API-Key`, etc.) MUST NOT be supplied
 *   via clip props; ADR-005 §D7 keeps credential scoping out of the
 *   authoring surface. The host's `Fetcher` adapter is the place to
 *   inject auth at request time. The runtime does not enforce this with
 *   a schema refine — a refine would be security theatre (a host could
 *   still smuggle credentials via `X-Custom-Auth`); the real defence is
 *   at the network gate (T-403 tenant allowlists, future).
 * - `body` — Optional JSON request body for POST. Stringified by the
 *   provider. `unknown` because the schema accepts arbitrary JSON-shaped
 *   payloads.
 * - `parseMode` — Response parse mode. `'json'` (default) parses the
 *   response body as JSON; `'text'` returns the raw string. Other parsers
 *   are future tasks.
 * - `refreshTrigger` — Refresh policy. `'mount-only'` (one-shot at mount;
 *   default) or `'manual'` (host calls `MountHandle.refresh()` to
 *   re-fetch). Polling is a future task gated on a determinism-skill
 *   ruling.
 * - `posterFrame` — Frame at which `staticFallback` (T-392 cached
 *   snapshot) is sampled. Convention reused from shader / three-scene /
 *   voice / ai-chat (D-T391-2 + clip-elements skill).
 * - `cachedSnapshot` (T-392 D-T392-1) — optional captured response
 *   payload the `defaultLiveDataStaticFallback` generator renders on
 *   the static path. Strict shape: `{ capturedAt, status, body }`.
 *   Absent → the generator emits a single placeholder element.
 */
export const liveDataClipPropsSchema = z
  .object({
    endpoint: z.string().url('endpoint must be a valid absolute URL'),
    method: z.enum(['GET', 'POST']).default('GET'),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.unknown().optional(),
    parseMode: z.enum(['json', 'text']).default('json'),
    refreshTrigger: z.enum(['mount-only', 'manual']).default('mount-only'),
    posterFrame: z.number().int().nonnegative().default(0),
    cachedSnapshot: cachedSnapshotSchema.optional(),
  })
  .strict();

/** Inferred shape of {@link liveDataClipPropsSchema.cachedSnapshot}. */
export type LiveDataCachedSnapshot = z.infer<typeof cachedSnapshotSchema>;

/** Inferred shape of {@link liveDataClipPropsSchema}. */
export type LiveDataClipProps = z.infer<typeof liveDataClipPropsSchema>;

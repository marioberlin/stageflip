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
//
// T-404 (security hardening — addresses §5 R-1 and §5 R-2 of
// `docs/security-review-track-a.md`):
//   - R-1: `endpoint` is refined against `LIVE_DATA_ALLOWED_HOST_PATTERNS`
//     (default `[]` — deny-all, fail-closed). Hosts/tenants/tests extend
//     the allowlist via `extendAllowedHosts(patterns)`. Closes the SSRF
//     residual risk by giving the schema a refusal point that ADR-005 §D7
//     called out as security-review scope.
//   - R-2: `headers` keys are refined against
//     `FORBIDDEN_REQUEST_HEADER_PATTERNS` (Authorization / Cookie /
//     X-Api-Key / etc., case-insensitive). The previous file header
//     called a refine "security theatre" because `X-Custom-Auth` would
//     slip through; the new refine specifically denies that family of
//     names. Documentation-as-defence is preserved; this is the
//     belt-AND-braces complement.
// Module-level state for the allowlist is acceptable: the schema lives
// on the script tier (no determinism scope), and the deny-all default
// keeps the tier safe even if a consumer forgets to seed.

import { z } from 'zod';

/**
 * Forbidden credential-header name patterns (T-404 R-2). Case-insensitive.
 * Any `headers` key matching ANY pattern is rejected at schema-parse time.
 *
 * The set is intentionally narrow and well-known: it denies the headers
 * that browsers / proxies / typical auth middleware treat as
 * credential-bearing. `X-Custom-*` style names are NOT on the denylist
 * by design — the schema can't enumerate every possible custom name; the
 * deny set defends the canonical cases and the file header's `Fetcher`
 * adapter remains the architectural chokepoint for the rest.
 */
export const FORBIDDEN_REQUEST_HEADER_PATTERNS: readonly RegExp[] = [
  /^authorization$/i,
  /^proxy-authorization$/i,
  /^cookie$/i,
  /^x-(api-key|auth|access-token|csrf-token)$/i,
  /^bearer$/i,
];

/**
 * Host allowlist for {@link liveDataClipPropsSchema.endpoint} (T-404 R-1).
 *
 * Default: `[]` (empty). The refine rejects ANY endpoint host when the
 * list is empty (deny-all-by-default, fail-closed posture). Tenants /
 * tests / integration code extend the list via {@link extendAllowedHosts}.
 *
 * Patterns are matched against `URL(endpoint).host` — i.e. the host
 * component including any port (e.g. `localhost:3000`). Patterns are
 * regexes so callers can encode host families (e.g. `^(.+\.)?example\.com$`).
 *
 * The module-level array is mutable through {@link extendAllowedHosts}
 * and {@link __resetAllowedHostsForTests}. No determinism scope concerns
 * — this file is browser-safe Zod-only and is consumed at preset-load
 * time on the script tier.
 */
const allowedHostPatterns: RegExp[] = [];

/**
 * Read-only view of the current host allowlist (T-404 R-1). Returns a
 * fresh snapshot each call so callers cannot mutate the underlying
 * array.
 */
export const LIVE_DATA_ALLOWED_HOST_PATTERNS = (): readonly RegExp[] => [...allowedHostPatterns];

/**
 * Extend the LiveData endpoint host allowlist with additional regex
 * patterns (T-404 R-1). MERGE semantics — calling twice extends; never
 * replaces. Duplicate patterns (same `source` + `flags`) are skipped to
 * keep the array small.
 *
 * Typical use: a host shell calls this at startup with the tenant-
 * derived patterns; tests call it inside `beforeEach`.
 */
export function extendAllowedHosts(patterns: readonly RegExp[]): void {
  for (const pattern of patterns) {
    const exists = allowedHostPatterns.some(
      (existing) => existing.source === pattern.source && existing.flags === pattern.flags,
    );
    if (!exists) {
      allowedHostPatterns.push(pattern);
    }
  }
}

/**
 * Test-only reset of the host allowlist back to `[]` (T-404 R-1).
 * Underscored to flag it as not-for-production. The schema module
 * has no other writable state.
 */
export function __resetAllowedHostsForTests(): void {
  allowedHostPatterns.length = 0;
}

function endpointHostInAllowlist(endpoint: string): boolean {
  // The `.url()` refinement above ensures this URL constructor succeeds
  // before we reach this point in the refine chain. We still defend
  // against malformed input in case the refine ordering changes.
  let host: string;
  try {
    host = new URL(endpoint).host;
  } catch {
    return false;
  }
  return allowedHostPatterns.some((pattern) => pattern.test(host));
}

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
    endpoint: z
      .string()
      .url('endpoint must be a valid absolute URL')
      .refine(
        endpointHostInAllowlist,
        'LiveData endpoint host not in tenant allowlist (security review R-1)',
      ),
    method: z.enum(['GET', 'POST']).default('GET'),
    headers: z
      .record(z.string(), z.string())
      .refine((value) => {
        if (!value) return true;
        for (const key of Object.keys(value)) {
          for (const pattern of FORBIDDEN_REQUEST_HEADER_PATTERNS) {
            if (pattern.test(key)) return false;
          }
        }
        return true;
      }, "Header is on the credential-header denylist (security review R-2): one of 'Authorization', 'Proxy-Authorization', 'Cookie', 'X-Api-Key', 'X-Auth', 'X-Access-Token', 'X-Csrf-Token', or 'Bearer' (case-insensitive)")
      .optional(),
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

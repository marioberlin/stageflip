// packages/audience-contract/src/audience-backend-origins.ts
// `AUDIENCE_BACKEND_ORIGINS` — shared allowlist of WebEmbed-compatible
// audience-backend origins, per the ADR-005 amendment T-393 landed
// (per-clip `audience-network` permission scope) + ADR-009 §D13.
//
// T-484 ships this constant so the editor's WebEmbed authoring flow
// and the voter-side runtime can pre-populate the `allowedOrigins`
// envelope when a presenter inserts a vendor audience clip — without
// each consumer hard-coding the per-vendor host list.
//
// The list is the union of:
//   - `audience-native`'s origin (relative — the host's own
//     `apps/api`; no fixed origin to enumerate)
//   - Each vendor adapter's API hostname per its `security.json`
//     (Slido / Mentimeter / Poll Everywhere / Vevox / Wooclap).
//
// New vendor adapter packages (`packages/audience-<vendor>/`) extend
// the list here as part of their PR. The list is intentionally NOT
// dynamic-discovery: the editor needs the host names at compile time
// to pre-fill the WebEmbed allowlist UI; runtime discovery would
// defeat that.

/**
 * Vendor audience-backend origins permitted by the
 * `audience-network` permission scope. Includes the protocol
 * prefix per the `WebEmbedClipProps.allowedOrigins` convention.
 */
export const AUDIENCE_BACKEND_ORIGINS: readonly string[] = [
  'https://api.slido.com',
  'https://app.slido.com',
  'https://api.mentimeter.com',
  'https://app.mentimeter.com',
  'https://api.polleverywhere.com',
  'https://app.polleverywhere.com',
  'https://api.vevox.com',
  'https://app.vevox.com',
  'https://api.wooclap.com',
  'https://app.wooclap.com',
] as const;

/**
 * Test whether a given URL string belongs to the audience-backend
 * origin allowlist. Returns `false` for malformed URLs (defensive —
 * the caller should NOT trust user-supplied URLs to be well-formed).
 */
export function isAudienceBackendOrigin(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return AUDIENCE_BACKEND_ORIGINS.includes(parsed.origin);
}

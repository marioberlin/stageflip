// packages/import-slidemotion-legacy/src/sanitize.ts
// Pure transforms from legacy field shapes to canonical-schema shapes.

/**
 * Legacy IDs may be UUIDs (dashes), arbitrary strings (spaces, punctuation),
 * or already URL-safe — the canonical schema requires `/^[A-Za-z0-9_-]+$/`.
 * Any char outside that set collapses to `_`; consecutive underscores and
 * leading/trailing separators are trimmed so the output stays readable in
 * devtools + URLs. An empty or all-invalid input falls back to `fallback`
 * so we never return `""` (which would fail `.min(1)`).
 *
 * The operation is lossless enough for practical imports: two slides with
 * legacy ids `"foo bar"` and `"foo_bar"` both sanitize to `foo_bar`, a
 * collision the document-level layer de-duplicates via
 * `uniqueifyIds`.
 */
export function sanitizeId(input: string, fallback: string): string {
  const cleaned = input
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[-_]+|[-_]+$/g, '');
  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Ensures a map of sanitized ids is collision-free by suffixing duplicates
 * with `-2`, `-3`, etc. The output is stable: the first occurrence keeps
 * its name.
 */
export function uniqueifyIds(ids: ReadonlyArray<string>): string[] {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (const id of ids) {
    const count = seen.get(id) ?? 0;
    if (count === 0) {
      out.push(id);
      seen.set(id, 1);
      continue;
    }
    const next = `${id}-${count + 1}`;
    out.push(next);
    seen.set(id, count + 1);
  }
  return out;
}

/**
 * A legacy `assetId` is typically a bare id (`"cover.jpg"` or UUID). The
 * canonical `AssetRef` requires `asset:<id>` with the id URL-safe. Sanitize
 * the inner part and prefix. Returns null when the input is an empty or
 * unusable string so the caller can warn and fall back.
 */
export function toAssetRef(input: string): string | null {
  const id = sanitizeId(input, '');
  if (id.length === 0) return null;
  return `asset:${id}`;
}

/**
 * Canonical schema requires a valid RFC 3339 datetime. Legacy docs may carry
 * garbage or empty strings. Parse via `Date` + round-trip; if that fails,
 * return null so the caller can substitute a sentinel and warn.
 */
export function normalizeIso(input: string | undefined): string | null {
  if (!input) return null;
  const parsed = Date.parse(input);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Legacy `color: string` may be a hex literal, a CSS color name, or an
 * arbitrary placeholder. Canonical `colorValueSchema` accepts hex or
 * `theme:*` refs only. This narrowly accepts hex literals and lowercases
 * them; everything else returns null so the caller can warn.
 */
export function normalizeHexColor(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  if (!HEX_COLOR_RE.test(input)) return null;
  return input.toLowerCase();
}

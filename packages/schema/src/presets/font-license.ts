// packages/schema/src/presets/font-license.ts
// Font-license vocabulary + composite-expression parser (T-307 §D-T307-1).
// Browser-safe: zero Node/I/O imports — exported from `@stageflip/schema` main.
//
// The parser is a security primitive: it is the only place where free-form
// on-disk license strings cross into the typed registry. AC #5 (mixed +//
// rejection), AC #6 (unknown-atom rejection), and AC #8 (empty rejection) are
// enforced here — the registry trusts the parser's output unconditionally.

import { z } from 'zod';

/**
 * The 12 license atoms that may appear in a preset's `preferredFont.license`
 * or `fallbackFont.license` field. The list is the registry's contract — if a
 * stub uses an atom outside this set, T-307's smoke test (AC #18) escalates.
 *
 * - `ofl` — SIL Open Font License (the dominant fallback license).
 * - `apache-2.0` — Apache 2.0 (e.g., Roboto).
 * - `mit` — MIT.
 * - `public-domain` — public domain.
 * - `cc0-1.0` — CC0 1.0 Universal.
 * - `proprietary-byo` — bring-your-own (e.g., CNN Sans, BBC Reith).
 * - `commercial-byo` — licensed commercially; bring license (e.g., ITC Benguiat).
 * - `platform-byo` — platform fonts (TikTok Sans, Apple SF) — assume installed.
 * - `license-cleared` — informal "we know it's OK"; escalate to type-design-consultant.
 * - `license-mixed` — multi-license fallback group.
 * - `ofl-equivalent` — OFL-compatible custom (e.g., custom 8-bit pixel fonts).
 * - `na` — text-free presets (e.g., QR-only CTAs).
 */
export const FONT_LICENSE_ATOMS = [
  'ofl',
  'apache-2.0',
  'mit',
  'public-domain',
  'cc0-1.0',
  'proprietary-byo',
  'commercial-byo',
  'platform-byo',
  'license-cleared',
  'license-mixed',
  'ofl-equivalent',
  'na',
] as const;

export type FontLicenseAtom = (typeof FONT_LICENSE_ATOMS)[number];

/** Zod enum for a single atom — for direct schema integration. */
export const fontLicenseAtomSchema = z.enum(FONT_LICENSE_ATOMS);

/**
 * Schema for the raw license field as it appears in preset frontmatter.
 * Non-empty string only — the typed validation lives in
 * {@link parseFontLicenseExpression}, which is what consumers should reach
 * for. T-304's frontmatter loader still uses `z.string().min(1)`; T-307's
 * registry lifts the strings into typed atoms via the parser.
 */
export const fontLicenseExpressionSchema = z.string().min(1);

/**
 * The parsed shape of a license expression — either a single atom or a
 * composite of atoms joined by AND (`+`) or OR (`/`). Mixing the two operators
 * is rejected by the parser (AC #5).
 */
export interface ParsedLicenseExpression {
  /** Atoms in the order they appear in the source string. */
  readonly atoms: ReadonlyArray<FontLicenseAtom>;
  /**
   * - `'atom'`: a single atom (`'ofl'`).
   * - `'all'`: every atom required (e.g., `'apache-2.0 + ofl'` — a font that
   *   ships both licenses simultaneously, as some Google Fonts do).
   * - `'union'`: any one atom is sufficient (e.g.,
   *   `'apache-2.0 / ofl / commercial-byo'` — a fallback set where the user
   *   may pick whichever is convenient).
   */
  readonly composition: 'atom' | 'union' | 'all';
}

/**
 * Parse a font-license expression string into a typed {@link ParsedLicenseExpression}.
 *
 * Grammar:
 *
 *   expression := atom | and_expr | or_expr
 *   and_expr   := atom ('+' atom)+
 *   or_expr    := atom ('/' atom)+
 *
 * Mixed `+`/`/` in one expression is a parser-level rejection — neither
 * algebra subordinates the other and v1 of the registry doesn't represent
 * `(a + b) / c` style trees. This is a security primitive (AC #5).
 *
 * Annotation-style parens (e.g., `'ofl-equivalent (custom)'`) are stripped
 * before tokenization. The annotation is informational; the canonical atom is
 * what reaches the registry.
 *
 * @throws Error when the expression is empty, contains an unknown atom, mixes
 *   `+` and `/`, or is otherwise malformed (leading / trailing separator,
 *   stray empty token).
 */
export function parseFontLicenseExpression(raw: string): ParsedLicenseExpression {
  if (typeof raw !== 'string') {
    throw new TypeError(`font-license expression must be a string; got ${typeof raw}`);
  }
  // Strip parenthesized annotations: 'ofl-equivalent (custom)' → 'ofl-equivalent'.
  const stripped = raw.replace(/\([^)]*\)/g, '').trim();
  if (stripped.length === 0) {
    throw new Error('font-license expression is empty');
  }

  const hasPlus = stripped.includes('+');
  const hasSlash = stripped.includes('/');
  if (hasPlus && hasSlash) {
    throw new Error(
      `font-license expression mixes '+' and '/' operators (not supported in v1): ${raw}`,
    );
  }

  let parts: string[];
  let composition: ParsedLicenseExpression['composition'];
  if (hasPlus) {
    parts = stripped.split('+').map((p) => p.trim());
    composition = 'all';
  } else if (hasSlash) {
    parts = stripped.split('/').map((p) => p.trim());
    composition = 'union';
  } else {
    parts = [stripped];
    composition = 'atom';
  }

  if (parts.some((p) => p.length === 0)) {
    throw new Error(`font-license expression has empty operand: ${raw}`);
  }

  // Coerce each token to a known atom. Unknown atoms surface as a clear error.
  const atoms: FontLicenseAtom[] = parts.map((token) => {
    const result = fontLicenseAtomSchema.safeParse(token);
    if (!result.success) {
      throw new Error(
        `font-license expression contains unknown atom '${token}' (in '${raw}'). ` +
          `Allowed atoms: ${FONT_LICENSE_ATOMS.join(', ')}.`,
      );
    }
    return result.data;
  });

  // A single-atom expression is composition: 'atom' regardless of operator
  // presence; the operator branches above already handled multi-atom cases,
  // so this is a guard for code clarity.
  if (atoms.length === 1) {
    composition = 'atom';
  }

  return { atoms, composition };
}

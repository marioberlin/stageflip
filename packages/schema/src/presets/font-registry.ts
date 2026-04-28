// packages/schema/src/presets/font-registry.ts
// FontLicenseRegistry — Node-only (consumes T-304's PresetRegistry, which is
// itself Node-only). Walks every loaded preset, extracts (preferredFont,
// fallbackFont) pairs, parses each license expression into typed atoms, and
// indexes by canonical family name. Exported via `@stageflip/schema/presets/node`
// subpath; never reachable from the browser-bundled main entry.
//
// Determinism: stable iteration via sorted keys (AC #14). No time / random /
// network behavior — `packages/schema/**` is not in clip/runtime scope.

import {
  type FontLicenseAtom,
  type ParsedLicenseExpression,
  parseFontLicenseExpression,
} from './font-license.js';
import type { Preset } from './loader.js';
import type { PresetRegistry } from './registry.js';

/**
 * One entry in the font-license registry — a unique font family across the
 * preset corpus, the parsed license expression for its preferred form, the
 * approved fallback (if the preferred is `proprietary-byo`), and the list of
 * preset ids that reference it.
 */
export interface FontEntry {
  /** Presentation form as first observed in the preset frontmatter. */
  readonly family: string;
  /** Canonical lowercase-hyphen-spaced key (the dedup key). */
  readonly canonicalName: string;
  /** Parsed license expression for the preferred form. */
  readonly license: ParsedLicenseExpression;
  /**
   * Approved fallback font when the preferred is `proprietary-byo`. Render
   * tooling substitutes this at output time. Absent when the preferred is
   * already license-cleared.
   */
  readonly approvedFallback?: {
    family: string;
    weight: number;
    license: ParsedLicenseExpression;
  };
  /** Sorted list of preset frontmatter ids referencing this font. */
  readonly referencedBy: ReadonlyArray<string>;
}

/**
 * Result of {@link FontLicenseRegistry.validateAgainstWhitelist} — the
 * overall verdict plus the offending entries (so callers can render the
 * violation list).
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly violations: ReadonlyArray<FontEntry>;
}

/**
 * Canonicalize a font family name for dedup keys. Lowercases, replaces runs of
 * whitespace and underscores with single hyphens, trims hyphens at the edges.
 *
 * Examples:
 *   'CNN Sans'      → 'cnn-sans'
 *   'IBM Plex Mono' → 'ibm-plex-mono'
 *   'inter_display' → 'inter-display'
 */
export function canonicalizeFontFamily(family: string): string {
  return family
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Mutable building block — only used during registry construction. */
interface FontEntryBuilder {
  family: string;
  canonicalName: string;
  license: ParsedLicenseExpression;
  approvedFallback?: { family: string; weight: number; license: ParsedLicenseExpression };
  referencedBy: Set<string>;
}

/**
 * In-memory index of every (canonical) font family referenced across the
 * preset corpus, plus its license posture. Build once via
 * {@link FontLicenseRegistry.buildFromPresets}; subsequent reads are O(1).
 */
export class FontLicenseRegistry {
  private readonly byCanonicalName: ReadonlyMap<string, FontEntry>;

  private constructor(entries: ReadonlyMap<string, FontEntry>) {
    this.byCanonicalName = entries;
  }

  /**
   * Walk every preset in `presetRegistry`, extract (preferredFont, fallbackFont)
   * pairs, parse each license into typed atoms, and produce a deduplicated
   * registry indexed by canonical family name.
   *
   * @throws Error when any preset's license expression contains an unknown
   *   atom or is otherwise unparseable. Per the T-307 spec, the enum IS the
   *   contract — unknown atoms surface as smoke-test failures, not silent
   *   widening.
   */
  static buildFromPresets(presetRegistry: PresetRegistry): FontLicenseRegistry {
    const builders = new Map<string, FontEntryBuilder>();

    // Stable iteration order: presetRegistry.list() returns sorted entries.
    for (const preset of presetRegistry.list()) {
      addPreferred(builders, preset);
      addFallbackAsOwnEntry(builders, preset);
    }

    // Materialise: sort referencedBy, freeze entries, sort the map by canonical key.
    const sortedEntries = [...builders.entries()].sort(([a], [b]) => a.localeCompare(b));
    const finalized = new Map<string, FontEntry>();
    for (const [key, b] of sortedEntries) {
      const entry: FontEntry = {
        family: b.family,
        canonicalName: b.canonicalName,
        license: b.license,
        ...(b.approvedFallback !== undefined ? { approvedFallback: b.approvedFallback } : {}),
        referencedBy: [...b.referencedBy].sort(),
      };
      finalized.set(key, entry);
    }
    return new FontLicenseRegistry(finalized);
  }

  /** Lookup by family name — canonicalization-aware (AC #13). */
  get(family: string): FontEntry | undefined {
    return this.byCanonicalName.get(canonicalizeFontFamily(family));
  }

  /** All entries, sorted by canonical name (deterministic — AC #14). */
  list(): FontEntry[] {
    return [...this.byCanonicalName.values()];
  }

  /** Number of distinct canonical families. */
  size(): number {
    return this.byCanonicalName.size;
  }

  /**
   * Validate every entry against an atom whitelist. AND-composite licenses
   * require every atom in the whitelist; OR-composite licenses pass if any
   * atom is whitelisted; single atoms must be in the whitelist directly.
   */
  validateAgainstWhitelist(allowedAtoms: ReadonlyArray<FontLicenseAtom>): ValidationResult {
    const allowed = new Set(allowedAtoms);
    const violations: FontEntry[] = [];
    for (const entry of this.byCanonicalName.values()) {
      if (!isLicenseAllowed(entry.license, allowed)) {
        violations.push(entry);
      }
    }
    return { valid: violations.length === 0, violations };
  }

  /**
   * Audit: list `proprietary-byo` entries that have NO `approvedFallback`
   * attached. Per ADR-004 §D3 + AC #20, these are flagged (not a hard error)
   * — T-308's `check-preset-integrity` may upgrade to a hard gate.
   */
  auditMissingFallback(): FontEntry[] {
    const flagged: FontEntry[] = [];
    for (const entry of this.byCanonicalName.values()) {
      if (entry.license.atoms.includes('proprietary-byo') && entry.approvedFallback === undefined) {
        flagged.push(entry);
      }
    }
    return flagged;
  }
}

// ---------- internals ----------

function addPreferred(builders: Map<string, FontEntryBuilder>, preset: Preset): void {
  const f = preset.frontmatter.preferredFont;
  const license = parseFontLicenseExpression(f.license);
  const key = canonicalizeFontFamily(f.family);
  const builder = builders.get(key);
  if (builder === undefined) {
    const newBuilder: FontEntryBuilder = {
      family: f.family,
      canonicalName: key,
      license,
      referencedBy: new Set([preset.frontmatter.id]),
    };
    if (
      license.atoms.includes('proprietary-byo') &&
      preset.frontmatter.fallbackFont !== undefined
    ) {
      const fb = preset.frontmatter.fallbackFont;
      newBuilder.approvedFallback = {
        family: fb.family,
        weight: fb.weight,
        license: parseFontLicenseExpression(fb.license),
      };
    }
    builders.set(key, newBuilder);
    return;
  }

  // Existing entry — merge referencedBy. Promote approvedFallback if the new
  // preset supplies one and the entry currently lacks it.
  builder.referencedBy.add(preset.frontmatter.id);
  if (
    builder.approvedFallback === undefined &&
    license.atoms.includes('proprietary-byo') &&
    preset.frontmatter.fallbackFont !== undefined
  ) {
    const fb = preset.frontmatter.fallbackFont;
    builder.approvedFallback = {
      family: fb.family,
      weight: fb.weight,
      license: parseFontLicenseExpression(fb.license),
    };
  }
}

/**
 * The fallback font is also a first-class registry entry: it can appear in
 * other presets as a preferred font (e.g., Inter Tight is preferred in some
 * presets, fallback in others), and downstream consumers want a single index.
 */
function addFallbackAsOwnEntry(builders: Map<string, FontEntryBuilder>, preset: Preset): void {
  const fb = preset.frontmatter.fallbackFont;
  if (fb === undefined) return;
  const license = parseFontLicenseExpression(fb.license);
  const key = canonicalizeFontFamily(fb.family);
  const builder = builders.get(key);
  if (builder === undefined) {
    builders.set(key, {
      family: fb.family,
      canonicalName: key,
      license,
      referencedBy: new Set([preset.frontmatter.id]),
    });
    return;
  }
  builder.referencedBy.add(preset.frontmatter.id);
}

function isLicenseAllowed(
  expr: ParsedLicenseExpression,
  allowed: ReadonlySet<FontLicenseAtom>,
): boolean {
  switch (expr.composition) {
    case 'atom':
      return allowed.has(expr.atoms[0] as FontLicenseAtom);
    case 'union':
      // Any atom suffices — caller has the choice.
      return expr.atoms.some((a) => allowed.has(a));
    case 'all':
      // Every atom required.
      return expr.atoms.every((a) => allowed.has(a));
  }
}

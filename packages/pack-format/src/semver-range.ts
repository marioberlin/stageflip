// packages/pack-format/src/semver-range.ts
// T-502 — Minimal semver-range matcher for `platformCompatibility`
// per ADR-012 §D7. Supports the subset of npm-semver-range syntax the
// pack ecosystem actually needs: `^X.Y.Z`, `~X.Y.Z`, `>=X.Y.Z`,
// `<X.Y.Z`, `X.Y.Z - X.Y.Z` ranges, `*` (any).
//
// History: lived in `@stageflip/pack-loader` from T-495 through T-501;
// moved here in T-502 so the compatibility matrix module can reuse it
// without `pack-format → pack-loader` becoming a circular dep.
// `pack-loader` still re-exports `satisfiesRange` for back-compat.
//
// Why a minimal implementation (not the `semver` npm package): the
// `semver` package is ~30KB + a dep we don't need elsewhere. Keeping
// the loader thin avoids npm-tree bloat for tenants. If the marketplace
// later needs the full grammar, swap to `semver` — the matcher's
// surface is a single function.

interface ParsedVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

function parseVersion(s: string): ParsedVersion | null {
  const match = s.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareVersion(a: ParsedVersion, b: ParsedVersion): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/**
 * Test whether the supplied version satisfies the supplied range
 * string per ADR-012 §D7's subset grammar.
 */
export function satisfiesRange(version: string, range: string): boolean {
  const v = parseVersion(version);
  if (v === null) return false;
  const trimmed = range.trim();

  if (trimmed === '*' || trimmed === '') return true;

  if (trimmed.startsWith('^')) {
    const target = parseVersion(trimmed.slice(1));
    if (target === null) return false;
    if (compareVersion(v, target) < 0) return false;
    return v.major === target.major;
  }

  if (trimmed.startsWith('~')) {
    const target = parseVersion(trimmed.slice(1));
    if (target === null) return false;
    if (compareVersion(v, target) < 0) return false;
    return v.major === target.major && v.minor === target.minor;
  }

  if (trimmed.startsWith('>=')) {
    const target = parseVersion(trimmed.slice(2));
    if (target === null) return false;
    return compareVersion(v, target) >= 0;
  }

  if (trimmed.startsWith('<')) {
    const target = parseVersion(trimmed.slice(1));
    if (target === null) return false;
    return compareVersion(v, target) < 0;
  }

  // Hyphen range: `X.Y.Z - X.Y.Z` (inclusive both ends).
  if (trimmed.includes(' - ')) {
    const [lo, hi] = trimmed.split(' - ').map((s) => parseVersion(s.trim()));
    if (lo === undefined || hi === undefined || lo === null || hi === null) return false;
    return compareVersion(v, lo) >= 0 && compareVersion(v, hi) <= 0;
  }

  // Exact version match.
  const exact = parseVersion(trimmed);
  if (exact === null) return false;
  return compareVersion(v, exact) === 0;
}

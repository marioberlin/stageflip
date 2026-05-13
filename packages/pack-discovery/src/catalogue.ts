// packages/pack-discovery/src/catalogue.ts
// T-504 — `PackCatalogue` + the data shapes an editor or other host UI
// consults to list, search/filter, and (via `recommender.ts`) recommend
// packs available in the catalogue. Aggregates one or more
// `PackSource`s; the only sources shipped with T-504 are
// `InstalledPackSource` (walks `~/.stageflip/packs/`) and
// `InMemoryPackSource` (tests + future remote-cache shims). The
// marketplace registry HTTP source lands in T-536.
//
// Determinism perimeter: this package lives OUTSIDE the perimeter per
// CLAUDE.md §3 (host-side library; the editor consumes it).

/** Pack license-kind enum — mirrors `LicenseClaim.kind` from `@stageflip/pack-format`. */
export type PackLicenseKind = 'open' | 'paid-per-tenant' | 'enterprise';

/** One entry in the catalogue listing. */
export interface PackCatalogueEntry {
  readonly publisherId: string;
  readonly publisherDisplayName: string;
  readonly packId: string;
  readonly name: string;
  readonly version: string;
  readonly licenseKind: PackLicenseKind;
  readonly description: string | undefined;
  readonly keywords: readonly string[];
  /** Clusters the pack contributes to, derived from `manifest.contributes.presets[].cluster`. */
  readonly clusters: readonly string[];
  /** True iff the pack is currently installed locally. */
  readonly installed: boolean;
  /** Path on disk if installed; null otherwise. */
  readonly installPath: string | null;
}

/** Filter / pagination options for `PackCatalogue.list`. */
export interface ListOptions {
  readonly licenseKind?: PackLicenseKind;
  readonly cluster?: string;
  readonly keyword?: string;
  readonly publisherId?: string;
  /** Default 50; max 200. */
  readonly limit?: number;
}

/** Source surface — the catalogue aggregates one or more. */
export interface PackSource {
  /** Async fetch of all catalogue entries the source can offer. */
  listAll(): Promise<readonly PackCatalogueEntry[]>;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Aggregate listing + recommendation surface backed by one or more
 * `PackSource`s. Editor UI calls `list` / `get`; the recommender (see
 * `recommender.ts`) calls `list` to gather candidates and applies its
 * scoring rules on top.
 *
 * When two sources return entries for the same `<publisherId>/<packId>`,
 * the highest-version entry wins. The `installed` flag is OR'd across
 * sources so a remote-cache entry whose installed counterpart appears
 * in `InstalledPackSource` correctly reports `installed: true`.
 */
export class PackCatalogue {
  private readonly sources: readonly PackSource[];

  constructor(sources: readonly PackSource[]) {
    this.sources = sources;
  }

  /**
   * Build a `PackCatalogue` directly from a list of entries. Useful in
   * tests and tooling (e.g. CLI commands that prime the catalogue from
   * a JSON blob). Internally wraps the entries in an in-memory source.
   */
  static fromEntries(entries: readonly PackCatalogueEntry[]): PackCatalogue {
    return new PackCatalogue([new EntryArraySource(entries)]);
  }

  /** Aggregate listing across all sources, filtered + sorted. */
  async list(opts: ListOptions = {}): Promise<readonly PackCatalogueEntry[]> {
    const aggregated = await this.aggregate();
    const filtered = aggregated.filter((e) => matches(e, opts));
    const limit = clampLimit(opts.limit);
    return filtered.slice(0, limit);
  }

  /** Find one entry by `<publisherId>/<packId>` (case-sensitive). */
  async get(publisherId: string, packId: string): Promise<PackCatalogueEntry | null> {
    const aggregated = await this.aggregate();
    return aggregated.find((e) => e.publisherId === publisherId && e.packId === packId) ?? null;
  }

  /**
   * Aggregate + dedupe + sort. Same-key entries (publisherId+packId)
   * collapse to the highest-version row; `installed` is OR'd. Sorted
   * by `publisherId` ASC, `packId` ASC, `version` DESC.
   */
  private async aggregate(): Promise<readonly PackCatalogueEntry[]> {
    const all = await Promise.all(this.sources.map((s) => s.listAll()));
    const dedup = new Map<string, PackCatalogueEntry>();
    for (const batch of all) {
      for (const entry of batch) {
        const key = `${entry.publisherId}/${entry.packId}`;
        const existing = dedup.get(key);
        if (existing === undefined) {
          dedup.set(key, entry);
          continue;
        }
        // Same pack from another source — keep the highest version,
        // OR the installed flag, and prefer a non-null installPath.
        const installed = existing.installed || entry.installed;
        const installPath = existing.installPath ?? entry.installPath;
        const winner = compareVersionDesc(entry.version, existing.version) < 0 ? entry : existing;
        dedup.set(key, { ...winner, installed, installPath });
      }
    }
    const out = Array.from(dedup.values());
    out.sort((a, b) => {
      if (a.publisherId !== b.publisherId) return a.publisherId < b.publisherId ? -1 : 1;
      if (a.packId !== b.packId) return a.packId < b.packId ? -1 : 1;
      return compareVersionDesc(a.version, b.version);
    });
    return out;
  }
}

/**
 * Predicate: does `entry` match the supplied filter options? Keyword
 * matching is case-insensitive and tested against `name`,
 * `description`, and each entry in `keywords`.
 */
function matches(entry: PackCatalogueEntry, opts: ListOptions): boolean {
  if (opts.licenseKind !== undefined && entry.licenseKind !== opts.licenseKind) return false;
  if (opts.publisherId !== undefined && entry.publisherId !== opts.publisherId) return false;
  if (opts.cluster !== undefined && !entry.clusters.includes(opts.cluster)) return false;
  if (opts.keyword !== undefined) {
    const needle = opts.keyword.toLowerCase();
    const haystacks = [
      entry.name.toLowerCase(),
      (entry.description ?? '').toLowerCase(),
      ...entry.keywords.map((k) => k.toLowerCase()),
    ];
    if (!haystacks.some((h) => h.includes(needle))) return false;
  }
  return true;
}

/** Clamp `limit` to `[1, MAX_LIMIT]` with a default of 50. */
function clampLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT;
  if (limit < 1) return 1;
  if (limit > MAX_LIMIT) return MAX_LIMIT;
  return Math.floor(limit);
}

/**
 * Compare two semver-shaped strings. Returns < 0 iff `a` is newer than
 * `b` (so an ASC sort by this comparator places newest first — i.e.
 * version-DESC). Falls back to lexicographic compare when either side
 * is non-numeric.
 */
function compareVersionDesc(a: string, b: string): number {
  const pa = parseTriple(a);
  const pb = parseTriple(b);
  if (pa === null || pb === null) {
    if (a === b) return 0;
    return a > b ? -1 : 1;
  }
  if (pa.major !== pb.major) return pb.major - pa.major;
  if (pa.minor !== pb.minor) return pb.minor - pa.minor;
  return pb.patch - pa.patch;
}

function parseTriple(v: string): { major: number; minor: number; patch: number } | null {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (m === null) return null;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3]);
  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) return null;
  return { major, minor, patch };
}

/** Private in-memory source used by `PackCatalogue.fromEntries`. */
class EntryArraySource implements PackSource {
  private readonly entries: readonly PackCatalogueEntry[];
  constructor(entries: readonly PackCatalogueEntry[]) {
    this.entries = entries.map(cloneEntry);
  }
  async listAll(): Promise<readonly PackCatalogueEntry[]> {
    return this.entries;
  }
}

/** Deep clone helper — `keywords` + `clusters` arrays are copied. */
export function cloneEntry(entry: PackCatalogueEntry): PackCatalogueEntry {
  return {
    publisherId: entry.publisherId,
    publisherDisplayName: entry.publisherDisplayName,
    packId: entry.packId,
    name: entry.name,
    version: entry.version,
    licenseKind: entry.licenseKind,
    description: entry.description,
    keywords: [...entry.keywords],
    clusters: [...entry.clusters],
    installed: entry.installed,
    installPath: entry.installPath,
  };
}

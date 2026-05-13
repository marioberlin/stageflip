// packages/pack-discovery/src/sources/installed.ts
// T-504 — `InstalledPackSource` — walks `~/.stageflip/packs/` (or any
// other supplied root path) via `discoverPacks` from
// `@stageflip/pack-loader` and maps each successfully loaded pack to a
// `PackCatalogueEntry`. Failed loads are skipped with a logger
// warning; the catalogue listing remains debris-tolerant.

import {
  type DiscoveredPack,
  type PackLoaderDependencies,
  discoverPacks,
  isPackLoadFailure,
} from '@stageflip/pack-loader';

import type { PackCatalogueEntry, PackSource } from '../catalogue.js';

/** Minimal logger surface — mirrors `@stageflip/pack-telemetry`. */
export interface DiscoveryLogger {
  warn(msg: string): void;
}

/** Default logger — writes to `process.stderr`. */
const defaultDiscoveryLogger: DiscoveryLogger = {
  warn: (msg) => {
    process.stderr.write(`${msg}\n`);
  },
};

/** Construction options for `InstalledPackSource`. */
export interface InstalledPackSourceOptions {
  /** Root path under which `<publisher>/<id>/<version>/` installs
   *  live. Production wiring passes `~/.stageflip/packs/`; tests pass
   *  a tmp dir. */
  readonly rootPath: string;
  /** Loader dependencies — entitlements + publisher keys + platform
   *  version. The source pipes these straight through to
   *  `discoverPacks`. */
  readonly loaderDeps: PackLoaderDependencies;
  /** Optional logger; defaults to `process.stderr`. */
  readonly logger?: DiscoveryLogger;
}

/**
 * `PackSource` backed by the on-disk install root. Every `listAll`
 * call re-walks the filesystem — the catalogue caches if it needs to
 * (T-504 callers are editor UIs that refresh on demand).
 */
export class InstalledPackSource implements PackSource {
  private readonly rootPath: string;
  private readonly loaderDeps: PackLoaderDependencies;
  private readonly logger: DiscoveryLogger;

  constructor(opts: InstalledPackSourceOptions) {
    this.rootPath = opts.rootPath;
    this.loaderDeps = opts.loaderDeps;
    this.logger = opts.logger ?? defaultDiscoveryLogger;
  }

  /**
   * Walk the install root, run the loader's install-time gates, and
   * surface one `PackCatalogueEntry` per successful load. Failed
   * loads emit a `warn(...)` and are skipped.
   */
  async listAll(): Promise<readonly PackCatalogueEntry[]> {
    const discovered = await discoverPacks(this.rootPath, this.loaderDeps);
    const entries: PackCatalogueEntry[] = [];
    for (const row of discovered) {
      const entry = this.mapDiscovered(row);
      if (entry !== null) entries.push(entry);
    }
    return entries;
  }

  private mapDiscovered(row: DiscoveredPack): PackCatalogueEntry | null {
    if (isPackLoadFailure(row.result)) {
      this.logger.warn(
        `[pack-discovery] skipped ${row.installPath}: ${row.result.reason} — ${row.result.detail}`,
      );
      return null;
    }
    const { manifest, installPath } = row.result;
    const clusters = uniqueClusters(manifest.contributes.presets ?? []);
    return {
      publisherId: manifest.publisher.id,
      publisherDisplayName: manifest.publisher.displayName,
      packId: manifest.id,
      name: manifest.name,
      version: manifest.version,
      licenseKind: manifest.license.kind,
      description: manifest.description,
      keywords: manifest.keywords ?? [],
      clusters,
      installed: true,
      installPath,
    };
  }
}

/** Distinct + insertion-order-preserved cluster names from preset contributions. */
function uniqueClusters(presets: ReadonlyArray<{ readonly cluster: string }>): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of presets) {
    if (!seen.has(p.cluster)) {
      seen.add(p.cluster);
      out.push(p.cluster);
    }
  }
  return out;
}

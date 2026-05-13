// packages/pack-discovery/src/sources/in-memory.ts
// T-504 — `InMemoryPackSource` — an in-memory implementation of
// `PackSource` for tests + future remote-cache shimming. Constructor
// deep-copies the supplied entries so the caller can mutate their
// input afterwards without affecting the source.

import { type PackCatalogueEntry, type PackSource, cloneEntry } from '../catalogue.js';

/**
 * `PackSource` backed by a fixed list of entries supplied at
 * construction. Used by tests + future tooling that primes the
 * catalogue from a static blob (e.g. CLI commands, the marketplace
 * registry cache before T-536's HTTP source ships).
 */
export class InMemoryPackSource implements PackSource {
  private readonly entries: readonly PackCatalogueEntry[];

  constructor(entries: readonly PackCatalogueEntry[]) {
    this.entries = entries.map(cloneEntry);
  }

  /** Return the entries supplied at construction. The returned array
   *  is a defensive copy so callers cannot mutate internal state. */
  async listAll(): Promise<readonly PackCatalogueEntry[]> {
    return this.entries.map(cloneEntry);
  }
}

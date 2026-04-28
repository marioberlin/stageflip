// packages/schema/src/presets/registry.ts
// PresetRegistry — in-memory index of every loaded cluster + preset, keyed by
// (cluster, id) for O(1) lookup. Built incrementally by loadAllPresets and
// frozen at the end of the walk so accidental mutation throws.
//
// The registry is the single piece of state in the preset module; all loader
// caching is keyed by rootPath at the loader level (loader.ts) so the
// registry stays a plain in-memory data structure.

import type { PresetCluster } from './frontmatter.js';
import type { ClusterSkill, Preset } from './loader.js';

/** Entries stored per cluster: the cluster skill + every preset in it. */
export interface RegistryClusterEntry {
  skill: ClusterSkill;
  presets: Preset[];
}

/**
 * In-memory index of every loaded preset. Built up by `loadAllPresets`; freeze
 * is called at the end of the walk to prevent later mutation.
 */
export class PresetRegistry {
  /** cluster name → cluster-skill + presets[] */
  private readonly clustersByName = new Map<PresetCluster, RegistryClusterEntry>();
  /** "cluster:id" → preset (flat key for O(1) lookup). */
  private readonly presetsByKey = new Map<string, Preset>();
  private frozen = false;

  /** @internal — used by `loadAllPresets`; do not call from production code. */
  addCluster(name: PresetCluster, entry: RegistryClusterEntry): void {
    if (this.frozen) {
      throw new Error('PresetRegistry is frozen; create a new instance to add clusters');
    }
    this.clustersByName.set(name, entry);
    for (const preset of entry.presets) {
      this.presetsByKey.set(`${name}:${preset.frontmatter.id}`, preset);
    }
  }

  /** @internal — see `addCluster`. */
  freeze(): void {
    this.frozen = true;
  }

  /**
   * O(1) lookup. Returns `undefined` when the cluster is unknown or the id
   * has no matching preset in that cluster.
   */
  get(cluster: PresetCluster, id: string): Preset | undefined {
    return this.presetsByKey.get(`${cluster}:${id}`);
  }

  /**
   * List presets. With `cluster` omitted, returns every preset across every
   * cluster, sorted deterministically (cluster ASC, id ASC). With `cluster`
   * set, returns the cluster's presets in id order. The returned array is a
   * fresh copy — mutating it does not affect the registry.
   */
  list(cluster?: PresetCluster): Preset[] {
    if (cluster !== undefined) {
      const entry = this.clustersByName.get(cluster);
      return entry ? [...entry.presets] : [];
    }
    const all: Preset[] = [];
    for (const c of [...this.clustersByName.keys()].sort()) {
      const entry = this.clustersByName.get(c);
      if (!entry) continue;
      all.push(...entry.presets);
    }
    return all;
  }

  /** Sorted list of cluster names that loaded successfully. */
  clusters(): PresetCluster[] {
    return [...this.clustersByName.keys()].sort();
  }

  /** Lookup the cluster skill (if loaded). */
  getClusterSkill(cluster: PresetCluster): ClusterSkill | undefined {
    return this.clustersByName.get(cluster)?.skill;
  }

  /**
   * Test-only: drop every entry. Production code should not call this — the
   * registry is built once per process and re-built only on bundler restart.
   */
  reset(): void {
    this.clustersByName.clear();
    this.presetsByKey.clear();
    this.frozen = false;
  }
}

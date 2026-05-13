---
title: Pack Discovery
id: skills/stageflip/concepts/pack-discovery
tier: concept
status: substantive
last_updated: 2026-05-14
owner_task: T-504
related:
  - skills/stageflip/concepts/bundles/SKILL.md
  - skills/stageflip/concepts/licensing/SKILL.md
  - skills/stageflip/concepts/pack-telemetry/SKILL.md
---

# Pack Discovery

`@stageflip/pack-discovery` is the host-side library an editor (or
any other UI surface) consults to **list**, **search/filter**, and
**recommend** packs from the catalogue. It is the data-shape + query
surface; the marketplace registry HTTP endpoints land in **T-536**.
The library ships with two sources today — `InstalledPackSource`
(walks `~/.stageflip/packs/`) and `InMemoryPackSource` (tests +
future remote-cache shim) — and is designed so a future remote source
slots in without touching the `PackCatalogue` aggregation logic.

## The data shape

```ts
interface PackCatalogueEntry {
  publisherId: string;
  publisherDisplayName: string;
  packId: string;
  name: string;
  version: string;          // semver
  licenseKind: 'open' | 'paid-per-tenant' | 'enterprise';
  description: string | undefined;
  keywords: readonly string[];
  clusters: readonly string[];     // derived from manifest.contributes.presets[].cluster
  installed: boolean;
  installPath: string | null;
}
```

`clusters` is derived **at source-mapping time**: the
`InstalledPackSource` extracts the distinct + insertion-ordered
`cluster` values from `manifest.contributes.presets[]`. A future
remote source ships them in the wire format; `PackCatalogueEntry`
doesn't care which path produced the value.

## The source pattern

```ts
interface PackSource {
  listAll(): Promise<readonly PackCatalogueEntry[]>;
}
```

A `PackCatalogue` aggregates one or more sources. When two sources
return the same `<publisherId>/<packId>` key, the catalogue:

- Picks the **highest version** as the canonical row.
- **OR**s the `installed` flag — so a remote-cache row for an
  already-installed pack reports `installed: true`.
- Prefers a non-null `installPath`.

Listing is sorted `publisherId` ASC, then `packId` ASC, then `version`
DESC. The sort is stable and deterministic.

`PackCatalogue.fromEntries(entries)` is a one-liner for tests +
tooling — it wraps the entries in an in-memory source internally.

## Filtering

```ts
catalogue.list({
  licenseKind: 'open',       // exact-match
  cluster: 'cluster-a',      // entry.clusters.includes(cluster)
  keyword: 'sports',         // case-insensitive substring on name + description + keywords
  publisherId: 'acme',       // exact-match
  limit: 50,                 // default 50, clamped to 200
});
```

Multiple filters AND together. `keyword` is a substring match
(not full-text), case-insensitive across name + description +
every entry in `keywords`.

## Recommendation scoring rules

```ts
recommendPacks(catalogue, {
  clustersInUse: ['cluster-a', 'cluster-d'],
  installed: new Set(['acme/already-have-it']),
  limit: 5,
});
```

The recommender scores every catalogue entry against four transparent
+ testable rules:

| Rule | Δ |
|---|---|
| Per cluster in `clustersInUse` that the pack contributes to | **+0.4** |
| Per keyword in `entry.keywords` that overlaps a cluster name (case-insensitive) | **+0.2** |
| Pack is already installed (via `input.installed` set or `entry.installed === true`) | **−0.5** |
| License weighting | `open: +0.1`, `paid-per-tenant: 0`, `enterprise: −0.1` |

Sum the rule deltas, clamp to `[0, 1]`, sort descending. Ties break
alphabetically by `publisherId` then `packId` for determinism. The
returned `reason` string names the single largest positive
contribution (cluster match > keyword match > license bonus).

Rationale for the license weighting: absent any other signal, prefer
the lowest-friction pack for the editor's user. The values are small
enough that any cluster signal dominates.

## Editor surface (T-546)

The library also ships an editor-side observation + ranking + caching
surface that adapts the T-504 base recommender to the editor's signals
WITHOUT reimplementing the scorer. The four pieces:

```ts
// 1. Observe the editor document.
const usage = new ClusterUsageTracker();
usage.recordClipAdded('text', 'cluster-a', Date.now());
usage.recordClipAdded('lower-third', 'cluster-d', Date.now());
usage.recordClipRemoved('cluster-a');           // pops most-recent row
const report = usage.reportByCluster();          // sorted count DESC, clusterId ASC
const inUse = usage.clustersInUse();             // distinct, insertion-ordered

// 2. Rank — wraps `recommendPacks` from T-504 unchanged.
const recs = await rankRecommendationsForEditor(catalogue, {
  usage,
  installed: new Set(['acme/already-have-it']),
  limit: 5,
});

// 3. Cache to avoid re-ranking on every keystroke.
const cache = new RecommendationCache({ ttlMs: 5_000 });
cache.set(cacheKey, recs);
cache.get(cacheKey);                              // null after ttlMs
cache.size();                                     // lazily evicts expired

// 4. Emit typed telemetry events the editor flushes to pack-telemetry.
const ev = makeDiscoveryEvent({
  kind: 'click',
  packIdHash: 'sha256-...',
  position: 0,
});
```

Design rules:

- **The ranker MUST NOT fork the scorer.** `rankRecommendationsForEditor`
  derives `clustersInUse` from the tracker and forwards `installed` +
  `limit` through to `recommendPacks`. If future editor work needs
  recency weighting or other nuance, widen the base recommender's
  input — don't duplicate the scoring math.
- **The cache is keyed by caller-supplied strings.** Callers typically
  hash `(clustersInUse, installed)` deterministically. The cache
  injects a `now()` source so tests stay deterministic.
- **Discovery events carry `packIdHash`, not raw IDs.** The editor
  hashes one-way before constructing the event; raw publisher / pack
  identifiers never leave the device through this channel.
- **Rendering the surface is a future apps/* task.** This module is
  the typed library only — no React, no DOM, no Vue.

## What this is NOT

- **Not a remote registry client.** The marketplace registry HTTP
  endpoints land in **T-536**. When that ships, it will land a third
  `PackSource` implementation and reuse `PackCatalogue` unchanged.
- **Not a telemetry sink.** Telemetry events for install / activation
  / usage live in `@stageflip/pack-telemetry` (T-503). Discovery is
  read-only.
- **Not a cache.** Every `list` re-asks every source. Hosts that want
  caching wrap the catalogue themselves.

## Determinism perimeter

`@stageflip/pack-discovery` lives **OUTSIDE** the determinism
perimeter (CLAUDE.md §3 — perimeter is `packages/runtimes/**`,
`packages/frame-runtime/**`, `packages/renderer-core/src/clips/**`).
It's a host-side library; the editor consumes it.

## Cross-references

- **ADR-012** — Bundle Format & License Runtime (manifest field
  shapes the catalogue rows map from).
- **ADR-013** — First-party Pack Catalogue & Pricing Tiers
  (`licenseKind` source of truth).
- **ADR-014 §D** — Marketplace registry HTTP endpoints (lands in
  T-536; this library is the consumer of that surface once it ships).
- **`@stageflip/pack-loader`** — produces `DiscoveredPack`; the
  installed source maps successful loads to `PackCatalogueEntry`.
- **T-536** — Marketplace registry endpoints (adds the remote
  `PackSource` implementation).
- **T-541** — Pack telemetry dashboard (a peer consumer of the
  pack ecosystem; not a discovery dependency).

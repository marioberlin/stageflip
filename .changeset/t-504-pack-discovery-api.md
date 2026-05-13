---
'@stageflip/pack-discovery': minor
---

T-504 — New `@stageflip/pack-discovery` package providing the
host-side library an editor (or other UI surface) consults to list,
search/filter, and recommend packs from the catalogue. The data
shape (`PackCatalogueEntry`) carries publisher / pack identity,
semver version, `licenseKind`, description, keywords, clusters
derived from `manifest.contributes.presets[].cluster`, and
installed-status flags. `PackCatalogue` aggregates one or more
`PackSource`s, dedupes same-key entries to the highest version,
ORs the `installed` flag across sources, and returns rows sorted
`publisherId` ASC / `packId` ASC / `version` DESC. Filtering
supports licenseKind, cluster, case-insensitive keyword (across
name + description + keywords), publisherId, and a limit clamped
to [1, 200] with a default of 50. Two sources ship: `InstalledPackSource`
walks `~/.stageflip/packs/` via `@stageflip/pack-loader`'s
`discoverPacks` and skips failed loads with a logger warning;
`InMemoryPackSource` deep-copies its constructor input for tests
+ future remote-cache shims. `recommendPacks(catalogue, input)`
scores every entry against four transparent rules (+0.4 per
matched cluster, +0.2 per keyword overlap with a cluster name,
−0.5 if installed, license weighting open: +0.1 / paid: 0 /
enterprise: −0.1), clamps to [0, 1], sorts descending with
alphabetical tiebreak, and returns the top `limit` (default 5).
The marketplace registry HTTP source lands in T-536 and will slot
in as a third `PackSource` without touching aggregation logic.

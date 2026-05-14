// packages/pack-discovery/src/index.ts
// T-504 — Public surface of `@stageflip/pack-discovery`. The
// host-side editor (or other UI) consults this library to list packs
// available in the catalogue, filter by license-kind/cluster/keyword,
// and recommend packs based on the host's current cluster usage. The
// marketplace registry HTTP source lands in T-536; T-504 ships against
// `InstalledPackSource` + `InMemoryPackSource` only.

export {
  type ListOptions,
  PackCatalogue,
  type PackCatalogueEntry,
  type PackLicenseKind,
  type PackSource,
} from './catalogue.js';

export {
  type DiscoveryLogger,
  InstalledPackSource,
  type InstalledPackSourceOptions,
} from './sources/installed.js';
export { InMemoryPackSource } from './sources/in-memory.js';

export {
  type PackRecommendation,
  type RecommenderInput,
  recommendPacks,
} from './recommender.js';

// T-546 — editor-side observation + ranking + caching surface.
export {
  type ClusterUsageReport,
  ClusterUsageTracker,
  type DocumentClusterUsage,
} from './editor/cluster-usage-tracker.js';
export {
  type EditorRecommendationInput,
  rankRecommendationsForEditor,
} from './editor/recommendation-ranker.js';
export {
  RecommendationCache,
  type RecommendationCacheEntry,
  type RecommendationCacheOptions,
} from './editor/recommendation-cache.js';
export {
  type DiscoveryEvent,
  type DiscoveryEventKind,
  type MakeDiscoveryEventOptions,
  makeDiscoveryEvent,
} from './editor/discovery-event.js';

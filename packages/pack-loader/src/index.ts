// packages/pack-loader/src/index.ts
// T-495 — Public surface of `@stageflip/pack-loader`. Reads installed
// packs from `~/.stageflip/packs/` per ADR-012 §D8, runs the five
// install-time gates per ADR-012 §D6, and surfaces failures via the
// 5 LF-* loss flag codes from `@stageflip/pack-format`.
//
// Concrete `TenantEntitlementsStore` (T-496) + `PublisherKeyRegistry`
// (T-499) implementations live in their own packages and satisfy the
// `*Like` interfaces re-exported here.

export {
  type PackLoaderDependencies,
  type PublisherKeyRegistryLike,
  type TenantEntitlement,
  type TenantEntitlementsLike,
  requiresEntitlement,
} from './dependencies.js';

export {
  type DiscoveredPack,
  discoverPacks,
} from './discover-packs.js';

export {
  type PackInstallation,
  type PackLoadFailure,
  isPackLoadFailure,
  loadPack,
} from './load-pack.js';

export { satisfiesRange } from './semver-range.js';

export {
  type CataloguePackVersion,
  type PackUpgradeRow,
  type PackUpgradeStatus,
  type UpgradePlan,
  type UpgradePlanInput,
  catalogueKey,
  planUpgrade,
} from './upgrade-planner.js';

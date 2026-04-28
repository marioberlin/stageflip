// packages/render-farm/src/index.ts
// @stageflip/render-farm — render-farm adapter contract + in-memory adapter +
// K8s stub + env-driven selector (T-266). Source of truth:
// skills/stageflip/concepts/runtimes/SKILL.md §"Render farm deployment".
//
// Vendor implementations (CoreWeave / Paperspace / GKE / etc.) ship as
// separate packages or land here once a vendor is picked. The contract is the
// stable surface; concrete adapters are the swap point.

export type {
  RenderFarmAdapter,
  RenderFarmCapabilities,
  RenderFarmJob,
  RenderFarmJobResources,
  RenderFarmJobState,
  RenderFarmJobStatus,
  StreamLogsOptions,
} from './contract.js';

export {
  NotImplementedError,
  RenderFarmJobNotFoundError,
  RenderFarmSubmitError,
} from './errors.js';

export {
  InMemoryRenderFarmAdapter,
  type InMemoryRenderFarmAdapterOptions,
  type SpawnFn,
} from './in-memory.js';

export {
  KubernetesRenderFarmAdapter,
  type KubernetesAdapterConfig,
} from './k8s-stub.js';

export {
  RENDER_FARM_ADAPTER_ENV_VAR,
  type RenderFarmAdapterKind,
  __resetSelectorCache,
  getRenderFarmAdapter,
} from './selector.js';

export {
  buildFinishedMarker,
  buildStartedMarker,
  FINISHED_MARKER_PREFIX,
  parseMarkerLine,
  type ParsedMarker,
  STARTED_MARKER_PREFIX,
} from './state-markers.js';

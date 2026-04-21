// packages/renderer-cdp/src/index.ts
// Public surface of @stageflip/renderer-cdp. See individual modules for
// detail; the shape is:
//
//   - Helpers: reimpl of the two @hyperframes/core symbols the vendored
//     engine uses (vendor-core-helpers).
//   - Dispatcher: RIRDocument → DispatchPlan via the shared runtime
//     registry (dispatch).
//   - Adapter: live-tier LiveTierAdapter + CdpSession integration seam
//     (adapter).
//
// T-083 ships the dispatcher and the adapter skeleton. Real Puppeteer
// wiring (a concrete CdpSession backed by the vendored engine) lands in
// T-084+ — see docs/escalation-T-083.md §P1 and the plan's T-083 [rev]
// row.

export {
  MEDIA_VISUAL_STYLE_PROPERTIES,
  type MediaVisualStyleProperty,
  quantizeTimeToFrame,
} from './vendor-core-helpers';

export {
  type DispatchedClip,
  type DispatchPlan,
  dispatchClips,
  type UnresolvedClip,
  type UnresolvedReason,
} from './dispatch';

export {
  type CdpSession,
  type CompositionConfig,
  DispatchUnresolvedError,
  LiveTierAdapter,
  type MountedComposition,
  type SessionHandle,
} from './adapter';

export { type FrameSink, InMemoryFrameSink } from './frame-sink';

export {
  type AssetRef,
  preflight,
  type PreflightBlocker,
  type PreflightBlockerKind,
  type PreflightReport,
} from './preflight';

export {
  type ExportOptions,
  type ExportResult,
  exportDocument,
  PreflightBlockedError,
} from './export-dispatcher';

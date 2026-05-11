// packages/export-router/src/index.ts
// Public surface of `@stageflip/export-router`. T-408 ships:
//   - `routeExport(target, document) => RoutingDecision`
//   - `detectLiveClips(document) => ReadonlyArray<OmittedLiveClip>`
//   - `RoutingDecision` discriminated union + `ExporterPackage` /
//     `OmittedLiveClip` types.
//
// The router is a pure-function dispatcher consuming `EXPORT_MATRIX` from
// `@stageflip/schema` (per ADR-003 §D3). Browser-safe; no I/O.

export { detectLiveClips, routeExport } from './router.js';
export type { ExporterPackage, OmittedLiveClip, RoutingDecision } from './types.js';

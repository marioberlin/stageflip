---
"@stageflip/render-farm": minor
---

T-266: initial release of `@stageflip/render-farm` — render-farm adapter
contract + `InMemoryRenderFarmAdapter` (child_process) + `KubernetesRenderFarmAdapter`
stub + env-driven `getRenderFarmAdapter` selector.

The adapter pattern decouples the bake worker (T-265) from the vendor choice
(CoreWeave / Paperspace / GKE / etc.). T-266 ships the contract and one fake
implementation; the real K8s vendor adapter lands when the first prod load
demands it. See `docs/ops/render-farm-vendors.md` for the cost / throughput /
ops tradeoffs and the current (non-binding) GKE recommendation.

The blender worker (T-265) gains an optional `stateMarkers` dep that emits
two parseable stdout markers (`STAGEFLIP_RENDER_FARM_STARTED bakeId=...` and
`STAGEFLIP_RENDER_FARM_FINISHED bakeId=... status=...`). The in-memory adapter
parses these to drive job lifecycle transitions. Existing T-265 tests pass
unchanged — the marker emitter is opt-in.

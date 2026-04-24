---
'@stageflip/engine': minor
'@stageflip/agent': minor
---

T-151a — `@stageflip/engine` ships the hierarchical tool-bundle loader:
registry + loader + canonical catalog. `@stageflip/agent`'s Planner
migrates off its stub bundle list and consumes the engine registry.

`@stageflip/engine`:

- `ToolBundle` / `BundleSummary` types; `summarise(bundle)` helper.
- `BundleRegistry` class: `register(bundle)`, `mergeTools(name, tools)`
  (appends — used by T-155–T-168 handler packages), `list()` (backs the
  `list_bundles` meta-tool, returns summaries), `get(name)` (backs
  `expand_scope`, returns full bundle), `has` / `size`.
- `createCanonicalRegistry()` — returns a fresh registry seeded with the
  14 canonical bundles from `CANONICAL_BUNDLES`. Each call is independent;
  mutations do not leak between instances.
- `BundleLoader` — stateful per-Executor-step context. `load(name)` is
  the `load_bundle` meta-tool. Refuses with `BundleLoadError` on
  `unknown_bundle`, `already_loaded`, or `limit_exceeded`. Default cap
  `DEFAULT_TOOL_LIMIT = 30` (invariant I-9). `reset()` clears between
  steps; `toolDefinitions()` flattens to the exact `LLMToolDefinition[]`
  the Executor passes to the LLM.
- Canonical tool arrays are empty today — T-155–T-168 populate them via
  `registry.mergeTools(name, handlerTools)` from handler packages. The
  Planner sees the catalog irrespective of handler readiness.

`@stageflip/agent`:

- Drops the `packages/agent/src/planner/bundles.ts` stub.
- `createPlanner({ provider, registry? })` — `registry` defaults to
  `createCanonicalRegistry()`; override for mode-specific scoping.
- `PlannerRequest.bundles?` still overrides per-request.
- Barrel re-exports the registry + loader APIs from `@stageflip/engine`
  so consumers stay on one import root.

Tests: 19 engine tests (loader + registry + types) at 100% line coverage
on every non-barrel file; 25 agent tests (post-migration; bundles tests
moved to engine). All 9 gates green.

Unblocks T-152 (Executor constructs a `BundleLoader` per plan step and
passes `toolDefinitions()` to the LLM) and T-155–T-168 (handler packages
populate bundles via `mergeTools`).

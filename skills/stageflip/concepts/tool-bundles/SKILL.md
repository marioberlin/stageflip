---
title: Tool Bundles
id: skills/stageflip/concepts/tool-bundles
tier: concept
status: substantive
last_updated: 2026-04-24
owner_task: T-151a
related:
  - skills/stageflip/concepts/agent-planner/SKILL.md
  - skills/stageflip/concepts/agent-executor/SKILL.md
  - skills/stageflip/concepts/llm-abstraction/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tool Bundles

StageFlip ships ~80 semantic tools. An LLM context ballooning to 80 tool
definitions wastes tokens and degrades plan quality. **Invariant I-9**: no
agent context holds more than 30 tool definitions at once.

## The 14 bundles

| Bundle | Tools |
|---|---|
| read | 5 |
| create-mutate | 8 |
| timing | 4 |
| layout | 5 |
| validate | 4 |
| clip-animation | 14 |
| element-cm1 | 12 |
| slide-cm1 + accessibility | 6 |
| table-cm1 | 6 |
| qc-export-bulk | 9 |
| fact-check | 2 |
| domain-finance-sales-okr | 27 |
| data-source-bindings | 2 |
| semantic-layout | 4 |

Each bundle owns a cohesive capability slice. Tools belong to exactly one
bundle.

## Hierarchical loading

Three meta-tools are always available:

- `list_bundles()` → `{ name, description, toolCount }[]`
- `load_bundle(name)` → loads the bundle's tools into the executor's context
- `expand_scope(bundle)` → like `load_bundle` but for a planner that wants to
  inspect a bundle's contents without committing to it

Planner reads over `list_bundles` output, decides which bundles each step
needs, emits a plan that pins its bundle set. Executor loads only the pinned
bundles.

## Enforcement

- Registry-side: every tool declares its bundle in code. A lint rule rejects
  tools that declare none or more than one.
- Runtime-side: the bundle loader refuses to exceed 30 loaded tools; if a plan
  would require more, it's rejected back to the planner with "split into
  steps using different bundle sets".
- Test-side: an integration test walks every registered bundle and asserts
  I-9 holds for any single-step loading pattern.

## Example — planner output

```json
{
  "plan": [
    {
      "step": "create shell slide",
      "bundles": ["create-mutate", "layout", "slide-cm1"],
      "rationale": "new slide + title + body placement + accessibility tags"
    },
    {
      "step": "populate with revenue chart",
      "bundles": ["data-source-bindings", "clip-animation", "validate"]
    }
  ]
}
```

## Current state (Phase 7, T-151a shipped)

`@stageflip/engine` ships the registry + loader:

- `BundleRegistry` — `register(bundle)`, `mergeTools(name, tools)`,
  `list()` (backs `list_bundles`), `get(name)` (backs `expand_scope`),
  `has(name)`, `size`.
- `createCanonicalRegistry()` — returns a fresh registry seeded with the
  14 canonical entries from `CANONICAL_BUNDLES`. Each call is independent;
  mutations do not leak between instances.
- `BundleLoader` — stateful per-Executor-step context. `load(name)` is the
  `load_bundle(name)` meta-tool. Refuses on `unknown_bundle`,
  `already_loaded`, or `limit_exceeded` (via `BundleLoadError`); the
  default cap is `DEFAULT_TOOL_LIMIT = 30` (invariant I-9). `reset()`
  clears the loaded set between steps; `toolDefinitions()` flattens to the
  exact `LLMToolDefinition[]` the Executor passes to the LLM.
- Canonical tool arrays are empty today. T-155–T-168 populate each bundle
  via `registry.mergeTools(name, tools)` from their handler packages; the
  Planner sees the bundle catalog irrespective of handler readiness.

Consumers:
- Planner (`@stageflip/agent`, T-151) imports `createCanonicalRegistry()`
  and feeds `registry.list()` into the system prompt.
- Executor (T-152) will construct a `BundleLoader` per step, call
  `load()` for each pinned bundle, pass `toolDefinitions()` to the
  provider.

Phase 7 follow-ups:
- Tool-router with Zod-validated I/O (T-154) wires `BundleLoader` to the
  dispatcher.
- Handler bundles (T-155–T-168) land incrementally; each PR calls
  `registry.mergeTools(bundleName, handlerTools)`.
- Auto-generated `tools/*/SKILL.md` per bundle (T-169).

Skills under `tools/` today remain placeholders authored in T-012.

## Related

- Planner: `concepts/agent-planner/SKILL.md`
- Executor: `concepts/agent-executor/SKILL.md`
- Tool-router (Zod validation + dispatch): T-154
- Per-bundle auto-generated index: `tools/*/SKILL.md` (T-169)

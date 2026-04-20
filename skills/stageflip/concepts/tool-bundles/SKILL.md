---
title: Tool Bundles
id: skills/stageflip/concepts/tool-bundles
tier: concept
status: substantive
last_updated: 2026-04-20
owner_task: T-151a
related:
  - skills/stageflip/concepts/agent-planner/SKILL.md
  - skills/stageflip/concepts/agent-executor/SKILL.md
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

## Current state (Phase 1 exit)

Not yet implemented. Phase 7 delivers:
- Tool-bundle loader + meta-tools (T-151a)
- Tool-router with Zod-validated I/O (T-154)
- The 14 handler bundles (T-155–T-168)
- Auto-generated `tools/*/SKILL.md` per bundle (T-169)

Skills under `tools/` today are placeholders authored in T-012.

## Related

- Planner: `concepts/agent-planner/SKILL.md`
- Executor: `concepts/agent-executor/SKILL.md`
- Tool-router (Zod validation + dispatch): T-154
- Per-bundle auto-generated index: `tools/*/SKILL.md` (T-169)

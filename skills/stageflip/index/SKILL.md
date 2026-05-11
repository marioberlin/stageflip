---
title: StageFlip Skill Tree — Top-level index
id: skills/stageflip/index
tier: concept
status: substantive
last_updated: 2026-05-11
owner_task: T-412
related:
  - skills/stageflip/concepts/skills-tree/SKILL.md
  - skills/stageflip/tools/SKILL.md
  - skills/stageflip/runtimes/SKILL.md
  - skills/stageflip/clips/catalog/SKILL.md
  - skills/stageflip/reference/schema/SKILL.md
  - skills/stageflip/reference/cli/SKILL.md
  - skills/stageflip/reference/validation-rules/SKILL.md
  - skills/stageflip/presets/SKILL.md
---

# StageFlip Skill Tree — Top-level index

A pointer-only index. Frontmatter / body conventions for every SKILL.md live in `concepts/skills-tree/SKILL.md`. This file just shows the shape of the tree and links to each subtree's entry point so agents (and humans) landing in the skill tree have one place to start.

This file is hand-authored and intentionally thin. It does NOT duplicate the auto-generated content under `tools/`, `runtimes/`, `clips/catalog/`, or `reference/`.

## Subtrees

### Auto-generated catalogues

| Subtree | Index | Generator | What it covers |
|---|---|---|---|
| Tools | [`tools/SKILL.md`](../tools/SKILL.md) | `pnpm gen:tool-skills` | Every handler bundle in `packages/engine/src/handlers/` (24 bundles on `main`); per-bundle SKILLs enumerate the bundle's tools |
| Runtimes | [`runtimes/SKILL.md`](../runtimes/SKILL.md) | `pnpm skills-sync` | Every runtime kind under `packages/runtimes/`; per-runtime SKILL describes the contract surface |
| Clip catalog | [`clips/catalog/SKILL.md`](../clips/catalog/SKILL.md) | `pnpm skills-sync` | Every clip primitive shipping in any runtime |
| Schema reference | [`reference/schema/SKILL.md`](../reference/schema/SKILL.md) | `pnpm skills-sync` | Canonical document schema |
| CLI reference | [`reference/cli/SKILL.md`](../reference/cli/SKILL.md) | `pnpm skills-sync` | `stageflip <cmd>` enumeration |
| Validation rules | [`reference/validation-rules/SKILL.md`](../reference/validation-rules/SKILL.md) | `pnpm skills-sync` | Rules that the document validator enforces |

### Hand-authored

| Subtree | Path | What it covers |
|---|---|---|
| Concepts | [`concepts/`](../concepts/) | Invariants and vocabulary (determinism, theme system, parity testing, skill tree itself, …) |
| Workflows | [`workflows/`](../workflows/) | Multi-tool end-to-end flows (import-pptx, learn-theme, parity-testing, …) |
| Modes | [`modes/`](../modes/) | One per product (`stageflip-slide`, `stageflip-video`, `stageflip-display`) |
| Profiles | [`profiles/`](../profiles/) | The schema/tools/validation bundle a mode uses |
| Agents | [`agents/`](../agents/) | Agent personas (`type-design-consultant`) |
| Presets | [`presets/SKILL.md`](../presets/SKILL.md) | The 8 preset clusters (50 ratified presets on `main`) |

## When this file moves

If `pnpm gen:tool-skills` ever produces a top-level catalogue index, this file moves under that generator's ownership. Until then, it is the orchestration layer above the auto-generated subtrees.

## Maintenance

Hand-edited. Bump `last_updated` when:

- A new top-level subtree is added under `skills/stageflip/`
- A subtree's auto-gen status changes (new generator, generator removed)
- A subtree's index file is renamed

Do NOT bump on routine adds inside a subtree — those are owned by the subtree's generator (auto) or the subtree's own SKILL.md (hand).

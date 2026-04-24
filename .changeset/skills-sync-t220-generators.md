---
"@stageflip/skills-sync": minor
"@stageflip/cdp-host-bundle": patch
---

T-220: `@stageflip/skills-sync` — four new generators to auto-emit
skill files from the canonical source of truth:

- `generateClipsCatalogSkill` (ClipsCatalogPkg) →
  `skills/stageflip/clips/catalog/SKILL.md`.
- `generateToolsIndexSkill` (ToolsIndexPkg) →
  `skills/stageflip/tools/SKILL.md`.
- `generateRuntimesIndexSkill` (RuntimesIndexPkg) →
  `skills/stageflip/runtimes/SKILL.md`.
- `generateCliReferenceSkill` (CliReferencePkg) — ready for T-226
  to wire against `apps/cli`'s command registry; not yet invoked.

`scripts/sync-skills.ts` produces all three new skill files.
`packages/cdp-host-bundle/src/runtimes.test.ts` gains a drift test
that cross-checks the hand-maintained `LIVE_RUNTIME_MANIFEST`
against `listRuntimes()` after `registerAllLiveRuntimes()` fires
in happy-dom — keeps the manifest honest without running
browser-only runtime deps in the node sync script.

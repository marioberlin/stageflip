---
---

T-548 — `check-skill-drift` extension: a fifth check
(`pack-skill-extension`) walks `skills/stageflip/concepts/pack-*/SKILL.md`
and validates each pack-contributed concept-skill's frontmatter against
the standard `skillFrontmatterSchema`. **Warnings-only by design**: per
CLAUDE.md §5 (T-547 update), installed packs ship at their own cadence
and the workspace gate must surface — but never fail-build on — per-pack
drift. The new `CheckResult` always returns `errors: []`; every issue
lands in `warnings` and the report's `exitCode` is unaffected by pack
drift.

The existing `tier-coverage` invariant remains **core-only** (unmodified):
pack-contributed concept skills do not feed into the "every tier has ≥1
SKILL.md" rule. The change is tooling-only — no publishable package
version bumps.

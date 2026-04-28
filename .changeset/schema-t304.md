---
'@stageflip/schema': minor
---

Add preset schema primitive (T-304): loader + validator + frontmatter parser
for the SKILL.md tree at `skills/stageflip/presets/`. New public surface
`@stageflip/schema/presets` exports `presetFrontmatterSchema`,
`clusterSkillFrontmatterSchema`, `loadPreset`, `loadCluster`, `loadAllPresets`,
`PresetRegistry`, and the three preset error classes. Additive — no breaking
changes. License vocabulary is deliberately permissive (T-307 owns the
canonical enum per ADR-004 §D3).

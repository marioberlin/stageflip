---
"@stageflip/skills-core": patch
---

P13 scaffold: extend `SKILL_TIERS` with two new values.

- `cluster` — for preset cluster `SKILL.md` files under
  `skills/stageflip/presets/{cluster}/SKILL.md` (8 added in P13
  scaffold: news / sports / weather / titles / data / captions /
  ctas / ar).
- `agent` — for AI-agent role specs under `skills/stageflip/agents/`
  (1 added in P13 scaffold: type-design-consultant).

Backward-compatible additive change to the Zod enum; loader and
validator already handle unknown tiers via the schema, so existing
consumers see no behavioural change. Tier-coverage gate
(`scripts/check-skill-drift.ts`) now requires at least one
`SKILL.md` per tier — the P13 scaffold satisfies this for both new
tiers.

Companion skill-tree files land in `plan/P13-scaffold` PR #165
alongside this changeset. Companion docs sidebar update lives in
`apps/docs` (app — not publishable; no changeset needed).

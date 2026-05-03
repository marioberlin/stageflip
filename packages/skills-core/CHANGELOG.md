# @stageflip/skills-core

## 0.1.0

### Minor Changes

- 36d0c5d: T-227: make the Phase-10 publish targets shippable via Changesets.
  - Renames the CLI's workspace name from `@stageflip/app-cli` →
    `@stageflip/cli` (the plan's publishable name).
  - Drops `"private": true` from the 11 packages in the publishable
    closure: the three primary targets (`@stageflip/{cli,plugin,mcp-server}`)
    plus their transitive deps (`@stageflip/{engine,llm-abstraction,schema,
skills-core,skills-sync,validation,rir,runtimes-contract}`).
  - Adds `"publishConfig": { "access": "public" }`, `"license":
"BUSL-1.1"`, `"repository"`, and `"homepage"` metadata to each
    publishable package. Primary targets also get a `"description"`
    visible on npmjs.com.
  - Copies the root `LICENSE` into each publishable package dir so
    tarballs carry the license even outside the monorepo.
  - Flips `.changeset/config.json`'s `access` from `"restricted"` to
    `"public"`.
  - Adds `.github/workflows/release.yml` — Changesets-driven: opens a
    "Version Packages" PR when changesets land on main; `pnpm publish`
    fires on merge of that PR iff `NPM_TOKEN` is configured.

  Actual publishing is opt-in via the NPM_TOKEN secret; this PR does
  NOT run `changeset publish`.

### Patch Changes

- 164b50f: P13 scaffold: extend `SKILL_TIERS` with two new values.
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

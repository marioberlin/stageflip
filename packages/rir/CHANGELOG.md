# @stageflip/rir

## 0.1.0

### Minor Changes

- bbcbd38: T-251 — Add `apply-inheritance` pass at the front of the `compileRIR` pass list. The pass is a thin wrapper around `@stageflip/schema`'s pure `applyInheritance(doc)` helper plus diagnostic emission for unresolved references. New diagnostic codes: `LF-RIR-LAYOUT-NOT-FOUND` (slide carries a `layoutId` that does not resolve in `Document.layouts`) and `LF-RIR-PLACEHOLDER-NOT-FOUND` (element `inheritsFrom.placeholderIdx` does not match any placeholder on the layout or its master). `compilerDiagnosticSchema.pass` enum extended with `'apply-inheritance'`. Fast path: documents with empty `layouts` and `masters` produce byte-identical RIR output.
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

- Updated dependencies [2f0ae52]
- Updated dependencies [6cfbb4c]
- Updated dependencies [6474d98]
- Updated dependencies [a36fcbe]
- Updated dependencies [8ddef40]
- Updated dependencies [e054d6d]
- Updated dependencies [4fe6fda]
- Updated dependencies [12a98d3]
- Updated dependencies [ca945df]
- Updated dependencies [5af6789]
- Updated dependencies [22d44d6]
- Updated dependencies [b6d2229]
- Updated dependencies [a4bb803]
- Updated dependencies [bbcbd38]
- Updated dependencies [d393eff]
- Updated dependencies [3112c98]
- Updated dependencies [e422e50]
- Updated dependencies [7c0165c]
- Updated dependencies [732f6c7]
- Updated dependencies [36d0c5d]
- Updated dependencies [38e4017]
  - @stageflip/schema@0.1.0

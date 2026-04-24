# @stageflip/cli

## 0.1.0

### Minor Changes

- 2524d7f: T-225: `apps/cli` — `stageflip` CLI.

  Built on `commander@13.1.0` (MIT). Every entry in user-manual.md §4
  is registered (~35 commands); seven ship end-to-end this phase
  (login / logout / whoami / doctor / render / export / plugin install),
  the rest are registered stubs that print a clear "not yet implemented
  (planned: T-NNN)" diagnostic + exit 1.

  - `CLI_COMMAND_REGISTRY` is the single source of truth; T-226 will
    project it into `@stageflip/skills-sync`'s `CliReferencePkg` shape
    via `commandRegistryAsCliReferencePkg()`.
  - `login` drives T-223's `runAuthFlow` against T-224's
    `createGoogleAuthProvider`; tokens persist via T-223's
    `createFileTokenStore`.
  - `plugin install [dest]` calls T-224's `writePluginBundle` to
    produce a Claude-plugin directory from the local skills tree.
  - `doctor` reports node version, token-store presence, API URL, and
    MCP URL; fails non-zero on bad MCP URL.
  - `whoami` prints the stored principal; verifies the JWT claim when
    `STAGEFLIP_JWT_SECRET` is set.

  23 unit tests across registry (8) + doctor (4) + render (4) +
  plugin-install (2) + auth (5). All gates green.

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

- Updated dependencies [e7b91d0]
- Updated dependencies [2e1e7d6]
- Updated dependencies [1f303f8]
- Updated dependencies [624038f]
- Updated dependencies [3096a1c]
- Updated dependencies [36d0c5d]
- Updated dependencies [9ea2199]
  - @stageflip/mcp-server@0.1.0
  - @stageflip/plugin@0.1.0
  - @stageflip/skills-sync@0.1.0

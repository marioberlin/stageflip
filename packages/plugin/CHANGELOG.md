# @stageflip/plugin

## 0.1.0

### Minor Changes

- 1f303f8: T-224: `@stageflip/plugin` — Claude-plugin bundler.

  `writePluginBundle(args)` produces the directory layout
  `claude plugin install stageflip` consumes:

  - `.claude-plugin/plugin.json` (SemVer + kebab-case validation)
  - `.mcp.json` wiring the StageFlip MCP server over HTTPS
  - `skills/…` mirroring the repo's skills tree

  The bundle hash is a deterministic SHA-256 of
  `(sorted-path · length · bytes) | manifest.json | .mcp.json` — the
  registry uses it to detect real version bumps vs. no-op re-bundles.
  `hashPluginBundle(dir)` re-hashes an on-disk bundle for integrity
  verification.

  `createGoogleAuthProvider(config)` implements the T-223
  `AuthProvider` seam against Google OIDC — PKCE on the
  authorization URL, form-encoded exchange to `oauth2.googleapis.com`,
  and a POST to a configurable StageFlip API mint endpoint that
  returns the final session JWT. CI never calls accounts.google.com;
  all HTTP is mocked via `fetchFn` injection.

  21 unit tests across manifest / bundle / google-auth; all gates green.

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
- Updated dependencies [36d0c5d]
  - @stageflip/mcp-server@0.1.0

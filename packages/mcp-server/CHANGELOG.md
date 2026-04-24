# @stageflip/mcp-server

## 0.1.0

### Minor Changes

- e7b91d0: T-222: `@stageflip/mcp-server` — adapter between the engine's tool
  registry and MCP. Exposes:

  - `createMcpServer({ registry, router, buildContext, allowedBundles? })` —
    transport-agnostic MCP SDK `Server` ready to `.connect(transport)`.
  - `buildMcpToolList` / `dispatchMcpToolCall` — pure adapter functions for
    callers wiring their own Server.
  - `populateCanonicalRegistryForMcp` — happy-path helper that registers
    all 16 canonical bundles onto a fresh registry + router pair.

  Tool-list filtering honours an optional `allowedBundles` scope (per
  invariant I-9 and the MCP-integration skill). Router errors
  (`unknown_tool`, `input_invalid`, `output_invalid`, `handler_error`,
  `aborted`) map to MCP `{ isError: true }` tool-call results with
  human-readable diagnostics. End-to-end coverage via `InMemoryTransport`
  pairing a real SDK `Client` with the factory's `Server`.

- 2e1e7d6: T-223: MCP auth flow — OAuth → JWT → local config.

  New surfaces under `@stageflip/mcp-server`:

  - `issueMcpSessionJwt` / `verifyMcpSessionJwt` — HS256-signed session
    JWTs with `typ: mcp-session`, `iss: stageflip`, standard `sub`/`exp`/
    `iat` plus `org`, `role`, `allowedBundles`.
  - `createFileTokenStore` — persists `~/.config/stageflip/auth.json` at
    mode 0600; `defaultTokenStorePath` honours `XDG_CONFIG_HOME` / `APPDATA` /
    `STAGEFLIP_AUTH_FILE`. Keytar was deliberately rejected — its Linux
    backend (`libsecret`) is LGPL-3.0; OS-keychain integration is a
    Phase-12 follow-up.
  - `generatePkceVerifier` / `derivePkceChallenge` — RFC 7636 helpers
    (43–128 char verifier, base64url S256 challenge).
  - `AuthProvider` interface + `MockAuthProvider` + `runAuthFlow` — drives
    the Authorization-Code + PKCE round-trip through a pluggable IdP.
    Concrete providers land in T-224.
  - `guardMcpSession` + `UnauthorizedError` — verifies the bearer JWT on
    an MCP request and returns `{ principal, allowedBundles }` for the
    adapter's bundle-gate to consume.

  30 unit tests across five modules (jwt, store, pkce, flow, guard). All
  gates green. Real OAuth round-trips never hit in CI — every test uses
  `MockAuthProvider`.

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

- Updated dependencies [fa7bd86]
- Updated dependencies [919af67]
- Updated dependencies [b8808c7]
- Updated dependencies [3457c83]
- Updated dependencies [f8b47f0]
- Updated dependencies [10ae733]
- Updated dependencies [822826e]
- Updated dependencies [e69465d]
- Updated dependencies [db8df77]
- Updated dependencies [8dd5df9]
- Updated dependencies [3140b2d]
- Updated dependencies [724650d]
- Updated dependencies [ceec209]
- Updated dependencies [4aed082]
- Updated dependencies [980b019]
- Updated dependencies [ca340c5]
- Updated dependencies [a7e9fec]
- Updated dependencies [a1cf600]
- Updated dependencies [d0e7076]
- Updated dependencies [1a684b1]
- Updated dependencies [36d0c5d]
  - @stageflip/engine@0.1.0
  - @stageflip/llm-abstraction@0.1.0

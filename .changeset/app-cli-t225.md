---
"@stageflip/cli": minor
---

T-225: `apps/cli` — `stageflip` CLI.

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

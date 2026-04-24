---
"@stageflip/plugin": minor
---

T-224: `@stageflip/plugin` — Claude-plugin bundler.

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

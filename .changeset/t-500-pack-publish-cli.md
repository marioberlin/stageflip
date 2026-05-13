---
'@stageflip/pack-publish-cli': minor
---

T-500 — New `@stageflip/pack-publish-cli` package exposing the
publisher-side `stageflip-pack-publish` binary plus a programmatic
library API. Three subcommands: `validate` (T-499 invariants against
an unsigned pack source directory, with optional warnings for missing
`repository`/`homepage`, short `description`, or empty `keywords`),
`sign` (wraps `@stageflip/pack-signing.signPackDirectory` with a
pre-flight validate gate so invalid packs never get signed), and
`publish` (verifies the signature against a publisher public key,
extracts `<pack-id>@<version>` from the embedded manifest, and POSTs
to `<registry-url>/api/v1/packs` with `Authorization: Bearer
<env-var-value>`; supports a `dry-run://` registry prefix that skips
the HTTP call so the publish pipeline is testable today). All IO is
dependency-injected (`CliPublishDependencies` carries fs + http +
env + logger); the binary entry wires real `node:fs/promises`, the
global `fetch`, and `process.env` while tests pass in-memory shims.
Marketplace registry contract is gated on T-536+; until then this
command operates in dry-run mode for pipeline testing.

---
'@stageflip/pack-signing': minor
---

T-498 — New `@stageflip/pack-signing` package exposing the publisher-side
`stageflip-pack-sign` binary plus a programmatic library API. Three
subcommands: `generate-keys` (Ed25519 keypair → publisher.private.pem +
publisher.public.pem), `sign` (directory + private key → deterministic
in-house archive + `.sig` sidecar, with `manifest.json` patched to
include the computed `integrity.hash`), and `verify` (archive + sig +
public key → Ed25519 verify). The archive format is a placeholder
in-house container (`SFPACK1` magic + path-sorted entries) — no `tar` or
`zstd` dependency; production marketplaces may swap in a richer format
post-T-499 since `integrity.hash` is opaque to the encoding. All IO is
dependency-injected (`CliSignDependencies` carries fs + logger), so the
binary entry wires real `node:fs/promises` while tests pass in-memory
shims.

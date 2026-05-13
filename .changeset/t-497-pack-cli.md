---
'@stageflip/pack-cli': minor
---

T-497 — New `@stageflip/pack-cli` package exposing the tenant-facing
`stageflip-pack` binary with five subcommands: `list`, `info`, `verify`,
`install` (stub — exits 2 with a "not yet implemented" message; tar +
zstd extraction lands in a downstream task), and `remove` (interactive
confirm unless `--yes` / `-y`). The CLI delegates every install-time
gate to `@stageflip/pack-loader`; failures surface as one of the 5 LF-*
loss-flag codes. All IO is dependency-injected (`CliDependencies` carries
logger, prompter, filesystem, loader deps + root path), so the binary
entry wires real `node:fs` and `process.stdout` while tests pass
in-memory shims.

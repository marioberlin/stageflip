---
'@stageflip/parity-cli': minor
---

T-119b: `stageflip-parity prime` subcommand for golden priming.

Ships a pure `primeFixture(input, opts)` orchestrator with a
`PrimeRenderFn` port (unit-tested against a fake render + fake fs),
plus a `stageflip-parity prime --reference-fixtures --out <dir>`
subcommand that wires a Puppeteer-backed primer using
`PuppeteerCdpSession` + `createRuntimeBundleHostHtml` + the 3
hand-coded `REFERENCE_FIXTURES` from `@stageflip/renderer-cdp`.
`--dry-run` reports target paths without launching Chrome.

Public surface additions: `primeFixture`, `PrimeRenderFn`, `PrimeFsOps`,
`runPrime`, `parsePrimeArgs`, `PRIME_HELP_TEXT`, `defaultReferenceFrames`,
`createPuppeteerPrimer`, `createReferenceFixturesResolver`.

Priming the 5 parity fixtures under `packages/testing/fixtures/`
requires a `FixtureManifest → RIRDocument` converter (T-119d,
deferred). Until that lands, `--reference-fixtures` is the only
supported input to the prime subcommand.

New workspace deps on `@stageflip/renderer-cdp`,
`@stageflip/cdp-host-bundle`, and `@stageflip/rir` (all
`workspace:*`; all remain `private: true` at this phase).

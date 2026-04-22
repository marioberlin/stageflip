---
'@stageflip/parity-cli': minor
---

T-119f: `stageflip-parity prime --parity <fixtures-dir>` flag.

Extends the `prime` subcommand to render parity fixtures (JSON
manifests under `packages/testing/fixtures/`) in addition to the
hand-coded REFERENCE_FIXTURES. Each `*.json` is parsed via
`parseFixtureManifest` from `@stageflip/testing`, converted to an
`RIRDocument` via `manifestToDocument` (T-119d), and rendered at
the manifest's declared `referenceFrames` positions. Filename
pattern comes from `manifest.goldens.pattern` when present,
otherwise `DEFAULT_PRIME_PATTERN`.

**Breaking (internal)**: `PrimeInputResolver.resolveReferenceFixtures()`
→ `PrimeInputResolver.resolve(opts: PrimeCliOptions)`. Single method,
options-driven. All consumers are in-workspace.

Exports renamed:
- `createReferenceFixturesResolver` → `createPrimeInputResolver`
  (now handles both `--reference-fixtures` and `--parity`).

Usage additions:
- `--parity <fixtures-dir>` — prime every *.json under the dir
- Mutually exclusive with `--reference-fixtures`
- `--dry-run` works with both modes

Also: the primer now calls `registerAllLiveRuntimes()` on the Node
side before mount. Without this the Node-side
`@stageflip/runtimes-contract` registry was empty and
`dispatchClips(document)` rejected every parity-fixture clip as
"unknown-kind". Re-register is caught-and-ignored (the registry
throws on duplicate id) so repeat primer creations don't crash.

Verified end-to-end locally: `pnpm parity:prime --parity
packages/testing/fixtures --out …` emits 21 PNGs (7 fixtures × 3
frames each) across all 6 runtimes.

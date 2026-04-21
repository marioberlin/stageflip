---
"@stageflip/parity-cli": minor
---

Parity CLI — `pnpm parity [<fixture>]` (T-101).

**End-to-end parity harness usage**: given a T-102 fixture JSON
and rendered candidate PNGs on disk, score PSNR + SSIM and
exit with a meaningful code. The heavy lifting is
`scoreFixture(fixturePath, opts?)`; the CLI is argv parsing +
pretty output + exit-code derivation on top.

**New package `@stageflip/parity-cli`** with bin `stageflip-parity`.

**Usage** (root script `pnpm parity`):

```sh
pnpm parity packages/testing/fixtures/css-solid-background.json
pnpm parity --fixtures-dir packages/testing/fixtures
pnpm parity my-fixture.json --candidates /tmp/rendered-frames
pnpm parity --help
```

**Flow**:

1. Parse fixture via `@stageflip/testing`'s `parseFixtureManifest`.
2. Resolve thresholds by merging manifest overrides over
   `@stageflip/parity`'s `DEFAULT_THRESHOLDS` (T-102's optional
   thresholds are honoured here).
3. Resolve golden + candidate paths per reference frame.
   - Goldens via T-102's `resolveGoldenPath` (`<fixture-dir>/<goldens.dir>/...`).
   - Candidates default to `<fixture-dir>/candidates/<fixture-name>/`;
     `--candidates <dir>` overrides.
   - Same filename pattern as goldens (T-102's `goldens.pattern` or
     `DEFAULT_GOLDEN_PATTERN`).
4. If either side is missing per-frame, classify:
   - `no-goldens` — manifest has no `goldens` block.
   - `no-candidates` — candidates dir entirely missing.
   - `missing-frames` — some (but not all) frames missing.
5. Otherwise `loadPng` both sides + call `scoreFrames` and
   classify `scored`.

**Exit codes**:

- `0` — every scored fixture passed. Skipped fixtures do NOT
  fail the run, so CI greens through until goldens are primed.
- `1` — at least one fixture was scored and FAILED its
  thresholds.
- `2` — usage / argument error (no fixtures, bad flag).

**Public surface**:

- `scoreFixture(fixturePath, { candidatesDir?, candidatesPattern? })` →
  `FixtureScoreOutcome` — fixtureDir / manifest / thresholds /
  report / status / missingFrames / summary.
- `FixtureScoreOutcome`, `MissingFrame`, `ScoreFixtureOptions` types.
- `outcomeIsFailure(outcome)` predicate.
- `runCli(argv, io?)` → `Promise<number>` — never calls
  `process.exit`, tests drive it directly.
- `parseArgs(argv)` pure argv parse.
- `formatOutcome`, `formatSummary` pretty-printers.
- `CliIo` interface for injectable stdout/stderr.

**Build**: `tsup` with `noExternal: ['@stageflip/testing']` — the
testing package exports raw `.ts` (no build step of its own),
so it must inline into parity-cli's compiled dist. All other
workspace deps stay external.

**Tests**: 26 new cases across `score-fixture.test.ts` (8 — all
four status branches + threshold merging + custom candidates dir
+ invalid JSON) and `cli.test.ts` (18 — argv parsing, runCli
exit codes for pass / fail / skipped / help / bad flag / both
fixtures+dir / --fixtures-dir discovery / missing dir, formatter
helpers). Uses `pngjs` directly (devDep) to synthesise goldens +
candidates — no real rendering, no Chrome, no FFmpeg.

**Smoke-test against the 7 shipped fixtures**: `pnpm parity
--fixtures-dir packages/testing/fixtures` reports 5 skipped
(no-candidates — goldens are committed per T-102 but candidates
need rendering) + 2 skipped (no-goldens — `shader-swirl-vortex`
and `shader-glitch` remain input-only until their goldens are
primed). Exit 0. Confirms the skip-isn't-failure posture.

**Root script**: `pnpm parity` builds `@stageflip/parity-cli` first
via turbo, then invokes the bin.

**Skill**: `skills/stageflip/workflows/parity-testing/SKILL.md`
gains a full CLI section with usage examples + exit-code table +
skip-reason legend. Module-surface table extended with the T-101
exports. The "What comes later" row for T-101 is removed (it's
here now).

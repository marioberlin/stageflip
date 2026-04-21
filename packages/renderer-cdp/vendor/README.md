# `packages/renderer-cdp/vendor/`

Third-party code vendored directly into the StageFlip source tree
under the terms of each upstream's license. This directory is the
only place in the monorepo where external code lives that was not
installed via `pnpm` — every file here is checked in verbatim (or
with a documented StageFlip modification).

See also — canonical provenance files:

- [`NOTICE`](./NOTICE) — Apache-2.0 §4(d) attribution for every
  payload below.
- [`engine/LICENSE`](./engine/LICENSE) — upstream Apache-2.0 text.
- [`engine/PIN.json`](./engine/PIN.json) — machine-readable pin:
  upstream URL, package, commit, vendor date, license.
- [`../../../THIRD_PARTY.md`](../../../THIRD_PARTY.md) §2 —
  obligations, trademark posture, provenance discipline.
- [`../../../docs/dependencies.md`](../../../docs/dependencies.md)
  §5 — pinned-commit audit table.

## Contents

| Payload | Upstream | Commit | License | Vendored |
|---|---|---|---|---|
| `engine/` (`@hyperframes/engine`) | https://github.com/heygen-com/hyperframes | `d1f992570a2a2d7cb4fa0b4a7e31687a0791803d` | Apache-2.0 | 2026-04-21 (T-080) |

## Why vendor, and not reimplement

Short answer: ~2–3 months of work we don't need to do twice.

`@hyperframes/engine` is the CDP/BeginFrame frame-capture engine,
FFmpeg orchestration, video frame extraction, and audio mixer. It is
infrastructure, not product-differentiating surface. Apache-2.0
permits verbatim vendoring with attribution. Reimplementing the CDP
timing dance, the FFmpeg pipelines, and the audio mux layer
produces no StageFlip-specific value — our creative surface sits
above this boundary, in the ClipRuntime contract and above.

## Scope boundary

- **Vendored here**: the CDP engine layer — everything under
  `engine/src/**` and `engine/scripts/**`, plus upstream
  `package.json`, `tsconfig.json`, `vitest.config.ts`, and
  `README.md` as documentary evidence of what was current at the
  pinned commit.
- **Not vendored**: `@hyperframes/core` (two helpers needed by
  engine — `MEDIA_VISUAL_STYLE_PROPERTIES` and
  `quantizeTimeToFrame`), `@hyperframes/studio`,
  `@hyperframes/player`, `@hyperframes/producer`. T-083 will decide
  whether the two core helpers get re-implemented in
  `renderer-cdp/src/` or vendored in a second payload.

  Note for T-083: the engine's entrypoint
  [`engine/src/index.ts`](./engine/src/index.ts) re-exports both
  symbols to its own consumers
  (`export { quantizeTimeToFrame, MEDIA_VISUAL_STYLE_PROPERTIES } from "@hyperframes/core"`).
  Any StageFlip code that imports from the vendored engine therefore
  carries a transitive dependency on `@hyperframes/core` — that
  dependency needs to resolve (re-impl, second vendor payload, or
  patched re-export) before the engine can be linked in.
- **Studied, not vendored**: the rest of the Hyperframes monorepo
  at `reference/hyperframes/` (gitignored, local-only). See
  [`THIRD_PARTY.md`](../../../THIRD_PARTY.md) §3.

## How vendored code is excluded from the package

- `tsconfig.json` — `include: ["src/**/*"]`, so `vendor/` is not in
  scope of our `typecheck` gate.
- `vitest.config.ts` — `include: ['src/**/*.test.ts', 'src/**/*.test.tsx']`
  so the upstream engine's own `*.test.ts` files are not executed
  by our `test` gate.
- Biome `lint` script is `biome check src` in every package.
- `pnpm-workspace.yaml` globs are non-recursive under
  `packages/*` — `vendor/engine/package.json` is NOT a pnpm
  workspace package and its own `dependencies` block does not
  pull anything into our lockfile.
- Global scanners (`check-remotion-imports`, `check-licenses`,
  `check-determinism`) each make their own scope decision. The
  remotion-imports scanner DOES walk `vendor/` — provenance check
  that vendored code doesn't smuggle in forbidden imports — and
  the vendor drop passes it. The determinism scanner is scoped to
  frame-runtime / runtimes / renderer-core clip paths and does not
  look here.

## Modifications

No StageFlip-side modifications recorded yet. Per
[`THIRD_PARTY.md`](../../../THIRD_PARTY.md) §2, any future change to
a vendored file must:

1. Begin the file with a comment of the form
   `// Modified by StageFlip, YYYY-MM-DD — <reason>`.
2. Be appended to the "Modifications by StageFlip" section of
   [`NOTICE`](./NOTICE).
3. Be summarized in the PR description with a pointer to the
   upstream line range that was changed.

A running modification log belongs next to this heading as entries
land.

## Upgrading vendored code

Re-pinning to a new upstream commit is an ADR-gated change. The
protocol, per [`docs/dependencies.md`](../../../docs/dependencies.md)
§5:

1. Open an ADR describing why the re-pin is needed and what
   upstream changes it brings in.
2. Replace `engine/src/**` and `engine/scripts/**` from the new
   upstream commit.
3. Update the commit hash + date in:
   - [`engine/PIN.json`](./engine/PIN.json)
   - [`NOTICE`](./NOTICE) (both `Commit:` and `Vendored:` lines)
   - [`docs/dependencies.md`](../../../docs/dependencies.md) §5
     table row
   - The constant `EXPECTED_COMMIT` in
     [`../src/vendor-integrity.test.ts`](../src/vendor-integrity.test.ts)
4. Re-run the 9 CI gates. The vendor-integrity test is the fail-loud
   signal that all four locations are in sync.
5. If any StageFlip-side modifications had been stacked on top of
   the prior pin, re-apply them against the new upstream, updating
   the `// Modified by StageFlip, YYYY-MM-DD` header lines in each
   touched file.

Until the first re-pin happens, the ADR column in
`docs/dependencies.md` §5 reads "ADR-TBD". The first re-pin creates
the ADR; subsequent re-pins reference and append to it.

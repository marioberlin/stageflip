# `parity-fixtures/` — preset golden frames

Per **ADR-004 §D5** and **T-313**, every premium clip preset (cluster A–H) gets a
parity-fixture artifact bundle here. The directory layout is:

```
parity-fixtures/<cluster>/<preset-id>/
  manifest.json         # FixtureManifest (composition + clip props + reference frames)
  golden-frame-<n>.png  # Rendered reference frame at the canonical mid-hold frame
  thresholds.json       # PSNR + SSIM thresholds (defaults from @stageflip/parity)
```

## How to (re)generate a fixture

```
$ pnpm generate-parity-fixture --preset=<id> [--frame=<n>] [--mark-signed] [--force]
```

For presets with multiple visual states, pass `--variant=<name>` one or more
times (or `--variant=a,b,c`) per **T-359a**:

```
$ pnpm tsx scripts/generate-preset-parity-fixture.ts \
    --preset=f1-sector-purple-green \
    --variant=sessionBest --variant=personalBest --variant=neutral \
    --frame=60 --mark-signed
```

The on-disk shape becomes `golden-frame-<n>-<variant>.png` (one per declared
variant) plus a `manifest.json` carrying an object-keyed `variants` field.
Single-variant invocations still produce the byte-identical T-313 shape (no
`variants` key, single `golden-frame-<n>.png`).

See `docs/ops/parity-fixture-signoff.md` for the four-step sign-off workflow
(generate → inspect → sign → cluster merge) and the multi-variant section.

## Existing parity infrastructure

The directories at `packages/testing/fixtures/` (T-067) and the `@stageflip/parity`
CLI (T-101) are **separate** from this top-level directory:

- `packages/testing/fixtures/<runtime>-<kind>.json` — clip-runtime-level fixtures.
- `parity-fixtures/<cluster>/<preset>/` — preset-level fixtures (T-313).

Both consume the same `FixtureManifest` schema (`@stageflip/testing`).

## Why is this directory committed?

The goldens are part of the parity contract. CI (`pnpm parity`) reads them at
score time. `.gitignore` does not exclude this tree.

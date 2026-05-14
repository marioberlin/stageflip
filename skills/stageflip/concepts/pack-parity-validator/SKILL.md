---
title: Pack Parity Validator
id: skills/stageflip/concepts/pack-parity-validator
tier: concept
status: substantive
last_updated: 2026-05-14
owner_task: T-549
related:
  - skills/stageflip/concepts/bundles/SKILL.md
  - skills/stageflip/concepts/pack-telemetry/SKILL.md
  - skills/stageflip/concepts/marketplace-registry/SKILL.md
---

# Pack Parity Validator

`@stageflip/pack-parity-validator` is the host-side gate that scores
every parity fixture a pack ships against the cluster's PSNR + SSIM
thresholds. It runs in two places:

1. **Marketplace publish-time** (T-536, future T-550 wiring) — the
   publish handler refuses to register a pack whose own fixtures fail
   the gate, on the assumption that publishers must demonstrate their
   pack renders cleanly before they distribute it.
2. **Pack install-time** (T-495 loader gate) — the loader scores the
   pack's shipped fixtures against the same thresholds before
   activating any clip, catching tampering / corruption that signature
   verification alone (Ed25519 over the archive bytes) cannot
   distinguish from "the publisher signed broken pixels".

The package is **leaf** — depends only on `pngjs`. It contributes no
schema, no runtime, no engine surface.

## Why per-cluster thresholds

A typography-heavy preset (cluster-d) is far less tolerant of
sub-pixel drift than a motion-heavy one (cluster-c, cluster-i). The
workspace `parity-cli` already encodes this via per-fixture overrides
of `DEFAULT_THRESHOLDS`. This package mirrors those numbers as a
per-cluster registry so packs only need to declare which cluster a
fixture belongs to:

| Cluster | Min PSNR (dB) | Min SSIM | Notes |
|---|---|---|---|
| cluster-a | 35 | 0.95 | Standard. |
| cluster-b | 35 | 0.95 | Standard. |
| cluster-c | 32 | 0.92 | Motion-heavy — looser. |
| cluster-d | 36 | 0.96 | Typography-heavy — tighter. |
| cluster-e | 35 | 0.95 | Standard. |
| cluster-f | 35 | 0.95 | Standard. |
| cluster-g | 35 | 0.95 | Standard. |
| cluster-h | 33 | 0.93 | Compose-heavy — looser. |
| cluster-i | 32 | 0.92 | Live-audience overlay; motion + AI — looser. |
| `default` | 35 | 0.95 | Fallback for unknown cluster ids. |

Launch packs that ship a custom cluster id (e.g. `cluster-finance`,
`cluster-wedding-events`) score against the `default` row but the
result carries `reason: 'unknown-cluster'`, surfacing the gap to the
publisher. The pack-loader policy (T-495) decides whether to fail-build
on that signal or warn-only.

## Public surface

```ts
import {
  DEFAULT_CLUSTER_THRESHOLDS,
  formatPackParityReport,
  getClusterThreshold,
  validateFixture,
  validatePackFixtures,
} from '@stageflip/pack-parity-validator';

// Single fixture
const result = validateFixture({
  clusterId: 'cluster-a',
  actualPngBytes,    // Uint8Array — pack-shipped candidate
  referencePngBytes, // Uint8Array — workspace-blessed reference
});
// → { ok: boolean; psnr: number; ssim: number; threshold; reason? }

// Whole pack
const report = validatePackFixtures({
  fixtures: [
    { path: 'pack/fixtures/cluster-a/a.png', clusterId: 'cluster-a', actualPngBytes, referencePngBytes },
    // …
  ],
});
console.log(formatPackParityReport(report));
```

## Failure reasons

Every failing result carries one of:

- **`psnr-below-threshold`** — gross drift. Most common. Rendered
  output diverges from the reference by more than the cluster allows.
- **`ssim-below-threshold`** — structural drift. Rare in practice
  because PSNR usually trips first; useful for catching texture
  re-tiling that preserves average luminance.
- **`unknown-cluster`** — pack used a cluster id not in the workspace
  registry. Scored against the `default` row anyway so the report has
  metrics, but flagged distinctly.
- **`malformed-png`** — PNG decode failed. Either the candidate or the
  reference has corrupted bytes.
- **`dimension-mismatch`** — candidate and reference have different
  width / height. Always a pack authoring bug.

## SSIM trade-off

The package ships a **simplified SSIM** (uniform 8×8 blocks, no
Gaussian window) rather than re-using `ssim.js`. Reasons:

- The pack-parity gate catches **gross drift** (rendered-blank, ~30 dB
  PSNR drops, dimension mismatches) — not pixel-perfect parity. The
  workspace `@stageflip/parity` package remains the reference scorer
  for in-tree fixtures.
- Avoiding `ssim.js` keeps the marketplace publish handler's bundle
  small (the handler runs server-side under an environment we want to
  keep free of large NPM trees).
- The simplified score returns exactly 1.0 on identical inputs, which
  is the only case the install-time gate strictly needs to detect (a
  pack that signs broken pixels). Drift is bounded by the per-cluster
  PSNR threshold, which is the dominant signal.

If a future failure mode demands the full Wang-2004 SSIM (e.g. a pack
that perturbs structure but preserves luminance), swap the
`computeSimplifiedSsim` implementation; the public surface is
unchanged.

## Determinism perimeter

`@stageflip/pack-parity-validator` lives **OUTSIDE** the determinism
perimeter (CLAUDE.md §3 — perimeter is `packages/runtimes/**`,
`packages/frame-runtime/**`, `packages/renderer-core/src/clips/**`).
The validator is host-side gating. No `Date.now()` or `Math.random()`
appears in the implementation regardless — pure arithmetic over
decoded pixel buffers.

## IO contract

The validator is **pure**: callers pre-load both PNG byte buffers
before calling. `validateFixture` and `validatePackFixtures` never
touch the filesystem, the network, or the clock. This pushes IO to
the call site for two reasons:

1. The marketplace publish handler reads from a `tar.zst` stream and
   cannot rely on `fs/promises`.
2. The pack-loader install gate already opens the pack directory; a
   second walk would double the IO cost.

## Cross-references

- **`@stageflip/parity`** — workspace reference scorer. Same PSNR
  formula; different SSIM (full `ssim.js`).
- **`@stageflip/parity-cli`** — sibling CLI that runs in-tree. The
  per-cluster thresholds in this package mirror the CLI's defaults.
- **`@stageflip/pack-loader`** (T-495) — install-time consumer.
- **`@stageflip/marketplace-registry`** (T-550, future) — publish-time
  consumer.
- **CLAUDE.md §13** — structural-extension verification rules. This
  package is the host-side enforcement that PRESET first-render
  evidence (per §13) is preserved across the publish → install
  boundary.

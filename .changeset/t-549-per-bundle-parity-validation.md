---
'@stageflip/pack-parity-validator': minor
---

T-549 — New `@stageflip/pack-parity-validator` leaf package providing
the per-bundle parity validator used at marketplace publish-time
(T-536, future T-550 wiring) and pack install-time (T-495 loader gate)
to score every pack-shipped parity fixture against the cluster's PSNR
+ SSIM thresholds. Public surface: `validateFixture` (single-fixture
pure scorer), `validatePackFixtures` (multi-fixture aggregator
returning a `PackParityReport`), `formatPackParityReport`
(human-readable formatter), and `DEFAULT_CLUSTER_THRESHOLDS` mirroring
the workspace `parity-cli` defaults for clusters A–I plus a `default`
fallback row used for unknown cluster ids contributed by launch packs
(`cluster-finance`, `cluster-wedding-events`). PSNR matches the
canonical 10·log10(255²/MSE) formula for parity with
`@stageflip/parity`; SSIM ships as a simplified uniform-window 8×8
luminance variant (returns 1.0 on bit-identical inputs) — trade-off
documented in `validate-fixture.ts` and the SKILL.md. Five
failure-reason categories (`psnr-below-threshold`,
`ssim-below-threshold`, `unknown-cluster`, `malformed-png`,
`dimension-mismatch`) feed both per-fixture results and the aggregate
`summary.byReason` histogram. Pure: validators take pre-decoded
`Uint8Array` PNG buffers — no `fs`, no clock, no network. Single
runtime dependency (`pngjs` 7.0.0, MIT). 33 tests across 4 files.

---
'@stageflip/parity-cli': patch
---

T-328 — `msnbc-big-board` preset substantive (Cluster A eighth + closer;
second `fullScreen` clipKind consumer via `PRESET_ID_BINDINGS` override
— Pattern C; second production consumer of T-355a's `magic-wall-panel`
primitive after T-355).

Adds `msnbcBigBoardBinding` as a new entry in `PRESET_ID_BINDINGS` keyed
by `'msnbc-big-board'` (Pattern C — second-preset-for-clipKind via the
override path, NOT clipKind-default). The `'fullScreen'` arm in
`DEFAULT_CLIP_KIND_RESOLVER` stays UNCHANGED at `fullScreenBinding`
(T-355's CNN-default magic-wall-drilldown binding). Exports two new
constants: `MSNBC_BIG_BOARD_REGIONS` (eight US-state region tiles —
CA / TX / FL / NY / PA / OH / GA / AZ; mirrors T-355's canonical region
shape verbatim per D-T328-4) and `MSNBC_BIG_BOARD_PARTY_COLORS` (NBC
peacock-derived partisan-neutral palette: peacock blue `#0084CB` /
peacock red `#CC2229` / peacock purple `#9B26B6` / peacock gold
`#FCB712` — distinct from `MAGIC_WALL_PARTY_COLORS` per stub line 41
mandate). Title `'2024 ELECTION NIGHT'` + subtitle `'County-level — 92%
Reporting'` diverge intentionally from T-355's `'Election Results'` /
`'State-by-state breakdown'` to make the tenant divergence eyeball-
obvious. Reference frame 60 (steady-state county-level mid-hold) signed
at PSNR ≥ 42 dB / SSIM ≥ 0.98 via F-4 generator flags `--psnr=42
--ssim=0.98` (no manual hand-pin).

T-328 closes Cluster A to **8/8 substantive + signed** — third batch-
eligible cluster after E (closed by T-355) and F (closed by T-367) —
and unlocks T-382 (or sister) cluster-batch type-design review for all
eight Cluster A presets. The existing ten `PRESET_ID_BINDINGS` overrides
and every clipKind-default arm remain unchanged.

3D virtual backdrop (`ThreeSceneClip` external composition), operator
cursor / Kornacki touch overlay (`T-328a` carve-out IF demanded), real-
time vote count-ups (compose `animated-value` clip externally — T-360
register), zoom transitions between hierarchy levels (`T-328b` carve-
out IF demanded), and ticker strip beneath the panel are all deferred.
v1 ships the steady-state county-level overlay panel layer only.

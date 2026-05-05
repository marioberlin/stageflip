---
'@stageflip/parity-cli': patch
---

T-357 — wire `standings → standings-table` in the v1 clipKind resolver
+ export `OLYMPIC_CANONICAL_STANDINGS` (five-row top-5 leaderboard:
USA / CHN / JPN / AUS / GBR with mixed up / down / flat deltas
exercising all three rank-arrow color paths). Powers the
`olympic-medal-tracker` (Cluster E) parity-golden render via the
`standings-table` primitive shipped by T-357a; the `LiveDataClip`
wrapper is bypassed (D-T357-12; same posture as T-356 D-T356-11) and
the renderer mounts `standings-table` directly with the cached
snapshot inlined as props.

The `standings` clipKind-default entry is generic enough to be reused
by future Cluster A/B/E ranked-list presets (F1 / NBA / NCAA / golf
leaderboards, election results, crypto top-N market-cap dashboards);
per-preset overrides via `PRESET_ID_BINDINGS` remain available for
tenant-specific colorways.

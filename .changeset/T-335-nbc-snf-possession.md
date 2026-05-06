---
'@stageflip/parity-cli': patch
---

T-335 — `nbc-snf-possession-illuminated` preset substantive (Cluster B
third; fourth `scoreBug` clipKind consumer via `PRESET_ID_BINDINGS`
override — Pattern C; third production consumer of T-332a's
`'football'` style branch; first production consumer of T-332a's
`centerCircle`, `direction`, and `networkLogo` optional props; second
production consumer of `down` + `possession`).

Adds `nbcSnfBinding` as a new entry in `PRESET_ID_BINDINGS` keyed by
`'nbc-snf-possession-illuminated'` (Pattern C — fourth-preset-for-clipKind
via the override path, NOT clipKind-default). The `'scoreBug'` arm in
`DEFAULT_CLIP_KIND_RESOLVER` stays UNCHANGED at `scoreBugDotsBinding`
(T-358's cricket-ball-by-ball-dots binding via the `outcome-row`
primitive — a different primitive entirely); T-333's
`premierLeagueFopBinding` + T-334's `foxNflNoChromeBinding` and their
respective entries stay UNCHANGED. Exports one new constant:
`NBC_SNF_PROPS` (the canonical Sunday Night Football AFC matchup
snapshot — deep-near-black `#0A0A0A` base + KC red `#E31837` home box
+ BUF navy `#00338D` away box + 2/3-letter team codes `'KC'` /
`'BUF'` + `'21'` / `'14'` scores + `'08:14'` Q2 mid-quarter clock +
`'Q2'` period token + `'<< 1st & 10'` down-and-distance with chevrons
baked-in + `direction: 'left-to-right'` + `possession: 'home'`
brightness boost + `centerCircle: true` + `networkLogo: 'NBC'` +
Public Sans 600 OFL fallback for proprietary Sweet Sans Pro + NBC
Tinker pairing). Reference frame 60 (steady-state mid-hold) signed at
PSNR ≥ 42 dB / SSIM ≥ 0.98 via F-4 generator flags `--psnr=42
--ssim=0.98` (no manual hand-pin).

T-335 brings Cluster B to **3/9 substantive + signed** (NOT YET
ELIGIBLE for batch merge). The remaining 6 Cluster B presets land in
their own preset PRs over the rest of Phase 13. The existing 13
`PRESET_ID_BINDINGS` overrides and every clipKind-default arm remain
unchanged.

500 ms ease-out entrance slide-in from bottom (stub line 37 —
primitive-level entrance enum; candidate `T-332b`-family), 400 ms
possession-change animation (stub line 38 — primitive-level
frame-driven brightness transition + chevron position shift; candidate
`T-332b`-family), 300 ms penalty-flag slide-in (stub line 39 —
primitive-level new `penaltyFlag: boolean` slot + asset + frame-driven
choreography; candidate `T-335a`), 200 ms score-change quick flash
(stub line 40 — primitive-level addition; candidate `T-332b`-family),
direction-driven automatic chevron rendering (stub line 34 —
primitive-level `renderFootball` extension to consume `direction`;
candidate `T-332b`-family), background-opacity ≈75% semi-transparent
register (stub line 26 — primitive-level new `opacity` axis on the
football branch; candidate `T-332b`-family), score numerics rendered
at primitive default 28 px vs stub's "Bold, 26–32 pt" register
(primitive-level `scoreFontSize` axis; candidate `T-332b`-family),
4 px outer-edge kit-color stripes (vs the primitive's full-tile fill —
inherited from T-333 D-T333-11-a / T-334 D-T334-12; `T-332b`-family
carve-out), and Sweet Sans Pro + NBC Tinker bespoke letter shapes
(D-T335-11-d — preserved only in commercial-byo + proprietary-byo;
cannot render in OFL fallback) are all deferred. v1 ships the
steady-state mid-hold horizontal-bar scoreclock layer only.

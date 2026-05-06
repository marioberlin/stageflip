---
'@stageflip/parity-cli': patch
---

T-334 — `fox-nfl-no-chrome` preset substantive (Cluster B second; third
`scoreBug` clipKind consumer via `PRESET_ID_BINDINGS` override — Pattern
C; second production consumer of T-332a's `'football'` style branch;
first production consumer of T-332a's `backdropGradient`, `down`, and
`possession` optional props).

Adds `foxNflNoChromeBinding` as a new entry in `PRESET_ID_BINDINGS`
keyed by `'fox-nfl-no-chrome'` (Pattern C — third-preset-for-clipKind
via the override path, NOT clipKind-default). The `'scoreBug'` arm in
`DEFAULT_CLIP_KIND_RESOLVER` stays UNCHANGED at `scoreBugDotsBinding`
(T-358's cricket-ball-by-ball-dots binding via the `outcome-row`
primitive — a different primitive entirely); T-333's
`premierLeagueFopBinding` + `'premier-league-field-of-play'` entry stay
UNCHANGED. Exports one new constant: `FOX_NFL_NO_CHROME_PROPS` (the
canonical Fox NFL 2025 Super Bowl LIX rematch snapshot — chromeless
`#000000` base + radial gradient backdrop `{ centerOpacity: 0.4,
edgeOpacity: 0 }` + KC red `#E31837` home box + PHI green `#004C54`
away box + 2/3-letter team codes `'KC'` / `'PHI'` + `'24'` / `'17'`
scores + `'04:32'` Q3 mid-quarter clock + `'Q3'` period token + `'3rd
& 7'` down-and-distance + `possession: 'home'` brightness boost +
Inter Display 900 OFL fallback for proprietary Fox Sports custom).
Reference frame 60 (steady-state mid-hold) signed at PSNR ≥ 42 dB /
SSIM ≥ 0.98 via F-4 generator flags `--psnr=42 --ssim=0.98` (no manual
hand-pin).

T-334 brings Cluster B to **2/9 substantive + signed** (NOT YET
ELIGIBLE for batch merge). The remaining 7 Cluster B presets land in
their own preset PRs over the rest of Phase 13. The existing 12
`PRESET_ID_BINDINGS` overrides and every clipKind-default arm remain
unchanged.

Touchdown comic-book celebration (stub line 37 — primitive-level new
`celebration: 'touchdown' | null` enum + asset bundle; candidate
`T-334a`), down-and-distance possession-slide animation (stub lines
32, 36 — primitive-level frame-trigger keyed to `possession` change;
candidate `T-332b`-family), 800 ms ease-out zoom-in entrance from
"FOX SPORTS" branded black field (stub line 35 — primitive-level
entrance enum; candidate `T-332b`-family), 120 ms score-change quick
flash (stub line 38 — primitive-level addition; candidate
`T-332b`-family), score numerics rendered at 40–48 pt "massive scale"
vs primitive default 28 px (D-T334-11-d — primitive-level
`scoreFontSize` axis; candidate `T-332b`-family), 6 px outer-edge
kit-color stripes (vs the primitive's full-tile fill — inherited from
T-333 D-T333-11-a; `T-332b`-family carve-out), and FOX-DNA
letter-C-resembles-FOX-O numeral curiosity (D-T334-11-c — preserved
only in proprietary-byo Fox Sports custom; cannot render in OFL
fallback) are all deferred. v1 ships the steady-state mid-hold
chromeless scoreclock layer only.

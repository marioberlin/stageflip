---
id: cricket-ball-by-ball-dots
cluster: data
clipKind: scoreBug
source: docs/compass_artifact.md#cricket-scorebug
status: substantive
preferredFont:
  family: Custom Star Sports / ICC
  license: proprietary-byo
fallbackFont:
  family: IBM Plex Sans
  weight: 600
  license: ofl
permissions: []
signOff:
  parityFixture: 'signed:2026-05-05'
  typeDesign: na
---

# Cricket Ball-by-Ball Dots — over visualization

The universal cricket broadcast convention for a per-over progression visualization: a horizontal row of six chips representing the six legal deliveries of the current over, color-coded by outcome (dot / 1 / 2 / 3 / 4 / 6 / wicket). Standalone callout (not the full broadcast scoreBug header — that is `cricket-scorebug` in cluster B). The data path is hard-coded in v1: the preset takes an `overOutcomes` prop (a tuple of six outcome glyphs). Live binding to a `LiveDataClip` source is deferred to T-355–T-357.

This preset is the **scoreBug annex** of the data cluster: it consumes the `scoreBug` `clipKind` (per `VALID_CLIP_KINDS` in `scripts/check-preset-integrity.ts`) but for over-progression visualization, NOT a full broadcast scoreBug. Sister cluster-E preset is `f1-sector-purple-green` (same workflow, `bigNumber` clipKind, single central number).

## Visual tokens

The outcome palette is universal cricket canon. Every cricket viewer parses it without legend; do not re-theme it for any tenant.

- **Dot (`0` / `.`) → neutral gray `#666666`.** No run scored. Default state of an unplayed slot.
- **Single (`1`) → white `#FFFFFF`.** One run. Highest-frequency non-dot outcome.
- **Two / three (`2`, `3`) → cyan `#00B4D8`.** Multi-run non-boundary. Same color because `3` is rare and broadcast graphics group them.
- **Four (`4`) → green `#00B54A`.** Boundary along the ground.
- **Six (`6`) → gold `#FFCD00`.** Boundary cleared the rope.
- **Wicket (`W`) → red `#CC0000`.** Strongest outcome state; the chip carries the same red whether the dismissal is bowled, caught, lbw, run-out, or stumped (per-mode glyphs are a Cluster B `cricket-scorebug` concern).

Layout (16:9 default; 9:16 vertical inverts left/right but keeps top/bottom):

- **Six chips** centered horizontally. Chip diameter 144 px (`outcome-row` `chipSize: large`) renders at 1080p; the runtime scales to the host composition. Equal gaps between chip centers — 40% of chip diameter (the `outcome-row` default).
- **Optional chip label** carries the outcome glyph (`1`, `.`, `4`, `6`, `W`, `2`). The runtime renders the label as the chip's `<title>`, so the glyph is accessible (screen reader / `aria-label`) but does NOT paint over the chip fill at v1. Painted-on glyphs are a future composition-layer concern.
- **Background** is `#0E0E12` (near-black; matches the broadcast graphics base used by `f1-sector-purple-green`). Standalone goldens snapshot against this; embedded compositions can override at the host level.
- **Outline** is `#0E0E12` (1 px equivalent at the SVG layer) so the white `1`-chip remains visible against the dark background. The chip fills carry the message; the outline is contrast safety.

The chip color IS the message — applied uniformly to the chip fill. Do NOT keep chips white and color a glyph only.

## Typography

- **`preferredFont: Custom Star Sports / ICC`**, weight `600`. The proprietary cricket broadcast face used by Star Sports / ICC graphics packages (BYO at the tenant level per the font-license registry; see ADR-004 §D3). Cricket broadcasts vary by network — Sky Sports India, Star Sports, ICC, BBC Test Match — so the BYO posture lets a tenant slot in their face without forking the preset.
- **`fallbackFont: IBM Plex Sans`**, weight `600`, OFL. Substituted automatically by the FontManager (T-072) on every rendering medium where the BYO face is not cleared. IBM Plex Sans's geometry reads cleanly at small sizes (12–16 pt) and is already license-cleared in `THIRD_PARTY.md`. The v1 parity fixture uses this fallback (the `outcome-row` primitive does not paint per-chip glyphs at v1 — typography is a future surface).
- **Tabular numerals are mandatory** when chip labels become painted glyphs in a future composition layer (`font-variant-numeric: tabular-nums`). Cluster-E convention; documented in `skills/stageflip/presets/data/SKILL.md`.
- **No italic, no underline, no strikethrough.** Cricket broadcast graphics never use them.

## Animation

- **Per-chip stagger fade-in** by the bound `outcome-row` primitive: chip `i` fades in over frames `[i*4, i*4 + 12]` (linear opacity `0 → 1`). A six-chip over settles by frame 32; mid-hold steady-state at frame 60 is past the settling window for parity snapshots (per ADR-004 §D5).
- **Per-ball reveal animation** (boundary green flash, six gold flash, wicket red bounce, between-overs right-to-left wipe) is documented as the preset's prose contract but is NOT in v1 — the `outcome-row` primitive carries staggered fade only. State-transition animation (chip palette change mid-composition) belongs to T-355 (LiveData binding) where the data source actually streams ball-by-ball.
- **Mid-hold steady-state at frame 60** (per ADR-004 §D5). Parity fixtures snapshot at this frame. Single canonical mid-hold variant per T-358 D-T358-3 — the preset's semantic point is the over as a sequence, not a per-ball palette swap.

## Rules

- **Bound primitive**: `outcome-row` from `@stageflip/runtimes-frame-runtime-bridge` (`packages/runtimes/frame-runtime-bridge/src/clips/outcome-row.tsx`, exported as `OutcomeRow` + `outcomeRowClip`). The `scoreBug` `clipKind` is an integrity-gate sentinel today (in `VALID_CLIP_KINDS` in `scripts/check-preset-integrity.ts`); the v1 resolver in `packages/parity-cli/src/generate-fixture.ts` maps `scoreBug → outcome-row` (T-358 D-T358-4). The formal `clipKind: scoreBug` → runtime-clip dispatcher is a Phase-13/14 follow-up. This prose binding IS the contract until the dispatcher lands. The `outcome-row` primitive was shipped by T-358a as a generic 1..12-chip row reused by Cluster B/E scorebug-family presets (cricket dots, tennis tiebreak points, F1 sector history, soccer last-N-shots).
- **Outcome → color** is universal cricket canon and does NOT take a tenant theme override:
  - `0` / `.` → `#666666` (dot)
  - `1` → `#FFFFFF` (single)
  - `2` / `3` → `#00B4D8` (multi-run non-boundary)
  - `4` → `#00B54A` (boundary along ground)
  - `6` → `#FFCD00` (boundary over rope)
  - `W` → `#CC0000` (wicket)
  Any tenant request to re-color is an escalation per CLAUDE.md §6.
- **Always render exactly six chip positions.** Incomplete overs render with placeholder dot-color chips for the unplayed slots; this preserves the viewer's spatial parsing of "ball 4 of 6". Never render fewer than six chips, even mid-over.
- **Pair with `cricket-scorebug` (cluster B) when used in a full-broadcast context.** This preset can stand alone for highlight reels and social cuts, but the formal scoreBug header (team names, scores, run-rate) is a separate preset owned by T-332+.
- **Milestone overlays (50, 100, 150) are NOT a concern of this preset.** When a milestone hits during the over, the dot triggering it gets the boundary/six base color from this preset; the milestone callout itself is composed by Cluster B `cricket-scorebug`.
- **No live data in v1.** The `permissions` array is empty; no network call, no telemetry source. The future T-355 LiveData wrap declares `network`; this preset does not.
- **Reference frame for parity is mid-hold (frame 60)** per ADR-004 §D5. The PSNR / SSIM thresholds are stricter than the script default (`35 / 0.95`) because flat-color geometric content tolerates tighter thresholds — see Acceptance below.

## Acceptance (parity)

One reference-frame fixture at `frame: 60` (mid-hold steady-state per ADR-004 §D5):

- `golden-frame-60.png` — the canonical six-ball over `[1, '.', 4, 6, W, 2]`. All six outcome palette colors (white, gray, green, gold, red, cyan — single, dot, four, six, wicket, two) appear in this single frame.

Thresholds: **PSNR ≥ 42 dB**, **SSIM ≥ 0.98** (stricter than the generator default `35 / 0.95`; mirrors `f1-sector-purple-green` in cluster E).

**Sign-off (T-358 D-T358-6, in-PR):** the canonical mid-hold golden is committed at `parity-fixtures/data/cricket-ball-by-ball-dots/` with the single-variant manifest shape (no `variants` key, per T-359a backward compat). Frontmatter `signOff.parityFixture` is `signed:2026-05-05`. The golden was rendered locally via `scripts/generate-preset-parity-fixture-prod.ts` (the puppeteer/CDP-bound prod renderer); the `scoreBug` clipKind binds to `outcome-row` per the v1 resolver in `packages/parity-cli/src/generate-fixture.ts`. The OFL fallback face renders any future painted glyphs (the BYO face is not vendored per ADR-004 §D3); the v1 chips carry their outcome glyph as the SVG `<title>` only. Re-render + re-sign with `--force` is the operator's path if the BYO face becomes available locally or the canonical-over outcomes change.

## References

- `docs/compass_artifact.md` § Cricket scorebug — canonical visual source (note: on-disk path mismatch flagged for resolution; integrity invariant 7 SKIPped globally).
- `skills/stageflip/presets/sports/cricket-scorebug.md` — sister cricket preset (cluster B); the canonical broadcast scoreBug of which this preset is the over-progression annex (T-332+).
- `skills/stageflip/presets/data/f1-sector-purple-green.md` — sister cluster-E preset; same workflow, `bigNumber` clipKind, single central number.
- `skills/stageflip/presets/data/SKILL.md` — cluster E conventions.
- `packages/runtimes/frame-runtime-bridge/src/clips/outcome-row.tsx` — the bound primitive (`OutcomeRow`, `outcomeRowClip`); shipped by T-358a as a generic chip-row.
- `packages/parity-cli/src/generate-fixture.ts` — v1 resolver mapping `scoreBug → outcome-row` (T-358 D-T358-4).
- ADR-004 (preset system contract — frontmatter, loader, validator, parity sign-off, integrity invariants).
- ADR-005 (LiveData posture — relevant for the deferred T-355–T-357 binding, NOT for T-358).

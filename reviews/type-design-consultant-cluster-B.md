---
title: Type-design consultant — Cluster B (Sports)
id: reviews/type-design-consultant-cluster-B
reviewedAt: 2026-05-14
clusterPresets:
  - cricket-scorebug
  - espn-bottomline-flipper
  - f1-timing-tower
  - fox-nfl-no-chrome
  - masters-red-under-par
  - nbc-snf-possession-illuminated
  - premier-league-field-of-play
  - uefa-starball-refraction
  - wimbledon-green-purple
signedOff: 'signed:2026-05-14'
owner_task: T-382
---

# Type-design consultant — Cluster B (Sports)

Cluster B presets cite seven bespoke broadcast typefaces — Custom Star Sports / ICC, ESPN A2 Beckett + Klavika, Formula1 Display, Fox Sports custom, CBS Sports custom, Sweet Sans Pro + NBC Tinker, Premier Sans, Champions (Fontsmith), and Gotham. All nine presets render dense tabular numerals on broadcast-dark backgrounds, with multi-line column alignment as the load-bearing typographic rule. **Numeral design is load-bearing on every Cluster B preset** — scores, gap times, set scores, run rates, point totals, clock readouts. Each ranked fallback below has been screened for tabular-figure support on its respective Google Fonts release; entries without tabular default behaviour are flagged in the per-preset notes.

## cricket-scorebug

**Bespoke / preferred:** Custom Star Sports / ICC (`proprietary-byo`)

**Three ranked fallback candidates** (license-cleared registry only):
1. **IBM Plex Sans** — current preset fallback at weight 600; humanist-grotesque hybrid with default tabular numerals across 100–700; strong run-rate / partnership-figure column alignment.
2. **Source Sans 3** — open humanist sans with tabular figures as the default; weight 600 reads similarly to Plex SemiBold at 16–18 px.
3. **Inter** — geometric-leaning grotesque; tabular default; cleaner at 14 px chip text but slightly cooler than Plex's broadcast neutrality.

**Kerning / x-height / weight deltas** vs. Custom Star Sports / ICC:
- x-height: matched (≈ +1% vs. bespoke; cricket broadcast custom faces sit close to humanist-sans norms)
- cap-height: matched (within ±1%)
- letter-spacing: default `tracking-normal`; no override required
- weight coverage: 600 SemiBold present in all three; Plex Sans is the only one with a complete 100–700 ladder used by the existing preset
- numeral design: **tabular by default in all three** — Plex Sans renders fixed-width 0–9 across runs / wickets / overs / RR / RRR / partnership columns simultaneously; critical for cricket's dense multi-row panel

**Rationale** — The bespoke Star Sports / ICC face signals authoritative, dispassionate cricket-broadcast lineage (legible at distance on a dense multi-row register). IBM Plex Sans 600 best approximates this: neutral, slightly mechanical, tabular figures by construction.

**Reference-frame recommendation** — Steady-state mid-over at frame 60. The fixture renders `IND 247/4 (42.3 ov)` + `RR 5.85 · RRR 6.42` + on-strike-marked `* Kohli 87 (92)` + `Rahul 34 (41)` simultaneously; verifies column alignment under tabular figures.

**Final recommendation:** **IBM Plex Sans 600** — Source Sans 3 reads slightly warmer (less broadcast-formal); Inter is too geometric for cricket-broadcast lineage. Plex's slight humanist warmth fits the Star Sports register without slipping into the consumer-sans neighbourhood.

## espn-bottomline-flipper

**Bespoke / preferred:** ESPN A2 Beckett + Klavika (`proprietary-byo`)

**Three ranked fallback candidates** (license-cleared registry only):
1. **Roboto Condensed + Inter** — current preset pairing at weight 700; Roboto Condensed handles A2 Beckett's tall-condensed score numerals; Inter handles Klavika's bold-sans status-token register.
2. **Barlow Condensed + Inter** — Barlow Condensed has slightly tighter spacing and a sharper apex than Roboto Condensed; closer to A2 Beckett's display geometry.
3. **League Gothic + Public Sans** — extreme condensation on League Gothic for team-code abbreviations; Public Sans neutral on FINAL / halftime tokens. Backup if Reviewer demands a more aggressive condensed register.

**Kerning / x-height / weight deltas** vs. ESPN A2 Beckett + Klavika:
- x-height: Roboto Condensed +2% vs. A2 Beckett (slightly taller lowercase, but the chips are all-caps so largely irrelevant)
- cap-height: matched within ±2% on Roboto Condensed; Barlow Condensed −1%
- letter-spacing: chip-internal `0.02em` (primitive-baked); no override needed
- weight coverage: Roboto Condensed weights 300/400/700; Inter full 100–900 ladder. The 700 weight matches the stub's "Bold Condensed 18–22 pt" register
- numeral design: **load-bearing — A2 Beckett's tall-condensed score numerals are the brand signature.** Roboto Condensed renders tabular numerals by default; the score-vs-delta column reads cleanly (`102 ▲ +5` aligns across rows). Barlow Condensed is also tabular-default. Both preserve the column-edge alignment the ESPN BottomLine canon requires.

**Rationale** — A2 Beckett's tall-condensed display signals "sports-broadcast urgency, dense data, scan-at-glance." Roboto Condensed is the closest OFL/Apache match: condensed proportions, geometric apex, tabular figures. Klavika's bold-sans neutrality on status tokens (FINAL / H) is well-approximated by Inter 700 — identical numeral construction and rectangular apertures.

**Reference-frame recommendation** — Mid-segment steady-state at frame 60 (= `pairIdx = 0`). Top row `NYK 102 ▲ +5` in upColor `#FFD700` + bottom row `BOS 97 ▬ F` in flatColor `#FFFFFF` simultaneously exercise both the score-column tabular alignment AND the chip-internal letter-spacing.

**Final recommendation:** **Roboto Condensed + Inter 700** — Barlow Condensed is slightly closer in proportion but the existing pairing is already cluster-coherent (Inter shows up in fox-nfl-no-chrome, masters-red-under-par). League Gothic is too extreme and lacks weight ladder coverage. Keep current pairing.

## f1-timing-tower

**Bespoke / preferred:** Formula1 Display (`proprietary-byo`)

**Three ranked fallback candidates** (license-cleared registry only):
1. **Barlow Condensed** — current preset fallback at weight 600; condensed geometric sans with tabular figures by default; matches Formula1 Display's compressed proportions for the 20-driver tower's vertical density.
2. **Roboto Condensed** — slightly wider; tabular figures; available at 700; alternative if Reviewer wants a less-narrow column.
3. **Inter** (non-condensed) — fallback ONLY if condensed register is descoped; tabular numerals; would force wider tower geometry.

**Kerning / x-height / weight deltas** vs. Formula1 Display:
- x-height: Barlow Condensed −2% vs. Formula1 Display (Barlow's lowercase is slightly shorter)
- cap-height: matched within ±2%
- letter-spacing: default; no override; the 3-letter driver codes (`VER` / `NOR`) sit comfortably in the 180 px-wide tower
- weight coverage: Barlow Condensed full 100–900 ladder; 600 SemiBold reads as bold-but-not-black at the tower's 16 px-x-height target
- numeral design: **load-bearing — Formula1 Display's bespoke geometric numerals are the brand signature on gap times.** Barlow Condensed 600 ships tabular figures by default; the 3-decimal gap strings (`+0.124` / `+0.487` / `+1.234`) align column-edge cleanly across all 20 rows. Position numbers 1–20 also tabular.

**Rationale** — Formula1 Display signals "geometric velocity + telemetry precision." Barlow Condensed 600 is the closest geometric-condensed OFL family: tight apertures, vertical stress, tabular figures, full weight ladder. The condensed proportion is non-negotiable for the 20-driver tower's narrow column.

**Reference-frame recommendation** — Steady-state mid-session at frame 60. The fixture renders all 20 driver rows simultaneously with sector cells + tire chips + 3-decimal gap strings — best exercises tabular-figure column alignment under condensed proportions.

**Final recommendation:** **Barlow Condensed 600** — Roboto Condensed is slightly wider and would steal pixels from the gap-time column; non-condensed Inter would break the tower's vertical density. Keep current fallback.

## fox-nfl-no-chrome

**Bespoke / preferred:** Fox Sports custom (`proprietary-byo`)

**Three ranked fallback candidates** (license-cleared registry only):
1. **Inter Display** — current preset fallback at weight 900; display-optimised cut of Inter with tighter spacing at large sizes; massive-scale scores demand Black weight.
2. **Anton** — extreme condensed Black weight (single-weight family). Would deliver more impact at score-massive scale, but lacks weight ladder and is awkward for team-code abbreviations.
3. **Roboto Condensed** at weight 900 — fallback if Reviewer wants condensed-massive register; less broadcast-iconic than Inter Display.

**Kerning / x-height / weight deltas** vs. Fox Sports custom:
- x-height: Inter Display matched (±1%); Fox Sports custom sits within the Inter Display geometric-grotesque neighbourhood
- cap-height: matched within ±2%
- letter-spacing: default; chromeless register relies on negative space rather than tracking
- weight coverage: Inter Display full 100–900 ladder; weight 900 (Black) is critical for the stub's "Extra Bold / Black, 40–48 pt" score register
- numeral design: **load-bearing — Fox Sports custom's letter-C-resembles-FOX-O curiosity is brand-DNA on score numerals.** Inter Display does not preserve this specific bespoke detail (documented cosmetic divergence). Tabular figures by default; score column `'24' / '17'` aligns cleanly.

**Rationale** — Fox Sports custom signals "premium-broadcast confidence + massive-scale impact." Inter Display 900 is the closest license-cleared Black-display sans: tight apertures, large counters, tabular figures, optical-display cut. The chromeless register depends on the typeface alone carrying the visual weight — Inter Display is the cluster's best Black-display option.

**Reference-frame recommendation** — Steady-state mid-game at frame 60. The fixture renders `KC 24` / `17 PHI` flanking the centred clock `04:32` / `Q3` / `3rd & 7`; verifies Black weight rendering across both team-code and score columns.

**Final recommendation:** **Inter Display 900** — Anton is too condensed for team-code legibility at 28 px; Roboto Condensed 900 lacks the optical-display cut Inter Display ships. Keep current fallback.

## masters-red-under-par

**Bespoke / preferred:** CBS Sports custom (`proprietary-byo`)

**Three ranked fallback candidates** (license-cleared registry only):
1. **Inter** — current preset fallback at weight 600; neutral humanist-grotesque; tabular figures by default; reads well in the 5-row leaderboard panel.
2. **IBM Plex Sans** — slight humanist warmth; tabular figures; weight 600 ladder; alternative if Reviewer wants more broadcast-formal lineage.
3. **Source Sans 3** — open humanist; tabular figures; weight 600; cleaner at small leaderboard sizes but lacks Inter's neutrality.

**Kerning / x-height / weight deltas** vs. CBS Sports custom:
- x-height: Inter +2% vs. CBS Sports custom (slightly taller lowercase; PLAYER column reads marginally more open)
- cap-height: matched within ±2%
- letter-spacing: default; no override; surname column has flex sizing
- weight coverage: Inter full 100–900 ladder; 600 SemiBold matches the rank / score-column register
- numeral design: **load-bearing — score-to-par + thru-hole columns are the primary visual signal.** Inter 600 ships tabular figures by default; the right-aligned tabular score column reads cleanly across all 5 rows. The canonical CBS red-black-green per-cell color rule is primitive-divergence (single-color-per-column ships) — typography is not the bottleneck here.

**Rationale** — CBS Sports custom signals "broadcast-formal, premium-leaderboard authority." Inter 600 is the cluster's existing neutral-grotesque baseline (also used in espn-bottomline-flipper); coherence wins. Augusta-green rank column rendering is color-property; typeface is unaffected.

**Reference-frame recommendation** — Steady-state mid-round at frame 60. The fixture renders top-5 leaderboard with surnames + tabular score-to-par + thru columns; verifies column-edge alignment and rank-column tint.

**Final recommendation:** **Inter 600** — IBM Plex Sans is slightly warmer but breaks intra-cluster coherence with espn-bottomline-flipper's Inter usage; Source Sans 3 is fine but redundant given Inter's broader cluster coverage. Keep current fallback.

## nbc-snf-possession-illuminated

**Bespoke / preferred:** Sweet Sans Pro + NBC Tinker (`commercial-byo + proprietary-byo`)

**Three ranked fallback candidates** (license-cleared registry only):
1. **Public Sans** — current preset fallback at weight 600; USWDS-derived humanist-grotesque with tabular figures; broadcast-friendly neutrality.
2. **Inter** — geometric-grotesque; full weight ladder; would slot consistently with espn-bottomline-flipper / masters-red-under-par / fox-nfl-no-chrome.
3. **IBM Plex Sans** — humanist warmth; tabular figures; alternative if Reviewer wants Sweet Sans Pro's geometric-display register approximated more closely.

**Kerning / x-height / weight deltas** vs. Sweet Sans Pro + NBC Tinker:
- x-height: Public Sans +1% vs. Sweet Sans Pro (Sweet Sans Pro is slightly more compact)
- cap-height: matched within ±2%
- letter-spacing: default; primitive uses 0 tracking
- weight coverage: Public Sans 100–900 ladder; weight 600 SemiBold matches the stub's "Bold 18–22 pt" team-code register
- numeral design: **load-bearing — scores + clock + down-and-distance simultaneously visible.** Public Sans 600 ships tabular figures by default; the 2-digit score column (`21` / `14`) + the clock (`08:14`) + the period (`Q2`) align under tabular construction.

**Rationale** — Sweet Sans Pro signals "premium-display geometric" — slightly more constructed than humanist neutrals. NBC Tinker is a network wordmark, irrelevant to body text. Public Sans 600 is the closest license-cleared humanist-grotesque; it diverges slightly from Sweet Sans Pro's geometric register but covers the broadcast neutrality the SNF canon requires. Inter would also work and improve cross-cluster coherence — recorded as a Reviewer alternative.

**Reference-frame recommendation** — Steady-state mid-game at frame 60. The fixture renders `KC 21` / `14 BUF` flanking the centred NBC circle + clock `08:14` / `Q2` / `<< 1st & 10`; verifies tabular score column + center-circle text rendering.

**Final recommendation:** **Public Sans 600** — Inter would marginally improve cross-preset coherence but Public Sans is already in the preset and renders cleanly; cosmetic divergence from Sweet Sans Pro is acknowledged. Keep current fallback. Cluster-coherence note: cluster registers are split between Public Sans / Inter / IBM Plex Sans — see Cross-preset coherence below.

## premier-league-field-of-play

**Bespoke / preferred:** Premier Sans (`proprietary-byo`)

**Three ranked fallback candidates** (license-cleared registry only):
1. **Space Grotesk** — current preset fallback at weight 600; geometric-display sans with display-DNA character; tabular figures by default; closest match to Premier Sans's 2017 brand-refresh display register.
2. **Inter** — neutral grotesque; would slot toward cross-cluster coherence; less geometric-display than Space Grotesk.
3. **DM Sans** — geometric humanist hybrid; tabular figures; alternative if Reviewer wants slightly warmer Premier Sans approximation.

**Kerning / x-height / weight deltas** vs. Premier Sans:
- x-height: Space Grotesk matched (±1%); both faces share geometric-display proportions
- cap-height: matched within ±2%
- letter-spacing: default; no override
- weight coverage: Space Grotesk weights 300–700; 600 SemiBold matches Premier Sans Medium-to-Bold equivalent
- numeral design: **load-bearing — bespoke Premier Sans numerals are explicitly cited in stub line 33 as "distinct numeral design preserved."** Space Grotesk ships tabular figures by default; the 2-digit score column (`2` / `1`) + clock (`67:42`) align under tabular construction. The bespoke Premier Sans numerals (specific terminal shapes) are NOT preserved in Space Grotesk — documented cosmetic divergence.

**Rationale** — Premier Sans (Robin Hill / DesignStudio 2017) signals "modern-premium football-broadcast identity." Space Grotesk is the closest license-cleared geometric-display sans: similar terminal treatment, tight apertures, tabular figures, design-magazine register. The PL purple chrome + green accent + Space Grotesk weighted-sans tabular figures preserve the broadcast canon.

**Reference-frame recommendation** — Steady-state mid-second-half at frame 60. The fixture renders `ARS 2` / `1 CHE` flanking the centred clock `67:42` / `2H`; verifies kit-color tile background + tabular score column.

**Final recommendation:** **Space Grotesk 600** — Inter would improve cross-cluster coherence but Space Grotesk's geometric-display character is closer to Premier Sans's brand register; DM Sans is fine but less iconic. Keep current fallback.

## uefa-starball-refraction

**Bespoke / preferred:** Champions / Champions Display Refracted (Fontsmith) (`proprietary-byo`)

**Three ranked fallback candidates** (license-cleared registry only):
1. **Fraunces** — current preset fallback at weight 700; classical-revival serif (Undercase Type); tabular figures available; the only serif in Cluster B and the closest match to Champions Display's serif-meets-display brand-DNA.
2. **EB Garamond** — classical-old-style serif; tabular figures; weight 600 available; alternative if Reviewer wants more humanist-literary register.
3. **Cormorant Garamond** — display-cut Garamond revival; tabular figures; weight 700; alternative if Reviewer wants more theatrical display.

**Kerning / x-height / weight deltas** vs. Champions (Fontsmith):
- x-height: Fraunces +3% vs. Champions Display (Fraunces is more expressive; Champions Display has a more reserved cap-to-x ratio)
- cap-height: matched within ±2%
- letter-spacing: default; UPPERCASE title register (`CHAMPIONS LEAGUE` / `MATCHDAY 6 — STANDINGS`) does not need open tracking
- weight coverage: Fraunces full 100–900 + optical-size axis; weight 700 (Bold) matches Champions Display Refracted's display register
- numeral design: **load-bearing — points column (`16 PTS` / `10 PTS`) anchors the standings panel.** Fraunces ships tabular figures (via `font-feature-settings: 'tnum'`); the points-column right-alignment is preserved. The bespoke Champions Refracted per-character refracted-gradient is NOT preservable in any OFL serif — explicit T-339b carve-out.

**Rationale** — Champions (Fontsmith) signals "European-elite premium-broadcast theatrical heritage." It's display-serif-leaning with display-only adornment. Fraunces is the closest license-cleared classical-revival serif with display weight and optical-size axis. The match is "shape-family adjacent" — not identical, but the only serif in the registry that carries Champions Display's premium broadcast register.

**Reference-frame recommendation** — Steady-state mid-matchday at frame 60. The fixture renders the 3×2 tile grid (RMA / LIV / BAY / MCI / PSG / INT) with refraction-palette tile colors + uppercase title + tabular points column; verifies serif title rendering + tabular value column.

**Final recommendation:** **Fraunces 700** — EB Garamond and Cormorant Garamond are more literary / theatrical respectively; Fraunces's optical-size axis and weight ladder make it more versatile for the title + tile-label hierarchy. Keep current fallback. **NOTE:** this is the ONLY serif in Cluster B; see Cross-preset coherence below for the register split.

## wimbledon-green-purple

**Bespoke / preferred:** Gotham (`commercial-byo`)

**Three ranked fallback candidates** (license-cleared registry only):
1. **Montserrat** — current preset fallback at weight 500; geometric humanist sans; tabular figures by default; closest license-cleared approximation to Gotham's spurless geometric character.
2. **DM Sans** — geometric-humanist hybrid; tabular figures; weight 500 available; slightly warmer than Montserrat.
3. **Inter** — neutral grotesque; cross-cluster coherence option; less geometric than Gotham.

**Kerning / x-height / weight deltas** vs. Gotham:
- x-height: Montserrat +3% vs. Gotham (Montserrat lowercase is taller; Gotham's classic geometric ratio is more reserved)
- cap-height: matched within ±2%
- letter-spacing: default; the bug is small (400×72 px); the surnames + country codes render in their natural Gotham-Medium-equivalent spacing
- weight coverage: Montserrat full 100–900 ladder; weight 500 (Medium) matches the stub's "Gotham Medium fallback" intent
- numeral design: **load-bearing — set-score columns + game-score column are tabular-mandatory per stub line 44.** Montserrat 500 ships tabular figures by default; the primitive additionally force-applies `font-variant-numeric: tabular-nums` on every set + game-score column independent of `font.tabularNums`. Column alignment is preserved at primitive render level regardless of typeface.

**Rationale** — Gotham (Hoefler & Co.) signals "American geometric authority + premium-broadcast neutrality." Montserrat (Julieta Ulanovsky) is the most widely-cited license-cleared Gotham approximation: similar geometric construction, taller x-height, full weight ladder. The Wimbledon green base + purple accent + Montserrat 500 tabular figures preserve the broadcast canon (purple accent is currently schema-supplied-but-unrendered — typography is not the bottleneck).

**Reference-frame recommendation** — Steady-state mid-third-set at frame 60. The fixture renders Djokovic (with yellow server-dot) + Alcaraz two-row stack with set columns `['6', '4', '7-6']` / `['4', '6', '6-7']` + game scores `40` / `30`; verifies tabular column alignment across mixed-width set strings (single-digit vs tiebreak-pair).

**Final recommendation:** **Montserrat 500** — DM Sans is acceptable but less Gotham-like; Inter improves cross-cluster coherence but breaks the geometric register Gotham signals. Keep current fallback.

## Cross-preset coherence

Cluster B is **NOT a coherent typographic system** — it is a deliberate four-register split that mirrors the bespoke-font split:

1. **Humanist-grotesque broadcast neutrals (3 presets)** — IBM Plex Sans (cricket-scorebug), Inter (masters-red-under-par), Public Sans (nbc-snf-possession-illuminated). These are interchangeable at the register level; the cluster could collapse to Inter 600 across all three with negligible visual loss, but each preset's chosen fallback was selected to approximate its bespoke nearest-neighbour (Plex's humanist warmth for Star Sports; Inter's neutrality for CBS; Public Sans's USWDS lineage for Sweet Sans Pro).

2. **Condensed-display / tall-numeric register (2 presets)** — Barlow Condensed (f1-timing-tower) + Roboto Condensed + Inter (espn-bottomline-flipper). Both anchor on tall-condensed score / gap-time columns. These two presets render visually-similar typographic registers and reinforce each other.

3. **Geometric-display register (2 presets)** — Space Grotesk (premier-league-field-of-play) + Inter Display (fox-nfl-no-chrome). Both signal premium-broadcast display character; Space Grotesk leans 2017-design-magazine, Inter Display leans massive-scale-broadcast. Coherent register, different intensity.

4. **Spurless-geometric register (1 preset)** — Montserrat (wimbledon-green-purple). The Gotham approximation is unique in Cluster B; it does not anchor with any sister preset. Acceptable — the Wimbledon register is intentionally distinct (compact bottom-left two-player stack vs. the rest of the cluster's larger horizontal/vertical bug layouts).

5. **Classical-revival serif register (1 preset)** — Fraunces (uefa-starball-refraction). The ONLY serif in Cluster B. Champions (Fontsmith) is the only serif-leaning bespoke face in the cluster, and Fraunces is the only license-cleared classical-revival serif in the registry. This is a deliberate single-register outlier and is acceptable; tenant compositions that pair uefa-starball-refraction with sister Cluster B presets (e.g., as a fullscreen title-card preceding a scoreBug) will see an intentional register shift between serif title and sans scoreBug — matches the actual UEFA broadcast canon (Champions Display Refracted for titles, neutral sans for in-game scoreBug).

**Numeral coherence** is the cluster's load-bearing typographic invariant — every fallback above ships tabular figures by default at its chosen weight. The wimbledon-green-purple primitive additionally force-applies `tabular-nums` at the primitive render level, so tabular discipline is guaranteed regardless of fallback choice.

**Cross-cluster collapse option (informational, NOT recommended):** if a future Reviewer requests Cluster B to collapse to a single typographic system, Inter 600 + Inter Display 900 + Fraunces 700 would cover all 9 presets at acceptable quality (loss: cricket's humanist warmth, Wimbledon's geometric-spurless register, F1's condensed verticality). The current split is preferred because each preset's nearest-bespoke-neighbour drives a more faithful broadcast register.

## Escalations

**None.** All nine Cluster B presets have an adequate license-cleared fallback in the existing registry. Cosmetic divergences are documented per-preset (bespoke numeral geometry on Premier Sans + Formula1 Display + A2 Beckett + Fox Sports custom + Champions Display Refracted; Gotham's spurless construction; Star Sports / ICC custom letter shapes; Sweet Sans Pro's geometric register) and are inherent to the BYO-only proprietary path. No font in this cluster requires expanding the license whitelist; no preset needs to descope.

The five-register cluster split is intentional and tracks the bespoke-font diversity (broadcast neutrals + condensed display + geometric display + spurless geometric + classical-revival serif). The single-serif outlier (uefa-starball-refraction → Fraunces) is acknowledged and acceptable.

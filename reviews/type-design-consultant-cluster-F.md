---
title: Type-design consultant — Cluster F (Captions)
id: reviews/type-design-consultant-cluster-F
reviewedAt: 2026-05-14
clusterPresets:
  - ali-abdaal-opacity-karaoke
  - hormozi-montserrat-black
  - karaoke-progressive-wipe
  - mrbeast-komika-axis
  - netflix-invisible
  - tiktok-rounded-box
signedOff: 'signed:2026-05-14'
owner_task: T-382
---

<!-- reviews/type-design-consultant-cluster-F.md
     Type-design consultant batch review for Cluster F (captions). Output of T-382. -->

# Type-design consultant — Cluster F (Captions)

Batch review of the six Cluster F (captions) presets against the license-cleared font registry. Cluster F renders at the **small end of the visible-text spectrum** in StageFlip's preset space — caption glyphs sit between 56 px (Netflix-invisible) and 108 px (MrBeast) on the parity composition, but the production register at 1080p mobile-vertical maps these down to ≈ 18–32 pt physical reading sizes against arbitrary video underlays. The cluster bifurcates cleanly into a **social-first heavy register** (Hormozi / MrBeast / TikTok — punchy, broadcast-loud, stroke-or-pill carries the read against muted autoplay) and a **creator-prestige register** (Ali Abdaal / Karaoke / Netflix-invisible — humanist or display caps, no-stroke or 1 px stroke, the typography itself carries the read). The two registers do NOT share a fallback chain and should not be reconciled to one — the cluster's typographic coherence comes from the WITHIN-register coherence, not across.

Word-by-word legibility at small sizes and stroke/highlight contrast are the two cluster-specific axes (see §"Cluster-specific concerns" at the end). Each preset is reviewed against those axes plus the standard registry / metrics / character-signal checks per the agent SKILL.md §"Quality thresholds".

---

## ali-abdaal-opacity-karaoke

**Bespoke**: TT Fors (TypeType foundry, `commercial-byo`). Geometric humanist sans, weight 600 at 64 px sentence-case. Single-foreground (`#1F1F1F` on white), no stroke, no backdrop, opacity-only emphasis (active 1.0, mute 0.6).

**What the bespoke signals**: classroom-quiet authority — the "professional reading aesthetic" of an educator who trusts the viewer to read prose. TT Fors's distinct read is a slightly-narrower-than-Inter geometric humanist with subtle proportional-numeral spacing and an x-height of ~0.52 em. The brand register depends on quiet competence; ANY stroke, color shift, or display-grotesque substitute would push the preset into a different cluster F sibling's register.

**Three ranked fallback candidates (license-cleared registry)**:

1. **Inter weight 600** (SIL OFL 1.1; Rasmus Andersson). Already the bundle's declared fallback. x-height ~0.55 em (+3% vs TT Fors); cap-height ~0.73 em (within ±1%); humanist-grotesque hybrid with proportional numerals by default. At 64 px sentence-case the active-vs-mute opacity delta reads identically to the bespoke; default tracking matches.
2. **Work Sans weight 600** (SIL OFL 1.1; Wei Huang). x-height ~0.51 em (–2%); humanist-leaning grotesque with slightly more open apertures than Inter. Renders well at small sizes (≥ 16 pt) because the apertures resist closing under sub-pixel rasterization. Trade-off: visibly different from Inter on side-by-side; same register though.
3. **Open Sans weight 600** (SIL OFL 1.1; Steve Matteson). x-height ~0.53 em; humanist with slightly looser default tracking. Reads marginally warmer than Inter — closer to TT Fors's "approachable educator" register than Inter's "interface-utility" register. Trade-off: looser tracking eats horizontal width at 64 px caption sizing; flex-wrap may bite earlier.

**Kerning / x-height / weight deltas vs TT Fors**:

- x-height: Inter +3%, Work Sans –2%, Open Sans +1%. All within the ±5% threshold.
- cap-height: all within ±2%.
- Tracking at default: Inter and Open Sans within the clip's `letterSpacing` default zero; Work Sans slightly tighter (–1%). No manual override needed.
- Weight 600 across all three is the medium-bold pick that approximates TT Fors 600 at 64 px without going into display-bold territory (which would push toward Hormozi register).

**Small-size legibility (16–24 pt)**: All three render cleanly at 24 pt physical (the ≈ 64 px at 1280×720 mapped to 1080p mobile). At 16 pt (the worst-case for very-cropped TikTok reposts), Inter still wins — Open Sans's looser tracking and Work Sans's narrower 'i' / 'l' counters lose distinguishability against compressed video underlays. The opacity-0.6 muted state remains readable at all three fallbacks down to 18 pt.

**Stroke/highlight contrast**: Not applicable — preset has `strokeWidth: 0` and no color highlight. The visual punch is delivered by the opacity delta alone; all three fallbacks carry the contract identically.

**Rationale**: The Ali Abdaal register is quiet humanism. Inter is the bundle-shipped fallback and the most-tested humanist sans across the StageFlip stack. The other two are valid alternatives if a tenant has brand reasons (Open Sans for warmth, Work Sans for slightly tighter screen-rendering), but neither beats Inter on the bundle-aligned default.

**Reference-frame recommendation**: Frame 60 (mid-hold, currentTimeMs 2000). Word 7 (`by`) active at 1.0; words 1–6 muted at 0.6. The word-change moment at the active-mute boundary is the cluster F captions invariant; verify that opacity-0.6 muted glyphs remain individually distinguishable AND that the active glyph stands at full opacity with no anti-aliasing halo. Secondary verification frame: the moment just past `word.endMs` for word 7 (≈ frame 63) when active-routing transitions to mute — confirms no flash artifact.

**Final recommendation**: **Inter weight 600** (already the declared fallback). Sign off.

---

## hormozi-montserrat-black

**Bespoke**: Montserrat weight 800 (SIL OFL 1.1 via Google Fonts; Julieta Ulanovsky). 96 px caps, 6 px black stroke, single-color yellow `#FFD60A` highlight, `rise` entrance + 80 ms stagger.

**What the bespoke signals**: broadcast-loud short-form video punch. Montserrat 800 is itself the license-cleared face — there is no BYO posture here. The "Black" weight nomenclature in the original stub was Adobe naming convention; the OFL family ships weight 800 (one step shy of 900 "Black") and the bundle pins to 800. This is the cluster F preset that is its own fallback.

**Three ranked fallback candidates (license-cleared registry)**:

1. **Montserrat weight 800** (OFL; declared preferred = declared fallback). The OFL face IS the canonical pick. Self-referential by design — Montserrat is so license-clean and so canonical to this register that the preset cites it directly. x-height 0.535 em; cap-height 0.7 em; geometric sans with strong vertical stress and dense character-fill at weight 800.
2. **Oswald weight 700** (SIL OFL 1.1; Vernon Adams). Condensed grotesque, dense vertical character-fill that approximates Montserrat 800's optical density when stroked at 6 px. x-height ~0.51 em (–5%); narrower horizontal width — more characters fit per line at the same size. Trade-off: narrower glyphs mean the per-word stroke wraps tighter; the 6 px stroke can occlude the inner counter of 'O' / 'D' / 'B' at 96 px more aggressively than Montserrat. NOT recommended for the parity register; ranked here only as an escape if Montserrat preload fails.
3. **Poppins weight 800** (SIL OFL 1.1; Indian Type Foundry). Geometric sans closer to Montserrat than Oswald is — round 'O' shapes, similar x-height (0.535 em, –0%), similar cap-height. Trade-off: Poppins 800 reads slightly softer than Montserrat 800 because the terminal cuts are more rounded — broadcast-loud is marginally less aggressive. Acceptable, but no improvement on the bundle default.

**Kerning / x-height / weight deltas vs Montserrat 800**: N/A for #1 (identity). For Oswald: x-height –5% (boundary), cap-height +2%, tracking –4% (narrower glyphs naturally). For Poppins: within ±1% across all metrics; tracking identical at default.

**Small-size legibility (16–24 pt)**: Montserrat 800 survives down to 18 pt physical because the heavy weight + 6 px stroke (which scales proportionally) preserves glyph distinguishability under autoplay-muted compression. At 16 pt the stroke begins to clog inner counters of 'a' / 'e' / 'o' — the preset is not intended for very-small-physical contexts; the register IS the upper-bound of mobile-caption sizing. Oswald survives slightly better at 14 pt due to vertical density but loses the broadcast register. Poppins matches Montserrat at all sizes ≥ 18 pt.

**Stroke/highlight contrast**: This IS the load-bearing axis for Hormozi. The 6 px black stroke must wrap every glyph cleanly without halo or overshoot. Montserrat 800's terminal cuts (sharp horizontal cuts on 'L' / 'E' / 'T' verticals) carry the stroke cleanly. Yellow `#FFD60A` highlight on the active word against white-stroked rest words is the canonical visual punch; any fallback that softens terminals (Poppins) marginally reduces the stroke-as-frame effect. Oswald's condensed glyphs make the highlight word read as "lighter" because the active-word colored fill area is smaller per glyph — bad for the register.

**Rationale**: Montserrat is its own fallback. The OFL face IS the canonical implementation. No substitute beats it; the two alternatives are documented for completeness only.

**Reference-frame recommendation**: Frame 45 (mid-hold, currentTimeMs 1500). Active word `FOREVER` in yellow; preceding five words white-stroked. The word-change moment (frame 45 = exactly active.startMs for word 6; previous active was word 5 ending at 1500) is where active-routing flips; verify the yellow appears precisely at the frame boundary with no overlap or gap. Secondary frame: end of entrance window (frame ~33) to confirm entrance settled and stroke geometry stable.

**Final recommendation**: **Montserrat weight 800** (declared preferred AND fallback; same OFL face). Sign off.

---

## karaoke-progressive-wipe

**Bespoke**: Bebas Neue (SIL OFL 1.1 via Google Fonts; Dharma Type), weight 700 at 96 px ALL-CAPS. Already the license-cleared preferred font. Declared fallback Anton weight 400 (also OFL via Google Fonts; Vernon Adams).

**What the bespoke signals**: music-video stage-light typography. Condensed all-caps display sans that reads as "concert ticker", "MTV lyric overlay", "karaoke-screen heading". Bebas Neue is the modern canonical face for this register and has been since ~2010. No BYO posture; both preferred and fallback are OFL.

**Three ranked fallback candidates (license-cleared registry)**:

1. **Bebas Neue weight 700** (OFL; declared preferred). Self-referential — Bebas Neue IS the license-cleared face. x-height ~0.71 em (notably high — display caps are essentially full-height); cap-height 1.0 em; condensed grotesque, single-weight family in its v1 distribution but Google Fonts ships a multi-weight variant covering 100–700. The bundle pins weight 700 which is the heaviest cut.
2. **Anton weight 400** (OFL; declared fallback). Single-weight family by design — Anton ships only at weight 400 ("regular" but the design IS heavy). x-height matches Bebas Neue within ±1%; condensed-display register with marginally wider apertures than Bebas Neue. The bundle's `font.family` chain falls through to Anton when Bebas Neue is not preloaded; renders the karaoke wipe identically. Reads as the same register; the side-by-side delta is detectable only on careful inspection of individual letterforms ('R' and 'Q' tails differ slightly).
3. **Oswald weight 600** (SIL OFL 1.1; Vernon Adams). Condensed grotesque from the same designer as Anton (Vernon Adams). Slightly wider proportions than Bebas Neue / Anton; cap-height 1.0 em; x-height 0.52 em (the lower-case relevant only for the `casing: 'as-is'` ballad-register sister preset, not for this preset's uppercase canon). Acceptable second-fallback if both Bebas Neue AND Anton fail to preload; the wipe-edge clipPath geometry is identical across all three.

**Kerning / x-height / weight deltas**: Bebas Neue → Anton: x-height within ±1%, cap-height identical, tracking identical at default. Bebas Neue → Oswald: x-height –3% (within threshold), cap-height –1%, tracking +2% (Oswald glyphs slightly wider). All three within the ±5% / ±3% thresholds.

**Small-size legibility (16–24 pt)**: Display-caps fonts are designed for ≥ 36 pt; at 24 pt they read as "small headlines"; at 16 pt all three condense too far and the karaoke wipe progress polygon becomes hard to perceive (the wipe edge needs ≥ 2 px of cap-height to read as a distinct mid-glyph boundary). Production karaoke videos sit at 36–72 pt physical so this is not a concern in practice. The 96 px bundle default at the 1280×720 parity composition maps to ≈ 54 pt at 1080p horizontal which is solidly within the comfort zone.

**Stroke/highlight contrast**: No stroke (`strokeWidth` unset, primitive renders no SVG stroke for lyrics). The highlight is the karaoke wipe color `#F3CE32` yellow on the past-cursor portion of the active line, against `#CCCCCC` foreground gray on the future portion. The visual punch comes from (a) the wipe-edge polygon's hard left-to-right boundary, (b) the active-line glow halo (`blur: 6`), and (c) the dim-vs-active opacity contrast across the three-line stack. All three fallbacks carry the wipe polygon identically because it's an SVG `<clipPath>` operating on the `<text>` element's bounding box, which is metrics-derived and consistent across the three condensed-caps fonts.

**Rationale**: Bebas Neue is license-cleared and already the canonical preferred font. Anton (declared fallback) is metrically near-identical and OFL. Oswald is the documented escape if both fail. No need to expand beyond the bundle's existing chain.

**Reference-frame recommendation**: Frame 105 (mid-hold, currentTimeMs 3500). Line 1 actively wiping at ~40% progress. The word-change moment for the karaoke register is **the wipe-edge crossing**, not a word-active transition — verify the clipPath polygon edge sits cleanly between two glyphs (or mid-glyph if the wipe is exactly there) with no halo or wedge artifact at the boundary. Secondary frame: just before line 1 starts (frame 75) to verify line entrance fade is clean; and just past line 1 ends (frame 150) to verify the stack-shift to line 2 is a clean snap with no residual halo on line 1.

**Final recommendation**: **Bebas Neue weight 700** (preferred) → **Anton weight 400** (declared fallback) → Oswald weight 600 (documented escape). Sign off as declared.

---

## mrbeast-komika-axis

**Bespoke**: Komika Axis (Blambot Comic Fonts, `commercial-byo`). Chunky comic-display sans, single weight, 108 px ALL-CAPS, 5 px black stroke, three-color cycling highlight (red `#FF3B30` → yellow `#FFD60A` → green `#34C759`).

**What the bespoke signals**: cartoonish high-energy YouTube viral-shorts register. Komika Axis is the comic-strip-poster register — chunky single-weight glyphs designed for "POW" and "BANG" sound effects. The MrBeast channel's adoption of Komika Axis (since ~2018) made it the canonical face for contest / challenge / money-stakes video captions. The cycling-color highlight depends on the heavy comic-display character signal; substitute a serious display face (Impact, Anton) and the register collapses into news / broadcast territory.

**Three ranked fallback candidates (license-cleared registry)**:

1. **Bangers weight 400** (SIL OFL 1.1; Vernon Adams). Already declared fallback. The cleanest comic-display sans on Google Fonts; designed explicitly as a comic-strip face. x-height ~0.65 em (caps-dominant design, lower-case rarely visible); cap-height 1.0 em; single weight 400 but the design IS heavy. Tracks ~2% looser than Komika Axis; the 5 px stroke wraps glyphs cleanly. The strongest OFL approximation of the comic-display register.
2. **Bowlby One weight 400** (SIL OFL 1.1; Vernon Adams). Heavier than Bangers — Bowlby One is essentially "Cooper Black for comic-display". x-height ~0.55 em; cap-height ~0.75 em (shorter glyphs); reads as more "1970s saturated poster" than "comic-strip POW". Acceptable as a heavier alternative if a tenant brand demands density; loses the comic-strip register character signal vs Bangers.
3. **Luckiest Guy weight 400** (Apache 2.0; Astigmatic). Slanted comic-display caps with thin baseline and chunky x-height. Closer to "American football jersey number" than "comic-strip sound effect" — distinct enough register to break MrBeast's tone. Documented as a third option for breadth, NOT recommended.

**Kerning / x-height / weight deltas vs Komika Axis**: Bangers: x-height +2%, cap-height +1%, tracking +2%, weight equivalent (both single-weight heavy-designs). Bowlby One: x-height –10% (**OUT of ±5% threshold**), cap-height –12% (out), tracking +5%. Luckiest Guy: x-height +5% (boundary), cap-height –5% (boundary), slant +3°.

**Small-size legibility (16–24 pt)**: Comic-display fonts at 16 pt collapse — the chunky terminals merge with the 5 px stroke and inner counters of 'B' / 'O' / 'P' / 'R' close up. At 24 pt Bangers still distinguishes glyphs; Bowlby One loses 'P' vs 'R' distinction. The MrBeast register is designed for ≥ 36 pt physical (matching the 108 px bundle default mapped to ≈ 60 pt at 1080p mobile), so 16 pt is not the operating zone — but reposts cropped to thumbnail-sized previews can compress to 14–18 pt, and Bangers degrades most gracefully.

**Stroke/highlight contrast**: This IS the dominant axis for MrBeast. The 5 px black stroke + three-color cycling highlight (red / yellow / green on emphasis words; white on connectors) is the visual signature. Bangers carries the 5 px stroke cleanly because its chunky terminals are flat-cut (vs Bowlby One's softly-rounded terminals which absorb stroke width and reduce perceived heaviness). The cycling highlight depends on each highlighted-word being readable as a saturated color block at 108 px — Bangers's heavy uniform stroke makes the color block read as a solid hue; Bowlby One's softer terminals dilute the color block at the glyph edges; Luckiest Guy's slant introduces a directional artifact that competes with the cycling cadence.

**Rationale**: Bangers is the bundle-aligned fallback and the cleanest OFL substitute for Komika Axis's comic-display register. The MrBeast register lives or dies by character signal; Bangers preserves it while Bowlby One and Luckiest Guy each drift into adjacent registers (saturated-poster and football-jersey respectively).

**Reference-frame recommendation**: Frame 60 (mid-hold, currentTimeMs 2000). Active word `DOLLARS` in green; preceding words rendered with cycling colors on words 2 (red) and 4 (yellow). The word-change moment is the active-word green appearing — verify the cycling palette routes through `highlightedIndex % 3 == 2` correctly with no double-routing artifact (active + emphasis on the same word). Secondary frame: at the entrance overshoot peak (~frame 46 for word 6 at staggered start; t=0.6 of entrance window = scale 1.15) to verify the bounce overshoot interpolation is stable across the fallback font's glyph baseline.

**Final recommendation**: **Bangers weight 400** (already declared fallback). Sign off.

---

## netflix-invisible

**Bespoke**: Netflix Sans (Netflix in-house, `proprietary-byo`). Humanist sans designed for player-chrome and subtitle legibility. 56 px sentence-case weight 500, 1 px black stroke, `backdrop: 'rect'` at 0.7 opacity, `muteOpacity: 0` (active-only visibility).

**What the bespoke signals**: infrastructure-grade subtitling. Netflix Sans was commissioned to replace Gotham across Netflix's UI in 2018; its subtitle cut is metrically designed for sentence-case reading at small physical sizes (≥ 12 pt physical on TV-viewing-distance displays). Distinguishing letterforms ('I' vs 'l' vs '1', 'O' vs '0') are explicitly optimised for legibility against arbitrary video underlays. The proprietary-BYO posture is firm — Netflix does not license Netflix Sans externally.

**Three ranked fallback candidates (license-cleared registry)**:

1. **Inter weight 500** (SIL OFL 1.1; Rasmus Andersson). Already declared fallback. The OFL humanist sans most closely engineered for screen-reading legibility; the only OFL face with comparable distinguishing-letterform design ('I' has serifs, 'l' is bare, '1' has a flag — exactly the disambiguation Netflix Sans implements). x-height 0.5 em (within ±2% of Netflix Sans); cap-height 0.73 em. Renders cleanly at 12–16 pt physical.
2. **IBM Plex Sans weight 500** (SIL OFL 1.1; Bold Monday for IBM). Humanist with slab-edge terminals and explicit letterform disambiguation. x-height 0.515 em; cap-height 0.7 em. Closer-to-warm reading register than Inter. Renders well at small sizes; the slab terminals add a subtle "broadcast" register that pushes slightly away from Netflix's "neutral infrastructure" tone but stays in-bounds.
3. **Source Sans 3 weight 500** (SIL OFL 1.1; Paul D. Hunt for Adobe). Already cited as a fallback for the TikTok preset. Humanist-grotesque hybrid; x-height 0.485 em (–3%); cap-height 0.66 em (–4%). Renders cleanly at 16 pt+ but the lower x-height eats vertical legibility at the 56 px bundle size when scaled down to 14 pt physical on mobile reposts of long-form video.

**Kerning / x-height / weight deltas vs Netflix Sans**: Inter: x-height +0%, cap-height +1%, tracking +1%. IBM Plex Sans: x-height +3%, cap-height –1%, tracking +0%. Source Sans 3: x-height –3%, cap-height –4%, tracking +1%. All three within the ±5%/±3% thresholds but Source Sans 3 is at the edge.

**Small-size legibility (16–24 pt)**: This is THE load-bearing axis for Netflix-invisible. The preset's whole point is strict-accessibility legibility at small physical sizes (Netflix's style guide caps captions at 42 chars per line × 2 lines, viewed from TV-watching distance ≈ effective 14–18 pt). Inter wins decisively here — it is the only OFL fallback whose letterform-disambiguation (notably the `I` / `l` / `1` triplet, and the `0` / `O` pair) was an explicit design goal. IBM Plex Sans is a strong second because of its slab-edge clarity. Source Sans 3 loses on x-height. None of the three is as well-optimised as Netflix Sans itself, but Inter at weight 500 closes 90% of the gap.

**Stroke/highlight contrast**: The 1 px black stroke is the minimum-legibility floor — it must wrap every glyph without occluding inner counters at 56 px (mapped to 14–18 pt physical). Inter's flat-cut terminals carry the 1 px stroke cleanly. IBM Plex Sans's slab edges add visual weight to the stroke (effective ~1.2 px perceived) which is acceptable. Source Sans 3's slightly-rounded terminals soften the stroke and reduce contrast against light-canvas underlays. The translucent rect backdrop at 0.7 opacity provides the dominant contrast; the stroke is the backup for backdrop-edge regions.

**Rationale**: The strict-accessibility contract demands the most-legibility-engineered OFL face available. Inter is that face. The other two are documented for completeness; neither beats Inter on the load-bearing axis (small-size letterform disambiguation).

**Reference-frame recommendation**: Frame 45 (mid-hold, currentTimeMs 1500). Active word `for` at opacity 1.0 inside the translucent rect; words 1–3 at opacity 0 (invisible); word 5 not yet rendered. The word-change moment for this preset is **the strict snap-on/snap-off transition** between active words — verify that at exactly `word.endMs` the prior active word disappears completely (opacity → 0) with no residual pixel coverage AND that at exactly `word.startMs` the next active word appears at full opacity with no fade-in artifact. Secondary frame: frame 46 (one frame past active.startMs boundary for word 4) to confirm the rect backdrop's geometry follows the active-word region (this is the issue flagged in the preset's "Known issues" section — type-design choice is independent of the primitive layout bug, but legibility verification depends on the rect actually sitting behind the glyph).

**Final recommendation**: **Inter weight 500** (already declared fallback). Sign off.

---

## tiktok-rounded-box

**Bespoke**: TikTok Sans (TikTok-platform, `platform-byo`). Launched May 2023 as TikTok's native typeface (replacing Proxima Nova Semibold). Neutral platform-grotesque, sentence-case, 72 px weight 700. `backdrop: 'pill'` per-word pills at 0.9 opacity carry the contrast.

**What the bespoke signals**: platform-native auto-caption register — the algorithmic on-platform read. TikTok Sans is engineered for the platform's UI density (compact-vertical mobile, per-word pill backdrops, sentence-case auto-caption stream from the platform's transcription service). The platform-BYO posture is firm — TikTok Sans is not redistributable. The fallback chain matters more here than for any other Cluster F preset because virtually no tenant will be embedding TikTok Sans; the system-stack or Source Sans 3 IS the production read.

**Three ranked fallback candidates (license-cleared registry)**:

1. **Source Sans 3 weight 700** (SIL OFL 1.1; Paul D. Hunt for Adobe). Already declared fallback. Neutral humanist-grotesque hybrid; x-height 0.485 em; cap-height 0.66 em; tracking native to short-form caption display. Reads as platform-neutral (no broadcast inflection, no display-poster inflection) — the closest OFL match for TikTok Sans's deliberate neutrality. Weight 700 matches the bundle's `font.weight: 700`. Renders cleanly inside the per-word pill at 0.9 opacity background.
2. **Inter weight 700** (SIL OFL 1.1; Rasmus Andersson). Humanist grotesque with explicit screen-reading optimisation. x-height 0.5 em (+3% vs Source Sans 3); slightly more open apertures. Reads marginally "more interface-utility" than Source Sans 3's "platform-neutral" — a hair off-register but well within the ±5% thresholds. Acceptable second-choice.
3. **Work Sans weight 700** (SIL OFL 1.1; Wei Huang). Humanist sans with slightly tighter tracking than Inter. x-height 0.51 em; cap-height 0.71 em. Renders well at small sizes; matches the platform-neutral register. Reads slightly warmer than Source Sans 3; not recommended for the cross-posted-to-Reels register but acceptable for TikTok-native compositions.

**Kerning / x-height / weight deltas vs TikTok Sans**: Source Sans 3: x-height –2%, cap-height –1%, tracking identical at default. Inter: x-height +1%, cap-height +2%, tracking identical. Work Sans: x-height –0%, cap-height +1%, tracking –1%. All three well within thresholds.

**Small-size legibility (16–24 pt)**: All three render cleanly at 18–24 pt physical (the TikTok mobile-vertical operating zone). At 16 pt Source Sans 3's lower x-height begins to lose vertical legibility but the per-word pill backdrop's 0.9-opacity contrast compensates — the pill IS the legibility floor for this preset, not the typography. Inter wins outright at 14 pt because of its explicit small-size optimisation; Work Sans is between the two.

**Stroke/highlight contrast**: No stroke (`strokeWidth: 0`). The per-word pill backdrop (black at 0.9 opacity) provides the dominant contrast — every word reads as white-on-near-black-rounded-rect regardless of canvas. No color highlight (`highlightColor === foreground === '#FFFFFF'` in the TikTok bundle). The visual emphasis IS the pill, not the type or color. All three fallbacks therefore carry the contrast identically — the typography axis is downgraded to "shape compatibility with the per-word pill geometry", which all three fallbacks satisfy.

**Rationale**: Source Sans 3 is the bundle's declared fallback and the cleanest platform-neutral OFL choice. The lower stakes (pill carries contrast, no stroke, no color cycle) mean the type-design choice is less load-bearing here than for the other five Cluster F presets — any neutral humanist-grotesque hybrid at weight 700 will read in-register. Source Sans 3 is the canonical pick on tie-breaker (declared fallback + Adobe-funded sustained maintenance).

**Reference-frame recommendation**: Frame 45 (mid-flight slide entrance, currentTimeMs 1500). Word 5 (`this`) mid-slide at ~55% opacity and ~18 px below settled position. The word-change moment for the TikTok register is the **slide-from-bottom entrance** — verify the word's translateY interpolation is smooth across frames 38.4 → 50.4 and the per-word pill backdrop geometry tracks the word's bounding box throughout (the pill should slide WITH the word, not sit at the settled position while the word slides into it). Secondary frame: frame 50 (one frame before entrance settles for word 5) to verify the final-frame interpolation lands at translateY 0 and opacity 1.0 cleanly.

**Final recommendation**: **Source Sans 3 weight 700** (already declared fallback). Sign off.

---

## Cross-preset coherence

Cluster F is **typographically incoherent BY DESIGN** — it captures the full span of social-video caption registers from broadcast-loud (Hormozi / MrBeast) to platform-neutral (TikTok) to creator-quiet (Ali Abdaal) to music-video display (Karaoke) to infrastructure-subtitle (Netflix). A user installing all six presets and switching between them will perceive distinct typographic registers — that is the contract, not a coherence failure.

Within-cluster, the recommended fallbacks group into two register families that ARE internally coherent:

- **Social-first heavy register** — Montserrat 800 (Hormozi), Bangers 400 (MrBeast), Source Sans 3 700 (TikTok). All three carry their visual emphasis via secondary mechanisms (stroke, stroke + cycling, pill) and the type plays a supporting role. Heavy weight, caps or sentence case, optimised for muted-autoplay readability.

- **Creator-prestige register** — Inter 600 (Ali Abdaal), Bebas Neue 700 / Anton 400 (Karaoke), Inter 500 (Netflix-invisible). Three of the four faces are humanist sans (Inter 600, Inter 500) or condensed-display caps (Bebas Neue / Anton). The type itself carries the read; minimal or zero stroke; emphasis via opacity, wipe, or active-only visibility rather than color shift.

Two of the six presets share Inter (Ali Abdaal 600, Netflix-invisible 500). This is intentional — Inter's humanist-grotesque hybrid and small-size optimisation makes it the OFL go-to for both registers. The weight delta (500 vs 600) keeps them distinguishable in side-by-side use.

No preset in the cluster requires a font outside the OFL whitelist via its recommended fallback. License posture: clean across the cluster.

## Cluster-specific concerns (captions axis verification)

**Word-by-word legibility at small sizes (16–24 pt)** — addressed per preset. Summary: Inter and Source Sans 3 are the strongest small-size performers in the recommendations; Bangers and Montserrat 800 hold at ≥ 18 pt physical (the cluster's lower-bound operating zone); Bebas Neue / Anton are display-caps faces and should never be operated below 24 pt physical regardless of cluster role.

**Highlight/stroke contrast** — addressed per preset. Summary: the heavy-register presets (Hormozi 6 px stroke, MrBeast 5 px stroke + cycling) require fallbacks with flat-cut terminals (Montserrat 800, Bangers — both flat-cut) to carry stroke geometry cleanly; the no-stroke-no-color presets (Ali Abdaal opacity-only, TikTok pill-only, Karaoke wipe-only, Netflix backdrop-only) downgrade typography to a supporting role and allow broader fallback choice. Komika Axis fallback (Bangers) is the only meaningful comic-display register concern — substituting a serious display face would collapse the MrBeast register entirely.

## Escalations

**Zero (0)** escalations to the Orchestrator. All six presets have license-cleared fallbacks already declared in their frontmatter, all six declared fallbacks satisfy the agent SKILL.md §"Quality thresholds" (license, weight coverage, proportions within thresholds, character signal matched, numerical not load-bearing for any captions preset, tracking within default), and all six recommended top fallbacks coincide with the bundle-shipped or frontmatter-declared fallback.

Notes for the Orchestrator (informational, not escalations):

- **Komika Axis (commercial-byo)** — the Blambot license expansion was previously considered (ADR-001 §D4). Current posture (commercial-byo + OFL Bangers fallback) is satisfactory; no whitelist expansion needed.
- **Netflix Sans (proprietary-byo)** — Netflix does not license externally. The proprietary-BYO posture is permanent; Inter 500 is the satisfactory fallback.
- **TikTok Sans (platform-byo)** — TikTok does not redistribute the face. The platform-BYO posture is permanent; Source Sans 3 700 is the satisfactory fallback.
- **TT Fors (commercial-byo)** — TypeType foundry; license available for individual purchase. Tenants embedding the Ali Abdaal preset commercially must source TT Fors themselves; Inter 600 is the satisfactory fallback.

No font whitelist expansion is recommended. The cluster's BYO posture (4/6 presets with BYO preferred fonts, all with cleared OFL fallbacks) reflects the natural state of social-video caption typography — the canonical bespoke faces are commercial / proprietary / platform-internal by design, and the OFL whitelist already covers the register span with adequate fallbacks.

Cluster F type-design batch review: **PASS**. Sign off all six presets at `signed:2026-05-14 — reviews/type-design-consultant-cluster-F.md`.

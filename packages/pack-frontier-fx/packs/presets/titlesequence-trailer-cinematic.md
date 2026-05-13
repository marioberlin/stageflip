---
id: titlesequence-trailer-cinematic
cluster: cluster-i
clipKind: titleSequence
source: Movie-trailer title-card canon — Christopher Nolan / Denis Villeneuve / Paul Thomas Anderson trailer-opener register; A24 distribution trailer canon (public references; no entry in docs/compass_artifact.md)
status: substantive
preferredFont:
  family: GT Sectra
  license: proprietary-byo
fallbackFont:
  family: Cormorant Garamond
  weight: 800
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
ownerTask: T-535
relatedTasks:
  - T-535
---

# Trailer Cinematic — letterboxed widescreen movie-trailer title card

Fifth + final premium TitleSequence template in the Frontier Effects Pack v0.2.0 — closes the Frontier Effects launch pack v0.2.0 + closes Phase γ entirely (P16 γ, all 30 tasks T-506..T-535 merged after this). The trailer-cinematic register is the slowest + most cinematic of the five — letterboxed 2.35:1 widescreen bars, heavy serif display headline, warm cream + burgundy palette, slow movie-trailer breathing pacing (9 s total cycle, including a 500 ms held-black entrance). Distinct from the four sister templates by aspect ratio (letterboxed widescreen, not full-frame), palette (warm cream + burgundy + black, not gold/cyan/red/B&W), and pacing (slowest; ~9 s total).

## Visual signature

Cinematic full-frame title card in the movie-trailer register characterized by 2.35:1 letterbox bars (black bars at top + bottom of the canvas reducing the active visible region to widescreen-cinematic aspect ratio), warm cream `#F5F1E8` headline typography, burgundy `#7F1D1D` accent tagline, slow movie-trailer pacing with a held-black entrance, and heavy-display-serif typography.

- **Background**: pure black `#000000` — same canonical pure black as action-bold (NOT noir-cinema's raised `#0A0A0A`, NOT sci-fi-glow's deep-blue `#0F172A`, NOT doc-minimal's inverted-white `#FFFFFF`).
- **Letterbox bars**: 2.35:1 widescreen letterbox — top + bottom of the canvas are filled with pure-black `#000000` bars at 92px height each (the 1280×720 canvas reduced to a 1280×544 active widescreen region, matching the 2.35:1 widescreen cinematic aspect ratio). The letterbox bars are pure-black on the pure-black canvas — invisible at the pixel level but materially constrain the headline composition to the widescreen-cinematic active region. The 2.35:1 letterboxing IS the movie-trailer canonical signature.
- **Foreground / headline color**: warm cream `#F5F1E8` — NOT pure white `#FFFFFF` (that migrates onto action-bold sister T-535 territory), NOT cool white `#E5E7EB` (that migrates onto modern-tech-product register). The warm-cream shade IS the movie-trailer-canonical typographic color — Christopher Nolan / Denis Villeneuve / A24 trailers habitually use a warm-cream rather than pure-white for the cinematic-film-warmth register.
- **Accent color**: burgundy `#7F1D1D` — Tailwind's `red-900`, the canonical movie-trailer accent shade for the tagline / studio-credit / release-date copy. NOT bright red `#DC2626` (that migrates onto action-bold sister T-535 territory), NOT crimson `#991B1B` (that migrates onto corporate-finance brand-red territory). The deep-burgundy shade IS the movie-trailer-accent canonical register.
- **Layout**: centered title within the widescreen active region — `position: { x: 640, y: 360, width: 1024, alignment: 'center' }` at 1280×720 (canvas-coordinate center; visually centered within the letterboxed 1280×544 active region because the top + bottom letterbox bars are symmetric).
- **Style bundle**: `'plate-and-credits'` — headline plate + UPPERCASE wide-tracked burgundy tagline beneath.
- **Shots**: two-shot sequence — `titlePlate` (startMs 500, endMs 8200) renders the warm-cream heavy-display-serif headline against the letterboxed canvas; `creditsBlock` (startMs 1500, endMs 8800) renders the UPPERCASE wide-tracked burgundy tagline beneath the headline. Note the 500 ms held-black entrance — both shots start at startMs ≥ 500, leaving the first 500 ms of the composition as pure-black-no-content (the held-black entrance IS the movie-trailer-canonical lead-in beat).

## Typography

- **`preferredFont: GT Sectra`** (proprietary-byo) — Grilli Type's editorial-display transitional / didone hybrid serif at the heaviest cut. The transitional / didone hybrid construction with sharp wedge-serif terminals and very-high-contrast modulation IS the movie-trailer-canonical headline register at the largest scale.
- **`fallbackFont: Cormorant Garamond 800`** (`ofl`) — weight 800 (between the T-520 prestige-creator / T-535 noir-cinema weight 700 and the T-535 action-bold weight 900). The slightly-lighter-than-action-bold weight reads as cinematic-warmth rather than action-impact at the trailer-cinematic register.
- **Headline (`titlePlate.content.text`)**: Mixed Case at the snapshot string level (`'Echoes of the Sea'` — trailer-canonical reference acceptable as test copy). Rendered at `font: { family, weight: 800, size: 84, letterSpacing: -0.015 }` — LARGEST headline of the five T-535 templates (84 px vs 80 px action-bold / 64 px noir-cinema / 58 px sci-fi-glow / 56 px doc-minimal). The very-large heavy-display headline IS the movie-trailer-canonical signature at scale; production trailer-openers on 4K canvas push to 120-160 px headline range.
- **Tagline (`creditsBlock.content.lines[0]`)**: UPPERCASE applied at the snapshot string level (`'IN THEATERS THIS DECEMBER'`). Rendered at fontSize 24 px / fontWeight 500 / letterSpacing 0.16em / burgundy `#7F1D1D` color. The burgundy-tagline-beneath-cream-headline register IS the movie-trailer-canonical chromatic split.
- **Casing transform**: `'as-is'` (default). Mixed-Case headline + UPPERCASE tagline split via snapshot strings.
- **No italic, no underline, no strikethrough.**

## Composition structure

- **Letterbox bars** are composited via the `overlays?` ClipKindBinding extension (T-348): the trailer-cinematic preset declares `overlays: [{ kind: 'letterboxBars', aspectRatio: '2.35:1', color: '#000000' }]` so the binding-wire step composes the letterbox companion clip at `zIndex: 1` (titleSequence at `zIndex: 0`). Note that the letterbox bars are pure-black on the pure-black canvas, so the bars are technically invisible at the pixel level — they materially constrain the active widescreen region for the layout step but do not produce a visible pixel difference. The overlay declaration is preserved for semantic correctness (downstream renderers may switch the letterbox color to a different shade for stylistic variations) AND so the canvas-aspect-ratio-constraint metadata is properly threaded through the binding pipeline for future canvas-scale processing (e.g. 4K-canvas rendering where the letterbox bars become a render-time aspect-ratio enforcement rather than a static black-on-black overlay).
- **Two-shot overlap window**: at the reference frame (frame 150 = 5000 ms @ 30 fps), both shots are active. Headline plate (startMs 500, endMs 8200) is in mid-hold; credits-block tagline (startMs 1500, endMs 8800) is also in mid-hold.

## Animation

- **SLOWEST pacing of the five T-535 templates** — movie-trailer breathing at ~9 s total cycle including the held-black entrance:
  - Held-black 500 ms — the first 500 ms of the composition is pure-black-no-content (both shots have `startMs ≥ 500`). The held-black entrance IS the movie-trailer-canonical lead-in beat — building dramatic tension before the title reveal.
  - Fade-in 1500 ms EASE_OUT_QUART (slowest entrance of the five — twice as slow as the T-535 noir-cinema 1200 ms, ~2× the T-520 prestige-creator 800 ms)
  - Mid-hold ~6000 ms
  - Fade-out 1200 ms EASE_IN_QUART (slowest exit of the five)
  - Total per title-card cycle: ~9.2 s — SLOWEST of the five (T-535 noir-cinema at ~7.2 s is second-slowest)
- **Reference frame for parity is mid-segment (frame 150 = 5000 ms @ 30 fps)** — pulled later than the cluster-D canonical frame 120 because the trailer-cinematic cycle is much longer; frame 150 falls cleanly in the mid mid-hold window.
- **No state-transition animation in v1.** The trailer-cinematic register is the clean steady-state register; the slow fade-in / fade-out envelopes the mid-hold but does not animate within it. The movie-trailer breathing posture IS the lack of mid-hold motion.

## Rules

- **Bound primitive**: `titleSequence`. Cross-cluster register reuse (cluster-I preset binding cluster-D primitive — same Pattern C as the four sister T-535 templates).
- **Movie-trailer canon (Christopher Nolan / Denis Villeneuve / Paul Thomas Anderson / A24 trailer-opener register).** The register is movie-trailer-cinematic, NOT noir-cinema (sister), NOT sci-fi (sister), NOT action-bold (sister), NOT doc-minimal (sister), NOT prestige-TV (cluster-D), NOT editorial-magazine (T-520 prestige-creator). Choose trailer-cinematic for the letterboxed widescreen heavy-serif movie-trailer opener register specifically.
- **Letterboxed 2.35:1 widescreen, NOT full-frame.** Removing the letterbox bars migrates the visual off the movie-trailer register entirely — the widescreen-cinematic aspect-ratio constraint IS the trailer-cinematic-canonical signature. The four sister T-535 templates are all full-frame (no letterbox); the trailer-cinematic register is the only T-535 template that constrains the active region to widescreen.
- **Warm cream + burgundy, NOT white-on-black or black-on-white.** Using pure-white headline migrates onto the action-bold sister T-535 register; using bright-red tagline migrates onto action-bold; using all-black-or-all-white migrates onto doc-minimal. The cream + burgundy chromatic split IS the trailer-cinematic-canonical color register.
- **Slowest pacing of the five (~9 s total, including a 500 ms held-black entrance).** Speeding the pacing migrates onto sister T-535 register territory. The slow movie-trailer breathing pace IS the trailer-cinematic signature.
- **Heavy display serif weight 800 + size 84 px.** Largest + heaviest of the five T-535 templates (action-bold is heavier at weight 900 but smaller at 80 px; trailer-cinematic is slightly lighter than action-bold but ~5% larger). The very-large heavy-display register IS the movie-trailer-canonical scale at 1280×720.
- **Reference frame at frame 150, NOT 120.** The trailer-cinematic cycle is long (~9 s); frame 150 = 5000 ms falls cleanly in mid mid-hold.

## Acceptance (parity)

One reference-frame fixture at `frame: 150` (mid-segment steady-state):

- `golden-frame-150.png` — the canonical trailer-cinematic rendered as a centered letterboxed widescreen title card on the pure-black `#000000` canvas with 2.35:1 letterbox bars at top + bottom (92px height each, pure-black on pure-black — invisible at pixel level but constraining the active region); warm cream `#F5F1E8` headline `'Echoes of the Sea'` rendered at 84 px / fontWeight 800 / Cormorant Garamond OFL fallback / Mixed Case / letterSpacing -0.015 at canvas center; UPPERCASE wide-tracked burgundy `#7F1D1D` tagline `'IN THEATERS THIS DECEMBER'` rendered at 24 px / fontWeight 500 / letterSpacing 0.16em beneath the headline; both shots at full opacity (`opacity: 1`) at the steady-state mid-hold.

Thresholds: **PSNR ≥ 42 dB**, **SSIM ≥ 0.98** (cross-cluster norm — the letterboxed widescreen register without atmospheric overlays accepts the standard thresholds; the letterbox bars are pure-black-on-pure-black and do not introduce per-pixel high-frequency texture that would require looser thresholds). Hand-pinned via `--psnr=42 --ssim=0.98 --mark-signed`.

## Trade-offs

- **Rendered family is `Cormorant Garamond 800` (OFL fallback), not bespoke `GT Sectra`.** Production deployments BYO-wire GT Sectra at deploy time.
- **Letterbox bars are pure-black on pure-black, invisible at pixel level.** The overlay declaration is preserved for semantic correctness (downstream renderers may switch the letterbox color to a different shade) AND so the canvas-aspect-ratio constraint metadata is threaded through the binding pipeline for future processing. Reviewer scrutiny: at the parity-fixture register the letterbox bars produce zero pixel-difference vs no-bars; the structural-extension (§13) verification step relies on the overlay's `kind: 'letterboxBars'` metadata being correctly threaded into the RIRDocument, not on a visible pixel-level effect. Sign-off + PO visual inspection verifies the active-region constraint at rendered scale.
- **Held-black 500 ms entrance is composition-driven via per-shot `startMs ≥ 500`, NOT a primitive-level animation prop.** The shots themselves don't render until 500 ms in; before that, the canvas displays the pure-black `#000000` background only. This is the canonical movie-trailer lead-in beat — building dramatic tension via deliberate emptiness before the reveal.
- **Headline copy `'Echoes of the Sea'` is trailer-canonical reference copy acceptable as test copy.** Production deployments substitute via the binding override. Tagline copy `'IN THEATERS THIS DECEMBER'` is the canonical movie-trailer release-window format.
- **Reference frame at frame 150, NOT 120.** The trailer-cinematic cycle is long; frame 150 = 5000 ms falls cleanly in mid mid-hold. Pulling the reference earlier would catch the slow fade-in envelope; pulling later would catch the slow fade-out envelope.
- **No film-grain atmospheric overlay** (unlike T-535 noir-cinema). The trailer-cinematic register is a modern-movie-trailer register, NOT a mid-century-noir register — modern movie trailers (Nolan / Villeneuve / A24) typically use clean digital typography without film-grain overlays; the grain register migrates onto the noir-cinema or onto cluster-D prestige-TV territory entirely.

## Out of scope

- Bespoke `GT Sectra` proprietary-byo wiring — production-fidelity preference, BYO-license-gated at deploy time.
- Per-letter staggered entry choreography (`'letterform-assemble'` style bundle) — primitive-level style-bundle selection; the trailer-cinematic register uses `'plate-and-credits'`.
- Film-grain or atmospheric overlay registers — migrate onto sister T-535 templates (noir-cinema / sci-fi-glow) or onto cluster-D prestige-TV territory.
- Production canvas scaling to 4K (1280×720 → 3840×2160) — handled at the renderer-host level via canvas-resolution overrides; the preset ships at 1280×720 parity-fixture resolution.
- Audio-bed compositing (trailer-opener music sweep) — wedding-events T-530 pack ships audio-bed compositing patterns; the frontier-fx pack scope is video-render-only.

## References

- Christopher Nolan trailer-opener canon (Inception 2010, Interstellar 2014, Dunkirk 2017, Tenet 2020, Oppenheimer 2023) — heavy-serif cinematic title register
- Denis Villeneuve trailer-opener canon (Arrival 2016, Blade Runner 2049 2017, Dune 2021/2024) — cinematic-warmth title register
- Paul Thomas Anderson trailer-opener canon (There Will Be Blood 2007, The Master 2012, Phantom Thread 2017, Licorice Pizza 2021) — editorial-cinematic title register
- A24 distribution trailer canon (multi-film, 2013-present) — warm-cream cinematic typography
- ADR-004 / ADR-005
- T-321 — `titleSequence` runtime-clip primitive
- T-348 — `overlays?` ClipKindBinding structural extension (used for letterbox-bars compose)
- T-520 — prestige-creator (sister titleSequence preset; editorial-magazine register at full-frame layout)
- T-531 — Frontier Effects pack skeleton
- T-535 — Premium TitleSequence templates (this PR; **closes the Frontier Effects pack v0.2.0 AND closes P16 γ entirely** — last of 30 P16 γ tasks T-506..T-535)

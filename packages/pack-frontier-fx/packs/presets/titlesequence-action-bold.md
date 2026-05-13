---
id: titlesequence-action-bold
cluster: cluster-i
clipKind: titleSequence
source: Action / sports-highlight title-card canon — Top Gun Maverick / John Wick / Fast & Furious / NFL Films / ESPN 30-for-30 opening register (public references; no entry in docs/compass_artifact.md)
status: substantive
preferredFont:
  family: GT Sectra
  license: proprietary-byo
fallbackFont:
  family: Cormorant Garamond
  weight: 900
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
ownerTask: T-535
relatedTasks:
  - T-535
---

# Action Bold — high-contrast slab impact title card

Third of five premium TitleSequence templates in the Frontier Effects Pack v0.2.0. The action-bold register is the fastest + most aggressive of the five — slam-in / slam-out pacing, high-contrast red slabs, impact-serif extra-bold typography, sports-highlight / action-cinema canon. Distinct from the four sister templates by genre (action / sports highlights, not noir / sci-fi / doc / trailer), palette (black + red + white, not gold/cyan/cream/B&W), pacing (fastest; ~3.7 s total cycle), and typographic weight (extra-bold 900, not 700).

## Visual signature

Cinematic full-frame title card in the action-bold register characterized by high-contrast black canvas with red `#DC2626` slab accents, impact-serif extra-bold white headline, tight letterspacing, and slam-in / shake / slam-out pacing.

- **Background**: pure black `#000000` — the action-bold register pushes pure black (NOT the raised `#0A0A0A` of the noir-cinema register, NOT the deep blue `#0F172A` of sci-fi-glow). Action-cinema title cards habitually use pure black for maximum red-on-black contrast — Top Gun Maverick's title canon, John Wick's chapter-card register, the NFL Films opener canon.
- **Foreground / headline color**: white `#FFFFFF` — maximum-contrast white headline on the pure-black canvas. NOT cream `#F5F1E8` (that migrates onto T-535 trailer-cinematic register), NOT gold `#D4AF37` (that migrates onto T-535 noir-cinema register). Pure white IS the action-bold canon.
- **Accent color**: red `#DC2626` — Tailwind's `red-600`, the canonical action / urgent / breaking-news red shade. The red appears as: (1) a horizontal slab bar above and below the headline at 8px height × full-width, framing the headline plate visually; (2) the tagline color (the UPPERCASE wide-tracked tagline beneath the headline renders in red `#DC2626`, NOT white). The red-slab framing IS the action-bold typographic signature.
- **Layout**: centered full-frame title — `position: { x: 640, y: 360, width: 1024, alignment: 'center' }` at 1280×720.
- **Style bundle**: `'plate-and-credits'` — headline plate + UPPERCASE wide-tracked red tagline beneath.
- **Shots**: two-shot sequence — `titlePlate` (startMs 0, endMs 3400) renders the white extra-bold headline with red `#DC2626` slab bars 8px above and 8px below at full-frame width; `creditsBlock` (startMs 300, endMs 3700) renders the UPPERCASE wide-tracked red tagline beneath the headline (and beneath the lower red-slab bar).

## Typography

- **`preferredFont: GT Sectra`** (proprietary-byo) — extra-bold weight 900 (NOT 700) for the action-bold register. The high-contrast modulation + extra-bold construction IS the action / sports-highlight register at scale.
- **`fallbackFont: Cormorant Garamond 900`** (`ofl`) — extra-bold weight 900 for the action-bold register (T-520 prestige-creator / T-535 noir-cinema use weight 700 for the editorial register; action-bold pushes the extra-bold cut to weight 900).
- **Headline (`titlePlate.content.text`)**: UPPERCASE at the snapshot string level (`'BREAKING POINT'` — action-canon reference acceptable as test copy). Rendered at `font: { family, weight: 900, size: 80, letterSpacing: -0.02 }` — largest headline of the five T-535 templates (80 px vs 58-72 px for the others) AND tightest letterspacing (`-0.02`, vs `-0.005` to `0.20` for the others). The large-extra-bold-tight register IS the action-bold typographic signature. Setting headline to Mixed Case migrates onto the editorial-magazine register (T-520 prestige-creator) entirely.
- **Tagline (`creditsBlock.content.lines[0]`)**: UPPERCASE applied at the snapshot string level (`'A HIGH-IMPACT ACTION SERIES'`). Rendered at fontSize 20 px (smallest tagline of the five templates) / fontWeight 700 / letterSpacing 0.12em / red `#DC2626` color.
- **Casing transform**: `'uppercase'` — UNLIKE the four sister T-535 templates (which all use `'as-is'` with Mixed Case headline + UPPERCASE tagline), the action-bold register sets `casing: 'uppercase'` at the primitive level so both shots render UPPERCASE. The UPPERCASE-everywhere register IS the action-bold canon (NFL Films opening titles habitually run all-caps headline + all-caps subtitle for the maximum-impact register).
- **No italic, no underline, no strikethrough.**

## Composition structure

- **Red slab bars** are render-time decorations on the headline plate — the binding-wire step pins `decorations: { slabBars: { color: '#DC2626', heightPx: 8, marginPx: 18, position: 'above-and-below' } }` so the `'plate-and-credits'` style branch renders the slab bars at render time.
- **Shake-on-entrance** is a v1 animation register handled at the entrance animation level (`entrance: 'shake'`) — the headline plate enters via a slam-in motion with a 6-frame horizontal shake oscillation (±4px horizontal jitter over 6 frames, easing to rest at frame 7+). The shake-on-entrance register IS the action-bold animation signature.
- **No companion overlays.** UNLIKE the noir-cinema (film grain) and sci-fi-glow (scanlines) sister T-535 templates, the action-bold register does NOT declare an `overlays?` array — the clean high-contrast canvas IS the register; adding atmospheric overlays would dilute the punchy action-bold posture. Distinct visual posture from the atmospheric-heavy sister templates.

## Animation

- **FASTEST pacing of the five T-535 templates** — slam-in / mid-hold / slam-out at ~3.7 s total cycle:
  - Slam-in 400 ms with 6-frame horizontal shake (entrance variant `'shake'`) — the headline crashes onto the canvas at full opacity in 400 ms, then jitters horizontally ±4px over the next 6 frames, easing to rest at frame 7+
  - Mid-hold ~3000 ms
  - Slam-out 300 ms EASE_IN_QUART (no shake on exit; clean slide-down + fade)
  - Total per title-card cycle: ~3.7 s — FASTEST of the five (sci-fi-glow is second-fastest at ~5.1 s)
- **Reference frame for parity is mid-segment (frame 60 = 2000 ms @ 30 fps)** — pulled earlier than the cluster-D canonical frame 120 because the action-bold cycle is much shorter; frame 60 falls cleanly in the mid mid-hold window where the shake has settled and both shots are at full opacity at their final positions.
- **No state-transition animation in the mid-hold.** The action-bold register's animation IS the slam-in entrance + slam-out exit; the mid-hold is steady-state at full opacity.

## Rules

- **Bound primitive**: `titleSequence`. Cross-cluster register reuse (cluster-I preset binding cluster-D primitive — same Pattern C as the four sister T-535 templates).
- **Action / sports-highlight canon (Top Gun Maverick / John Wick / Fast & Furious / NFL Films / ESPN 30-for-30).** The register is action-cinema / sports-highlight, NOT noir-cinema (sister), NOT sci-fi (sister), NOT doc-minimal (sister), NOT trailer-cinematic (sister), NOT prestige-TV (cluster-D), NOT editorial-magazine (T-520). Choose action-bold for the punchy red-on-black slam-in opener register specifically.
- **Black + red + white slab framing — NOT clean-no-slab or grain-overlaid.** Removing the red slab bars migrates the visual onto T-520 prestige-creator's editorial-magazine register (white-on-black clean canon); adding atmospheric overlays migrates onto the noir-cinema or sci-fi-glow sister T-535 registers.
- **Extra-bold weight 900 + tight letterSpacing `-0.02` + UPPERCASE casing.** All three are required for the action-bold register. Dropping weight to 700 migrates onto the editorial-magazine / noir-cinema register territory; opening letterSpacing to `0.02` migrates onto sci-fi-glow territory; using Mixed Case migrates onto T-520 prestige-creator.
- **Fastest pacing of the five (~3.7 s total).** Slowing the pacing to 800 / 5 s / 600 ms (T-520 prestige-creator) or 1200 / 5 s / 1000 ms (T-535 noir-cinema) migrates the visual onto the contemplative editorial-prestige / noir-cinema register territory entirely.
- **Reference frame at frame 60, NOT 120.** The action-bold cycle is short (3.7 s total); frame 60 = 2000 ms falls cleanly in mid mid-hold.

## Acceptance (parity)

One reference-frame fixture at `frame: 60` (mid-segment steady-state):

- `golden-frame-60.png` — the canonical action-bold rendered as a centered full-frame title card on the pure-black `#000000` canvas; white `#FFFFFF` headline `'BREAKING POINT'` rendered at 80 px / fontWeight 900 / Cormorant Garamond OFL fallback / UPPERCASE / letterSpacing -0.02 at canvas center; red `#DC2626` horizontal slab bars at 8px height × full-frame width framed 18px above and below the headline plate; UPPERCASE wide-tracked red `#DC2626` tagline `'A HIGH-IMPACT ACTION SERIES'` rendered at 20 px / fontWeight 700 / letterSpacing 0.12em beneath the lower red-slab bar; both shots at full opacity (`opacity: 1`) at the steady-state mid-hold; no atmospheric overlays.

Thresholds: **PSNR ≥ 42 dB**, **SSIM ≥ 0.98** (cross-cluster norm — the clean register without atmospheric overlays accepts the standard thresholds). Hand-pinned via `--psnr=42 --ssim=0.98 --mark-signed`.

## Trade-offs

- **Rendered family is `Cormorant Garamond 900` (OFL fallback), not bespoke `GT Sectra`.** Production deployments BYO-wire GT Sectra at deploy time. Cormorant Garamond does ship a weight-900 cut in its OFL release per the SIL OFL Google Fonts catalogue.
- **Red slab bars are render-time decorations, NOT a separate clip.** The slab register is light enough to render in the same pass as the title text. Reviewer scrutiny: if the slab register grows beyond simple horizontal bars (e.g. animated diagonal slashes, gradient fills, slab-with-text-emboss), promote to a separate `slabBars` companion clip via the `overlays?` extension.
- **Shake-on-entrance is an entrance-variant prop, NOT a separate animation track.** The `titleSequence` primitive accepts entrance variant `'shake'` per the post-T-321 extension; the binding-wire step pins `entrance: 'shake'` + `shakeConfig: { axisX: true, amplitudePx: 4, durationFrames: 6 }` for the action-bold register specifically. At the reference frame (frame 60) the shake has fully settled, so the parity-fixture render captures the steady-state mid-hold without the shake artifact.
- **Headline copy `'BREAKING POINT'` is action-canon reference copy acceptable as test copy.** Production deployments substitute via the binding override.
- **Reference frame at frame 60, NOT 120.** The action-bold cycle is short; frame 60 = 2000 ms falls cleanly in mid mid-hold. Pulling the reference earlier would catch the shake-settle window; pulling later would catch the slam-out exit envelope.
- **No companion overlays.** The action-bold register intentionally OMITS atmospheric overlays — distinct from the noir-cinema (film grain) and sci-fi-glow (scanlines) sister T-535 templates. The clean high-contrast canvas IS the register.

## References

- Top Gun: Maverick (2022, Joseph Kosinski) — action-cinema title canon
- John Wick (2014-2023, Chad Stahelski) — chapter-card slam-in register
- Fast & Furious franchise (2001-2023) — sports-action title posture
- NFL Films opening-titles canon (multi-decade) — red-on-black slab framing
- ESPN 30-for-30 documentary opener — high-contrast slam-in register
- ADR-004 / ADR-005
- T-321 — `titleSequence` runtime-clip primitive
- T-520 — prestige-creator (sister titleSequence preset; editorial-magazine register at opposite pacing extreme)
- T-531 — Frontier Effects pack skeleton
- T-535 — Premium TitleSequence templates (this PR; closes the Frontier Effects pack v0.2.0)

---
id: titlesequence-doc-minimal
cluster: cluster-i
clipKind: titleSequence
source: Documentary / interview cold-open title-card canon — PBS Frontline / CBS 60 Minutes / Errol Morris documentary opener register (public references; no entry in docs/compass_artifact.md)
status: substantive
preferredFont:
  family: Inter
  weight: 300
  license: ofl
fallbackFont:
  family: Inter
  weight: 300
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
ownerTask: T-535
relatedTasks:
  - T-535
---

# Doc Minimal — pure-typography documentary cold-open

Fourth of five premium TitleSequence templates in the Frontier Effects Pack v0.2.0. The doc-minimal register is the inverted-canvas + lightest-weight typography of the five — pure black-on-white typography only, NO decoration, NO atmospheric overlays, NO color accents — the PBS Frontline / CBS 60 Minutes / Errol Morris interview-documentary cold-open canon. Distinct from the four sister templates by inversion (white canvas, not black/blue/cream), typographic weight (Light 300, not Bold 700-900), and the explicit absence of every decoration / overlay / accent token.

## Visual signature

Cinematic full-frame title card in the documentary-humility register — pure black-on-white typography with no decoration, no overlays, no accent colors. The minimalism IS the register: PBS Frontline's "A FRONTLINE INVESTIGATION" cold-open; CBS 60 Minutes's chapter-card register; Errol Morris's documentary-opener canon ("The Thin Blue Line", "The Fog of War", "Standard Operating Procedure"). The doc-minimal register reads as journalistic / academic / non-fiction — distinguished from the four sister T-535 templates by its inverted palette + reduced typographic weight + absence of every decorative element.

- **Background**: pure white `#FFFFFF` — INVERTED from the four sister T-535 templates (noir-cinema deep-black `#0A0A0A`, sci-fi-glow deep-blue `#0F172A`, action-bold pure-black `#000000`, trailer-cinematic pure-black with letterbox). The white canvas IS the doc-minimal-canonical register; documentary cold-opens habitually use white canvas to read as journalistic-humility (PBS Frontline's documented brand register), NOT cinematic-prestige.
- **Foreground / headline color**: pure black `#000000` — maximum-contrast black headline on the pure-white canvas. NOT charcoal `#374151` (that migrates onto modern-corporate-clean register territory — cluster-finance), NOT slate `#1E293B` (that migrates onto editorial-corporate territory).
- **Accent color**: NONE. The doc-minimal register intentionally has NO accent color. UNLIKE the four sister T-535 templates (which all push a distinct accent — gold / cyan / red / cream-with-burgundy), the doc-minimal register reads as documentary-humility precisely BECAUSE it omits accent color. Adding any non-greyscale accent migrates the visual off the register entirely.
- **No atmospheric overlays.** No grain (noir-cinema territory), no scanlines (sci-fi-glow territory), no slab bars (action-bold territory), no letterbox (trailer-cinematic territory). The clean white canvas IS the register.
- **Layout**: centered full-frame title — `position: { x: 640, y: 360, width: 1024, alignment: 'center' }` at 1280×720.
- **Style bundle**: `'plate-and-credits'` — headline plate + UPPERCASE wide-tracked tagline beneath.
- **Shots**: two-shot sequence — `titlePlate` (startMs 0, endMs 5400) renders the black Light-weight headline against the white canvas; `creditsBlock` (startMs 800, endMs 5800) renders the UPPERCASE wide-tracked tagline beneath the headline (also at black `#000000`, NOT at an accent color).

## Typography

- **`preferredFont: Inter 300`** (`ofl` — SIL Open Font License 1.1 via Google Fonts). Inter at weight 300 (Light) IS the documentary-humility typography canon — the lightest weight of the Inter cut, used across modern documentary-website chrome (PBS Frontline web register, ProPublica investigative-journalism register, The Marshall Project article-headline register). UNLIKE the four sister T-535 templates (which all push GT Sectra serif at weight 700-900), the doc-minimal register intentionally uses a Light-weight sans-serif — the visual humility IS the register.
- **`fallbackFont: Inter 300`** — same family acts as both preferred + fallback (OFL license, no BYO-wire step needed). The doc-minimal register is one of two T-535 templates that does NOT require a proprietary-BYO production preferred font (sci-fi-glow being the other).
- **Headline (`titlePlate.content.text`)**: Mixed Case at the snapshot string level (`'The Documentary'` — doc-canonical reference acceptable as test copy). Rendered at `font: { family: 'Inter', weight: 300, size: 56, letterSpacing: -0.005 }` — weight 300 (Light) is the documentary-humility weight; all four sister T-535 templates ship weight 700-900. Headline size 56 px is mid-editorial register; slightly smaller than the editorial-prestige register (T-520 prestige-creator at 60 px, T-535 noir-cinema at 64 px) for the documentary-restraint posture.
- **Tagline (`creditsBlock.content.lines[0]`)**: UPPERCASE applied at the snapshot string level (`'A FRONTLINE INVESTIGATION'`). Rendered at fontSize 18 px / fontWeight 400 (Regular, slightly heavier than the headline's Light to anchor the tagline visually) / letterSpacing 0.14em / black `#000000` color.
- **Casing transform**: `'as-is'` (default). Mixed-Case headline + UPPERCASE tagline split via snapshot strings.
- **No italic, no underline, no strikethrough.** Documentary typography never uses them in title-card slots.

## Composition structure

- **No render-time decorations.** The doc-minimal register has NO slab bars, NO dividers, NO chromatic-aberration, NO frame elements. The clean typography IS the register; adding any decoration migrates the visual onto a sister T-535 register.
- **No companion overlays.** The doc-minimal preset does NOT declare an `overlays?` array — UNLIKE the noir-cinema (film grain), sci-fi-glow (scanlines), and trailer-cinematic (letterbox bars) sister T-535 templates. The clean canvas IS the register.
- **Two-shot overlap window**: at the reference frame (frame 120 = 4000 ms @ 30 fps), both shots are active. Headline plate (startMs 0, endMs 5400) is in mid-hold; credits-block tagline (startMs 800, endMs 5800) is also in mid-hold.

## Animation

- **Restrained documentary pacing** — gentle fade-in / mid-hold / fade-out:
  - Fade-in 800 ms EASE_OUT_QUART (same speed as T-520 prestige-creator, but distinct register via canvas inversion + typographic weight)
  - Mid-hold ~4000 ms
  - Fade-out 600 ms EASE_IN_QUART (same speed as T-520 prestige-creator)
  - Total per title-card cycle: ~5.4 s — third-fastest of the five (action-bold ~3.7 s and sci-fi-glow ~5.1 s are faster; noir-cinema ~7.2 s and trailer-cinematic ~9 s are slower)
- **Reference frame for parity is mid-segment (frame 120 = 4000 ms @ 30 fps)** — same canonical frame as cluster-D titleSequence cluster-norm + T-520 prestige-creator.
- **No state-transition animation in v1.** The doc-minimal register is the clean steady-state register; the gentle fade-in / fade-out envelopes the mid-hold but does not animate within it. The documentary-restraint posture IS the lack of mid-hold motion.

## Rules

- **Bound primitive**: `titleSequence`. Cross-cluster register reuse (cluster-I preset binding cluster-D primitive — same Pattern C as the four sister T-535 templates).
- **Documentary / interview cold-open canon (PBS Frontline / CBS 60 Minutes / Errol Morris documentaries).** The register is documentary-journalistic-humility, NOT noir-cinema (sister), NOT sci-fi (sister), NOT action-bold (sister), NOT trailer-cinematic (sister), NOT prestige-TV (cluster-D), NOT editorial-magazine (T-520 prestige-creator). Choose doc-minimal for the journalistic / academic / non-fiction cold-open register specifically.
- **White canvas, NOT black/blue/dark.** Inverting to a dark canvas migrates the visual onto the editorial-magazine register (T-520 prestige-creator) or onto a sister T-535 register entirely. The white-canvas inversion IS the doc-minimal signature.
- **Inter Light 300, NOT bold-serif.** Using a bold serif headline (GT Sectra / Cormorant Garamond 700-900) migrates onto the editorial-magazine / noir-cinema / action-bold / trailer-cinematic register territory. The Light-weight sans-serif IS the documentary-humility register.
- **NO accent color. NO decoration. NO overlays.** Adding ANY of these migrates the visual off the register. The doc-minimal register is canonically the MINUS register relative to the four sister T-535 templates — what every sister template adds in atmospherics + decoration + accent, doc-minimal omits. The minimalism IS the register.
- **Reference frame at frame 120** (cluster-D titleSequence cluster-norm).

## Acceptance (parity)

One reference-frame fixture at `frame: 120` (mid-segment steady-state):

- `golden-frame-120.png` — the canonical doc-minimal rendered as a centered full-frame title card on the pure-white `#FFFFFF` canvas; black `#000000` headline `'The Documentary'` rendered at 56 px / fontWeight 300 / Inter / Mixed Case / letterSpacing -0.005 at canvas center; UPPERCASE wide-tracked black `#000000` tagline `'A FRONTLINE INVESTIGATION'` rendered at 18 px / fontWeight 400 / letterSpacing 0.14em beneath the headline; both shots at full opacity (`opacity: 1`) at the steady-state mid-hold; NO decorations, NO atmospheric overlays, NO accent colors.

Thresholds: **PSNR ≥ 42 dB**, **SSIM ≥ 0.98** (cross-cluster norm — the clean register without atmospheric overlays accepts the standard thresholds; the doc-minimal register is actually the cleanest of the five T-535 templates and would tolerate even stricter thresholds, but the cross-cluster norm is sufficient). Hand-pinned via `--psnr=42 --ssim=0.98 --mark-signed`.

## Trade-offs

- **Inter Light 300 is OFL — no BYO-wire step needed.** UNLIKE three of the four sister T-535 templates (which push GT Sectra proprietary-byo with Cormorant Garamond OFL fallback), the doc-minimal register uses Inter Light 300 as both preferred + fallback because the documentary-humility register reads at its production-fidelity peak in the OFL canon — there is no premium-typography upgrade path that materially improves the documentary register over Inter Light. Inter is the production-fidelity preference for the doc-minimal register.
- **Pure white canvas reads as journalistic, not corporate.** Reviewer scrutiny on the white-canvas register: corporate / finance / earnings-call registers (cluster-finance T-522 / T-523) also use white-canvas typography but at heavier typographic weights (Inter SemiBold 600 / Inter Bold 700) and with a corporate-blue or finance-green accent color. The doc-minimal register's Light 300 + no accent reads as journalistic-humility; if a deployment substitutes corporate copy + accent color, the visual register migrates onto cluster-finance territory.
- **No tagline accent color.** UNLIKE the four sister T-535 templates (where the tagline picks up the accent color — gold / desaturated-cyan / red / cream), the doc-minimal tagline stays at black `#000000`. The single-color typography IS the documentary-humility register.
- **Headline weight 300 (Light), NOT 700.** This is the documentary-humility weight — heavier weights migrate onto editorial-prestige / corporate-clean / action-bold territory. Reviewer scrutiny: Inter at Light 300 has noticeably thinner strokes than Regular 400, but the documentary-humility register IS the thin-stroke register; the documentary canon (PBS Frontline / CBS 60 Minutes / Errol Morris) all push thin-stroke typography for the journalistic posture.
- **Headline copy `'The Documentary'` is doc-canonical reference copy acceptable as test copy.** Production deployments substitute via the binding override. Tagline copy `'A FRONTLINE INVESTIGATION'` is the PBS Frontline canonical UPPERCASE wide-tracked sub-headline format.

## References

- PBS Frontline (long-running investigative documentary series, 1983-present) — interview cold-open title-card canon
- CBS 60 Minutes (long-running newsmagazine, 1968-present) — chapter-card title register
- Errol Morris documentary canon ("The Thin Blue Line" 1988, "The Fog of War" 2003, "Standard Operating Procedure" 2008) — documentary-opener register
- ProPublica investigative-journalism web register — modern documentary-style typography
- The Marshall Project article-headline register — modern non-fiction typography
- ADR-004 / ADR-005
- T-321 — `titleSequence` runtime-clip primitive
- T-520 — prestige-creator (sister titleSequence preset; editorial-magazine register at opposite typographic-weight extreme)
- T-531 — Frontier Effects pack skeleton
- T-535 — Premium TitleSequence templates (this PR; closes the Frontier Effects pack v0.2.0)

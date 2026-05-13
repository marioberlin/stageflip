---
id: titlesequence-scifi-glow
cluster: cluster-i
clipKind: titleSequence
source: Sci-fi futurism title-card canon — Tron Legacy / Blade Runner 2049 / The Matrix / Westworld / Devs title-sequence register (public references; no entry in docs/compass_artifact.md)
status: substantive
preferredFont:
  family: Plus Jakarta Sans
  weight: 700
  license: ofl
fallbackFont:
  family: Plus Jakarta Sans
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
ownerTask: T-535
relatedTasks:
  - T-535
---

# Sci-Fi Glow — chromatic-aberration scanline title card

Second of five premium TitleSequence templates in the Frontier Effects Pack v0.2.0. The sci-fi-glow register is the futuristic / cybernetic / cyan-glow opener — Tron Legacy's opening titles, Blade Runner 2049's neon chyron, The Matrix's green-glow opener, Westworld's title-card register, the Devs miniseries credits. Distinct from the four other T-535 templates by genre (sci-fi futurism, not noir / action / doc / trailer), palette (deep blue + cyan glow, not gold/red/cream/white), and atmospheric overlay (CRT scanlines + chromatic aberration, not film grain).

## Visual signature

Cinematic full-frame title card in the sci-fi-futurism register characterized by deep-blue canvas, cyan-glow typography with chromatic-aberration RGB-channel-split shadows, CRT-scanline horizontal-stripe atmospheric overlay, and quick slide-in / slide-out pacing.

- **Background**: deep blue `#0F172A` — Tailwind's `slate-900`, the canonical sci-fi-deep-space hex for cinematic UI registers. NOT pure black `#000000` (that migrates onto T-520 prestige-creator's editorial canon or onto T-535's noir-cinema register), NOT navy `#1E3A8A` (that migrates onto corporate / finance / earnings-call territory — cluster-finance T-522 register).
- **Foreground / headline color**: cyan `#22D3EE` — Tailwind's `cyan-400`. Cyan-glow IS the sci-fi-canon shade — Tron's grid-cyan, Devs's quantum-cyan, Blade Runner 2049's neon-chyron-cyan. NOT pure-pure-cyan `#00FFFF` (that migrates onto retro-vaporwave / synthwave register territory).
- **Chromatic-aberration shadows**: RGB-channel-split offsets — red `#FF0000` channel offset 2px left, blue `#0066FF` channel offset 2px right, green stays at canonical position. This produces the canonical CRT / VHS / lens-aberration register; without it the visual reads as flat-vector-cyan (modern-clean tech-product launch — cluster-finance / corporate territory) rather than sci-fi-futurism.
- **Atmospheric overlay**: horizontal CRT-scanlines — 1px tall semi-transparent black stripes every 4px vertically across the canvas at 30% opacity. The scanline register IS the sci-fi-CRT signature; without it the visual reads as modern flat-vector design.
- **Layout**: centered full-frame title — `position: { x: 640, y: 360, width: 1024, alignment: 'center' }` at 1280×720. The title IS the frame.
- **Style bundle**: `'plate-and-credits'` — headline plate + UPPERCASE wide-tracked tagline beneath.
- **Shots**: two-shot sequence — `titlePlate` (startMs 0, endMs 5100) renders the cyan-glow headline with chromatic-aberration shadows; `creditsBlock` (startMs 600, endMs 5500) renders the UPPERCASE wide-tracked tagline beneath at slightly desaturated cyan `#67E8F9` (Tailwind `cyan-300`) for the sub-headline hierarchy.

## Typography

- **`preferredFont: Plus Jakarta Sans 700`** (`ofl` — SIL Open Font License 1.1 via Google Fonts). The geometric-grotesque construction with low contrast modulation IS the modern sci-fi-futurism register. UNLIKE the four sister T-535 templates (which all push GT Sectra / Cormorant Garamond transitional-serif), the sci-fi-glow register intentionally uses a sans-serif geometric grotesque — sci-fi futurism reads as future-typeface, not editorial-serif. Plus Jakarta Sans matches the geometric-grotesque construction of Eurostile (Tron / 2001: A Space Odyssey canonical) without its commercial-license encumbrance.
- **`fallbackFont: Plus Jakarta Sans 700`** — same family acts as both preferred + fallback (OFL license, no BYO-wire step needed). This is the only T-535 template that does NOT require a proprietary-BYO production preferred font.
- **Headline (`titlePlate.content.text`)**: Mixed Case at the snapshot string level (`'Neon Horizon 2089'` — sci-fi-canonical futurism reference acceptable as test copy). Rendered at `font: { family: 'Plus Jakarta Sans', weight: 700, size: 58, letterSpacing: 0.02 }` — positive letterSpacing (NOT negative) for the sci-fi-grotesque register's open-tracking posture. Headline size 58 px reads as the futurism-canonical mid-large register.
- **Tagline (`creditsBlock.content.lines[0]`)**: UPPERCASE applied at the snapshot string level (`'A SCI-FI FRONTIER'`). Rendered at fontSize 22 px / fontWeight 500 / letterSpacing 0.20em — WIDEST tracking of all five T-535 templates (0.20em vs 0.08-0.12em for the others). The wide-wide tracking IS the sci-fi-CRT-typography canon.
- **No italic, no underline, no strikethrough.**

## Composition structure

- **Chromatic-aberration shadows** are render-time decorations on the titleSequence primitive's text rendering — the binding-wire step pins `decorations: { chromaticAberration: { redOffset: { x: -2, y: 0 }, blueOffset: { x: 2, y: 0 } } }` for the sci-fi-glow register specifically.
- **Scanline overlay** is composited via the `overlays?` ClipKindBinding extension (T-348): the sci-fi-glow preset declares `overlays: [{ kind: 'scanlines', strideY: 4, heightY: 1, opacity: 0.3 }]` so the binding-wire step composes the scanline companion clip at `zIndex: 1` (titleSequence at `zIndex: 0`).
- **Two-shot overlap window**: at the reference frame (frame 90 = 3000 ms @ 30 fps), both shots are active simultaneously. Headline plate is in mid-hold; credits-block tagline is also in mid-hold.

## Animation

- **Quick sci-fi pacing** — fast slide-in with scanline-wipe entrance:
  - Slide-in 600 ms EASE_OUT_QUART with a scanline-wipe entrance variant (`entranceVariant: 'scanline-wipe'`) — the headline reveals via a horizontal scanline that sweeps top-to-bottom across the text envelope, NOT a uniform fade. This is the canonical CRT-power-on signature for sci-fi opener registers.
  - Mid-hold ~4000 ms
  - Slide-out 500 ms EASE_IN_QUART (synchronized slide-out for both shots; the headline slides upward-out, the tagline slides downward-out, creating a split-shutter exit)
  - Total per title-card cycle: ~5.1 s — second-fastest of the five (action-bold is the fastest at ~3.7 s)
- **Reference frame for parity is mid-segment (frame 90)** — pulled earlier than the cluster-D canonical frame 120 because the sci-fi-glow cycle is shorter; frame 90 = 3000 ms falls cleanly in the mid mid-hold window.
- **No state-transition animation in v1** (steady-state at reference frame).

## Rules

- **Bound primitive**: `titleSequence` from `@stageflip/runtimes-frame-runtime-bridge`. Cross-cluster register reuse (cluster-I preset binding cluster-D primitive — same Pattern C as the four sister T-535 templates).
- **Sci-fi futurism canon (Tron Legacy / Blade Runner 2049 / The Matrix / Westworld / Devs).** The register is sci-fi-futurism, NOT noir-cinema (sister T-535 noir-cinema), NOT prestige-TV (cluster-D), NOT editorial-magazine (T-520 prestige-creator). Choose sci-fi-glow for the CRT / cybernetic / quantum-cyan opener register specifically.
- **Deep blue + cyan + chromatic aberration + scanlines — all four atmospheric components are required.** Removing chromatic aberration migrates onto modern flat-vector-cyan (cluster-finance T-525 corporate-tech register); removing scanlines migrates onto modern futurism-clean (Severance miniseries register — cluster-D T-353 territory). The four components together IS the sci-fi-CRT canon.
- **Plus Jakarta Sans grotesque, NOT serif.** Using a serif headline migrates onto editorial-prestige register (T-520 prestige-creator) or onto noir-cinema (sister T-535) territory entirely.
- **Reference frame at frame 90, NOT 120** (the sci-fi-glow cycle is shorter than the cluster-D canonical 120-frame mid-segment; frame 90 = 3000 ms @ 30 fps falls in this preset's mid mid-hold window).

## Acceptance (parity)

One reference-frame fixture at `frame: 90` (mid-segment steady-state):

- `golden-frame-90.png` — the canonical sci-fi-glow rendered as a centered full-frame title card on the deep-blue `#0F172A` canvas; cyan `#22D3EE` headline `'Neon Horizon 2089'` rendered at 58 px / fontWeight 700 / Plus Jakarta Sans / Mixed Case / letterSpacing 0.02; chromatic-aberration RGB-channel-split shadows (red `#FF0000` offset 2px left + blue `#0066FF` offset 2px right); UPPERCASE wide-tracked desaturated-cyan `#67E8F9` tagline `'A SCI-FI FRONTIER'` rendered at 22 px / fontWeight 500 / letterSpacing 0.20em beneath the headline; horizontal scanline overlay at 1px / 4px stride / 30% opacity composited across the canvas; both shots at full opacity (`opacity: 1`) at the steady-state mid-hold.

Thresholds: **PSNR ≥ 38 dB**, **SSIM ≥ 0.97** — slightly looser than the cross-cluster norm because the chromatic-aberration + scanline atmospheric overlays introduce per-pixel high-frequency texture that hand-pinned PSNR thresholds at the 42dB / 0.98 SSIM register would reject as non-deterministic. Hand-pinned via `--psnr=38 --ssim=0.97 --mark-signed`.

## Trade-offs

- **Chromatic-aberration shadows are render-time decorations, NOT a separate clip.** The cluster-D atmospheric-overlay pattern (T-348 stranger-things-benguiat) introduces companion clips via the `overlays?` ClipKindBinding extension; the chromatic-aberration register is light enough to render in the same pass as the title text, so it's pinned as a `decorations` prop on the titleSequence primitive rather than as a separate clip. Reviewer scrutiny: if the chromatic-aberration register grows beyond simple offsets (e.g. multi-channel chromatic-dispersion arcs), promote to a separate `chromaticAberration` companion clip via the `overlays?` extension.
- **Scanline overlay IS a separate clip via `overlays?`.** Scanlines need to render across the entire canvas (not just the text envelope), so the scanline register IS a companion clip composited at `zIndex: 1` per the T-348 structural extension. The binding-wire step composes the titleSequence at `zIndex: 0` + the scanline overlay at `zIndex: 1`.
- **Slightly looser parity thresholds (PSNR ≥ 38 dB, SSIM ≥ 0.97) vs the cross-cluster norm (≥ 42 dB / ≥ 0.98).** Documented above; the atmospheric high-frequency texture is the root cause.
- **Plus Jakarta Sans is OFL — no BYO-wire step needed.** Unlike the four sister T-535 templates (which all push GT Sectra proprietary-byo with Cormorant Garamond OFL fallback), the sci-fi-glow register uses Plus Jakarta Sans as both preferred + fallback because the geometric-grotesque sans-serif construction does not have a meaningful "premium" upgrade path within the OFL canon (Eurostile is the production-fidelity preference but its commercial license is not BYO-friendly for first-party packs).
- **Reference frame at frame 90, NOT 120.** The sci-fi-glow cycle is shorter (5.1 s total) than the cluster-D canonical title-sequence cycle (~6.4 s), so the canonical frame 120 (= 4000 ms @ 30 fps) falls past the credits-block tagline's `endMs` of 5500 ms with insufficient margin. Pulling the reference frame to 90 (= 3000 ms) places it cleanly in the mid mid-hold window where both shots are at full opacity.

## References

- Tron Legacy (2010, Joseph Kosinski) — cyan-grid sci-fi title canon
- Blade Runner 2049 (2017, Denis Villeneuve) — neon-chyron sci-fi opener
- The Matrix (1999, Wachowskis) — green-glow CRT title register
- Westworld (HBO miniseries, 2016) — title-card sci-fi register
- Devs (FX miniseries, 2020, Alex Garland) — quantum-cyan title register
- ADR-004 / ADR-005
- T-321 — `titleSequence` runtime-clip primitive
- T-348 — `overlays?` ClipKindBinding structural extension (used for scanline overlay compose)
- T-520 — prestige-creator (sister titleSequence preset; editorial-magazine register)
- T-531 — Frontier Effects pack skeleton
- T-535 — Premium TitleSequence templates (this PR; closes the Frontier Effects pack v0.2.0)

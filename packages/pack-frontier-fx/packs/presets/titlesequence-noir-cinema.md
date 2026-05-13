---
id: titlesequence-noir-cinema
cluster: cluster-i
clipKind: titleSequence
source: Mid-century noir cinema title-card canon — Chinatown / L.A. Confidential / The Big Sleep / Mulholland Drive opening-card register (public references; no entry in docs/compass_artifact.md)
status: substantive
preferredFont:
  family: GT Sectra
  license: proprietary-byo
fallbackFont:
  family: Cormorant Garamond
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

# Noir Cinema — black-and-gold mid-century title card

First of five premium TitleSequence templates in the Frontier Effects Pack v0.2.0 (closing the pack contributions opened by T-531). The noir-cinema register is the slowest of the five — mid-century film-noir contemplation, deliberate pacing, gold-on-black contrast, film-grain atmospheric texture. Distinct from T-520's `prestige-creator` (editorial-magazine register) by genre (noir cinema, not editorial magazine), palette (black + gold, not pure black + white), pacing (slower; 1200 ms in / 5 s mid-hold / 1000 ms out vs prestige-creator's 800 / 5000 / 600), and atmospheric texture (film grain, not clean).

## Visual signature

Cinematic full-frame title card in the mid-century film-noir register — Chinatown's opening titles, L.A. Confidential's editorial chyron sequence, The Big Sleep's deep-shadow title plate, Mulholland Drive's slow-burn opening — characterized by deep-black canvas, gold-leaf typography, fine film-grain atmospheric overlay, and slow contemplative pacing.

- **Background**: deep black `#0A0A0A` — slightly raised from pure `#000000` for the noir-cinema register, NOT the pure-pure-black `#000000` of T-520 prestige-creator's editorial-magazine canon. The `#0A0A0A` value preserves a slight film-emulsion warmth that pure `#000000` (digital-clean) lacks; mid-century noir was shot on warm-tone film stocks (Eastman / Fuji) with deep but not absolute blacks. The raised-black canvas reads as analog-photographic on rendered output, not digital-vector.
- **Foreground / headline color**: gold `#D4AF37` — the canonical mid-century gold-leaf shade used across noir title-card credits sequences. NOT yellow `#FACC15` (that migrates onto warning-banner / Sky News broadcast register), NOT amber `#F59E0B` (that migrates onto NHL broadcast or coffee-brand-marketing territory). `#D4AF37` is the gold-leaf-typography canonical hex — visible across high-fidelity rescans of mid-century noir title cards.
- **Atmospheric overlay**: fine film-grain noise overlay — 4-6% RGB-modulating noise field rendered as a separate `grain` companion clip composited on top of the titleSequence at `compose: 'overlay'`. The grain register IS the noir signature; without it the visual reads as modern-prestige-TV (cluster-D severance-surreal-3d T-353 / true-detective-double-exposure T-351 register) rather than mid-century-noir. Grain rate is matched to 24 fps film cadence (the v1 render samples at 30 fps but the grain field is regenerated every 1.25 frames to approximate the film cadence).
- **Layout**: centered full-frame title — `position: { x: 640, y: 360, width: 1024, alignment: 'center' }` at 1280×720. The title IS the frame, framed by deep-black margins on all sides.
- **Style bundle**: `'plate-and-credits'` — headline plate + UPPERCASE wide-tracked tagline beneath; the noir-cinema register pairs a film-noir-typography headline plate with a thin gold-rule-divided credits-block tagline.
- **Shots**: two-shot sequence — `titlePlate` (startMs 0, endMs 6800) renders the headline at gold-leaf `#D4AF37` over the `#0A0A0A` canvas with fine film-grain overlay; `creditsBlock` (startMs 1200, endMs 7200) renders the UPPERCASE wide-tracked tagline beneath the headline with a thin 1px gold horizontal divider rule above.

## Typography

- **`preferredFont: GT Sectra`** (proprietary-byo) — Grilli Type's editorial-display transitional / didone hybrid serif. The sharp wedge-serif terminals and high-contrast modulation IS the mid-century noir register at scale. Cluster I IS in `TYPE_DESIGN_REQUIRED_CLUSTERS`; `signOff.typeDesign` MUST be `'pending-cluster-batch'` or `'signed:YYYY-MM-DD'`.
- **`fallbackFont: Cormorant Garamond 700`** (`ofl` — SIL Open Font License 1.1 via Google Fonts). Same canonical OFL transitional-serif fallback as T-520 prestige-creator / T-348 stranger-things-benguiat / T-349 got-trajan-clockwork — the established prestige-typography OFL fallback path.
- **Headline (`titlePlate.content.text`)**: Mixed Case at the snapshot string level (`'The Long Goodbye'` — a Raymond Chandler / Robert Altman noir reference acceptable as test copy). Rendered at `font: { family, weight: 700, size: 64, letterSpacing: -0.005 }` — slightly tighter letterSpacing than T-520 prestige-creator's `-0.01` for the noir-cinema register's tighter typographic posture. Headline size 64 px is at the upper end of the editorial register; mid-century noir title cards habitually push large headline plates.
- **Tagline (`creditsBlock.content.lines[0]`)**: UPPERCASE applied at the snapshot string level (`'A FILM IN BLACK AND GOLD'`). Rendered at fontSize 22 px / fontWeight 500 / letterSpacing 0.10em — wider tracking than T-520's 0.08em for the mid-century-noir register's wide-tracked supratype register.
- **No italic, no underline, no strikethrough.** Noir-cinema typography never uses them in title-card slots.

## Composition structure

- **Two-shot overlap window**: at the reference frame (frame 120 = 4000 ms @ 30 fps), both shots are active simultaneously. Headline plate (startMs 0, endMs 6800) is in mid-hold; credits-block tagline (startMs 1200, endMs 7200) is also in mid-hold. Both render at full opacity at the steady-state reference frame.
- **Film-grain overlay** is composited via an `overlays?` array on the ClipKindBinding (per T-348's structural extension): the noir-cinema preset declares `overlays: [{ kind: 'filmGrain', intensity: 0.05, fps: 24 }]` so the binding-wire step composes the titleSequence primitive with the grain companion clip at `zIndex: 1` (titleSequence at `zIndex: 0`).
- **Gold horizontal rule divider** is a render-time decoration produced by the `'plate-and-credits'` style branch when the `decorations.divider` prop is set; the binding-wire step pins `decorations: { divider: { color: '#D4AF37', heightPx: 1, marginTopPx: 14 } }` for the noir-cinema register specifically.

## Animation

- **Slowest pacing of the five templates** — contemplative noir-cinema register at ~8 s total cycle:
  - Fade-in 1200 ms EASE_OUT_QUART (50% slower than T-520 prestige-creator's 800 ms)
  - Mid-hold ~5000 ms (composition-driven; the parity-fixture composition pins `durationInFrames: 240` so mid-hold falls in the middle window)
  - Fade-out 1000 ms EASE_IN_QUART
  - Total per title-card cycle: ~7.2 s — second-slowest of the five (trailer-cinematic is the slowest at ~9 s)
- **Mid-segment steady-state at frame 120** (= 4000 ms @ 30 fps) — at frame 120 both the headline plate and the credits-block tagline are at full opacity at their final positions, the film-grain overlay is composited at the canonical seed-frame, and the gold horizontal-rule divider is rendered between them.
- **No state-transition animation in v1.** The noir-cinema register is the clean steady-state register; the slow fade-in / fade-out envelopes the contemplative mid-hold but does not animate within the mid-hold itself.

## Rules

- **Bound primitive**: `titleSequence` from `@stageflip/runtimes-frame-runtime-bridge`. Cross-cluster register reuse: cluster-I preset binding a cluster-D primitive (same Pattern C as T-520 prestige-creator); the noir-cinema register's mid-century film-noir canon is materially closer to the cluster-D prestige-TV title-card register than to any cluster-I clipKind.
- **Mid-century film-noir canon (Chinatown / L.A. Confidential / The Big Sleep / Mulholland Drive).** The register is mid-century film-noir, NOT prestige-TV (cluster-D), NOT editorial-magazine (T-520 prestige-creator), NOT broadcast-news (cluster-A). Choose noir-cinema for the deliberate-paced gold-on-black noir opener register specifically.
- **Black + gold + grain — NOT white-on-black or pure-black-clean.** Removing the grain migrates the visual onto T-520 prestige-creator's editorial-magazine register; using white headline instead of gold migrates onto cluster-D prestige-TV severance-surreal-3d register; using pure-pure-black `#000000` migrates onto T-520's clean editorial canon.
- **Slowest pacing of the typography-only templates** (the trailer-cinematic register is even slower but uses letterboxed widescreen instead of full-frame typography). Speeding the pacing to 800 / 5 s / 600 ms migrates onto T-520 prestige-creator territory.
- **Reference frame for parity is mid-segment (frame 120)** per cluster-D titleSequence cluster-norm — single canonical variant.

## Acceptance (parity)

One reference-frame fixture at `frame: 120` (mid-segment steady-state):

- `golden-frame-120.png` — the canonical noir-cinema rendered as a centered full-frame title card on the deep-black `#0A0A0A` canvas; gold `#D4AF37` headline `'The Long Goodbye'` rendered at 64 px / fontWeight 700 / Cormorant Garamond OFL fallback / Mixed Case at canvas center; UPPERCASE wide-tracked gold tagline `'A FILM IN BLACK AND GOLD'` rendered at 22 px / fontWeight 500 / letterSpacing 0.10em beneath the headline with a 1px gold horizontal-rule divider between; fine film-grain overlay composited at 5% intensity across the canvas; both shots at full opacity (`opacity: 1`) at the steady-state mid-hold.

Thresholds: **PSNR ≥ 42 dB**, **SSIM ≥ 0.98** (cross-cluster norm). Hand-pinned via the F-4 generator-flag route `--psnr=42 --ssim=0.98 --mark-signed`.

## Trade-offs

- **Rendered family is `Cormorant Garamond 700` (OFL fallback), not bespoke `GT Sectra`.** Same fallback-path posture as T-520 prestige-creator; production deployments BYO-wire GT Sectra at deploy time.
- **Film-grain overlay is binding-side, not primitive-side.** The cluster-D atmospheric-overlay pattern (T-348 stranger-things-benguiat / T-351 true-detective-double-exposure) composes companion clips via the `overlays?` ClipKindBinding extension (T-348 structural extension); the noir-cinema register declares `overlays: [{ kind: 'filmGrain', intensity: 0.05, fps: 24 }]` so the binding-wire step composes the grain companion. The titleSequence primitive itself is unchanged.
- **Gold horizontal-rule divider is a `decorations` prop, not a separate shot.** The `'plate-and-credits'` style branch dispatches `decorations.divider` at render time; the binding-wire step pins the divider color / height / margin for the noir-cinema register specifically.
- **Headline copy `'The Long Goodbye'` is a Raymond Chandler / Robert Altman noir reference acceptable as test copy.** Production deployments substitute their own headline via the binding override; the snapshot ships the noir-canonical reference copy for the parity-fixture register.

## References

- Chinatown (1974, Robert Towne / Roman Polanski) — opening title-card canon
- L.A. Confidential (1997, Brian Helgeland / Curtis Hanson) — editorial-noir chyron sequence
- The Big Sleep (1946, William Faulkner / Howard Hawks) — mid-century deep-shadow title plate
- Mulholland Drive (2001, David Lynch) — slow-burn noir opener
- ADR-004 (preset system contract)
- ADR-005 (frontier clip catalogue — titleSequence posture)
- T-321 — `titleSequence` runtime-clip primitive
- T-348 — `overlays?` ClipKindBinding structural extension (used for film-grain compose)
- T-520 — prestige-creator (sister titleSequence preset; editorial-magazine register without atmospherics)
- T-531 — Frontier Effects pack skeleton
- T-535 — Premium TitleSequence templates (this PR; closes the Frontier Effects pack v0.2.0)

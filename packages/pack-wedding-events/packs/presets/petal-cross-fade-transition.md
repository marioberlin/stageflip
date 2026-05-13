---
id: petal-cross-fade-transition
cluster: cluster-wedding-events
clipKind: transition
source: traditional wedding-video canon — petal-overlay cross-fade lifecycle convention shared across The Knot, Brides, Martha Stewart Weddings, and Vogue Weddings editorial wedding-films (vertical-use-case canon; no entry in docs/compass_artifact.md — wedding-events is a vertical-oriented cluster; transition primitive does NOT yet exist in cluster-A / F / wedding-events workspace today — see Trade-offs)
status: substantive
preferredFont:
  family: GT Sectra
  license: proprietary-byo
fallbackFont:
  family: Cormorant Garamond
  weight: 600
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
ownerTask: T-529
relatedTasks:
  - T-526
  - T-527
  - T-528
  - T-530
---

# Petal cross-fade transition — wedding-events between-shot transition

First of two transition presets in the Wedding & Events pack (skeleton landed T-526; closes the first quarter of the T-526 wedding-transitions placeholder slot — the remaining quarter is the sister `lace-wipe-transition`; the two bumpers `wedding-bumper-card` + `wedding-final-card` close the other half). UNLIKE T-527 theme variants (rustic / modern / classic — each keying a SINGLE `lowerThird` primitive) and UNLIKE T-528 composition templates (wedding-ceremony / wedding-reception — multi-shot compositions binding `titleSequence` + `lowerThird`), this preset is a **between-shot transition** — a clip-kind-agnostic 800 ms cross-fade with a subtle soft-rose petal-animation overlay that plays between adjacent clips in a wedding-events composition timeline.

## Visual tokens

The petal cross-fade runs the SAME theme-agnostic register established by T-528's composition templates — champagne-ivory canvas + soft-rose accent — so it threads cleanly between any T-527 theme overlay (rustic warm-taupe / modern off-white / classic ivory) without a structural rewrite at the binding-wire step. Transition is the structural shape (800 ms cross-fade); theme is the color overlay applied to the surrounding clips.

- **Backdrop (during transition mid-frame)**: champagne ivory `#FFFAF0` — the same theme-neutral canvas as T-528 composition templates. At the 400 ms mid-point of the cross-fade, the outgoing clip is at opacity 0.5 over the ivory backdrop and the incoming clip is at opacity 0.5 — the ivory canvas reads through both layers as the underlying ground tone. NOT the deep slate `#0F172A` financial-broadcast canvas (T-522 territory), NOT the pure black `#000000` editorial-magazine canvas (T-520 territory).
- **Petal-overlay accent color**: soft rose `#E5C0C7` — wedding-canonical pastel-pink-and-cream accent, the same theme-neutral default as T-528 composition templates. Renders as ~12-18 stylized petal silhouettes drifting diagonally across the frame at varying scale (8-24 px), opacity (0.2-0.6), and rotation (~0-360°) — the petals are the wedding-canon emphasis motif, the dried-petal-bouquet / blush-floral-arrangement tonal-neutral accent that reads correctly against every T-527 theme. NOT committed to a specific theme palette (NOT rustic burgundy `#7F1D1D`, NOT modern sage `#84A98C`, NOT classic gold `#D4AF37`); soft rose is the transition's theme-neutral default. Production deployments MAY flip the petal color to a theme-specific accent at the binding-wire step; v1 ships the soft-rose theme-neutral default.
- **Petal opacity envelope**: 0 → 0.6 → 0 across the 800 ms transition window — petals fade in over the first 200 ms, hold at peak 0.6 opacity for 400 ms, fade out over the trailing 200 ms. The petal envelope is timed to peak at the cross-fade mid-point (400 ms = halfway through) so the petal motif reads strongest at the moment of clip-swap.
- **Petal motion**: each petal drifts ~40-80 px diagonally (NE → SW dominant direction with ~±15° variance per petal) over the 800 ms transition window — gentle dried-petal-drift physics, NOT rigid scripted choreography, NOT aggressive blur-trail particle drift. Linear easing for the drift translation; the opacity envelope handles the entrance / exit pacing.
- **No fourth accent color, no atmospheric grain, no light-leaks.** The two-color palette (ivory backdrop + soft-rose petals) IS the transition's signature; adding a third hue or atmospheric overlay migrates the visual onto cluster-D prestige-TV title territory (T-348 stranger-things-benguiat / T-351 true-detective-double-exposure) and OFF the wedding-broadcast register.
- **No text content.** Transitions are purely visual; they carry no headline / tagline slot. The wedding-broadcast canon for between-shot transitions is text-free — adding text to the transition migrates the visual onto bumper territory (sister `wedding-bumper-card` / `wedding-final-card`).
- **Layout**: full-bleed 1280×720 (the parity-CLI's fixed `DEFAULT_COMPOSITION`) — the petal-overlay layer renders ABOVE the cross-fading clip pair, anchored at the canvas-frame extents with petals positioned at randomized canvas-relative coordinates (seeded deterministically so the parity render is stable).

The transition is the wedding-canon equivalent of a film-camera dissolve with a floral motif — the soft-rose petal drift reads as wedding-bouquet detritus carried on the air between scenes, the in-camera-floral-motif transition gesture editorial-wedding-films use to bridge tender moments (ceremony procession → vows, vows → rings exchange, first-dance segments).

## Animation

- **Cross-fade duration**: 800 ms total — the outgoing clip fades from opacity 1 → 0 linearly across the full 800 ms window; the incoming clip fades from opacity 0 → 1 linearly across the same window. Both opacity ramps use linear easing (NOT EASE_OUT_QUART / NOT EASE_IN_QUART) — wedding-broadcast cross-fade canon uses linear ramps for the symmetric-perceived dissolve; quart easings produce an asymmetric weight-toward-incoming or weight-toward-outgoing reading that breaks the equal-weight cross-fade gesture.
- **Petal layer envelope**:
  - 0 → 200 ms: petal opacity ramps 0 → 0.6 with EASE_OUT_QUART (rapid entrance)
  - 200 → 600 ms: petal opacity holds at 0.6 (mid-hold)
  - 600 → 800 ms: petal opacity ramps 0.6 → 0 with EASE_IN_QUART (rapid exit)
- **Petal motion**: 0 → 800 ms linear translation 0 → ~40-80 px diagonally per petal; no easing on the translation channel (the opacity envelope handles the entrance / exit pacing).
- **Mid-segment steady-state at frame 12** (cluster-norm; the parity-CLI's fixed 24-frame transition window @ 30 fps means frame 12 = 400 ms falls cleanly at the cross-fade mid-point). At frame 12 the render captures: outgoing clip at opacity 0.5, incoming clip at opacity 0.5, petal layer at peak opacity 0.6 with petals at the 50 % translation point.
- **No state-transition animation in v1 beyond the cross-fade + petal layer.** State transitions (per-petal staggered entry, per-petal photographic-overlay tinting, multi-pass cross-fade chains) belong to other transition presets and other clusters; the petal cross-fade is the clean single-pass cross-fade with a petal-overlay motif.

## Rules

- **Use for tender moments specifically** — the petal cross-fade is reserved for between-shot transitions in tender-section lifecycle moments: procession → vows, vows → rings, first-dance segments, parent-dance segments, and tender candid-portrait montages. The wedding-broadcast canon distinguishes tender-moment transitions (petal cross-fade, soft-light-leak, bokeh-particle drift) from formal-moment transitions (curtain reveals, lace wipes, geometric wipes). The petal cross-fade IS the tender-moment canonical choice.
- **Do not use for formal-section transitions** — use the sister `lace-wipe-transition` instead for ceremony-procession-to-officiant-introduction, officiant-introduction-to-vows-recitation, pronouncement-to-recessional, toast-to-toast formal-section bridges. The petal cross-fade's soft-rose drift reads as too informal for formal-section bridges.
- **Do not use for bumper-card sections** — bumpers (sister `wedding-bumper-card` / `wedding-final-card`) are standalone clips, NOT transitions; the petal cross-fade does NOT replace a bumper or compose with one.
- **Do not use for broadcast-news contexts** (use a Cluster A transition equivalent — currently no cluster-A transition primitive exists; the broadcast-news between-shot canon is hard-cut). Do not use for sports-broadcast scoring-strip contexts (use a Cluster B equivalent). Do not use for cinematic-tech-reviewer contexts (use a Cluster F equivalent).
- **800 ms duration is canonical — do not stretch beyond 1000 ms or compress below 600 ms.** Wedding-broadcast cross-fade canon is the 600-1000 ms range; 800 ms is the canonical mid-point. Stretching beyond 1000 ms migrates the visual onto cinematic-feature-film dissolve territory (the 2-3 second dramatic dissolve); compressing below 600 ms migrates onto broadcast-news hard-cut-with-fade territory.
- **Soft-rose petal accent stays inside the petal-layer slot.** The soft-rose `#E5C0C7` is reserved for the petal-overlay motif; the cross-fading clip layers retain their own intrinsic colors. NEVER paint the cross-fade layers rose. NEVER use the soft-rose for narrative text content within the transition.
- **No atmospheric overlays beyond the petal layer.** No optical grain, no light-leak, no dust-particle drift, no compositional gradient. The petal-overlay IS the wedding-canon emphasis motif; atmospheric overlays migrate the visual onto cluster-D prestige-TV title territory.
- **Designed for ceremony-recap + reception-recap wedding-video deliverables** consumed alongside T-528 composition templates as between-shot transitions in the multi-shot composition timeline.

## Acceptance (parity)

One reference-frame fixture at `frame: 12` (mid-segment steady-state at the 400 ms cross-fade mid-point; cluster-norm via the parity-CLI's fixed 24-frame transition window @ 30 fps):

- `golden-frame-12.png` — the canonical petal cross-fade rendered as a full-bleed 1280×720 frame with: champagne-ivory `#FFFAF0` backdrop visible through the cross-fading clip pair (both at opacity 0.5 at the mid-point); ~12-18 soft-rose `#E5C0C7` petal silhouettes at varying scale (8-24 px) / opacity (peak 0.6) / rotation distributed across the canvas at the 50 % translation point of their diagonal NE → SW drift; no atmospheric grain; no light-leaks; no text content. Static layout at frame 12 (the opacity envelope renders petals at peak 0.6 at the cross-fade mid-point).

Thresholds: **PSNR ≥ 42 dB**, **SSIM ≥ 0.98** (matches the cross-cluster norm used by T-323 / T-325 / T-326 / T-327 / T-328 / T-329 / T-330 / T-339a / T-355 / T-356 / T-357 / T-358 / T-359 / T-360 / T-507 / T-508 / T-509 / T-512 / T-513 / T-514 / T-515 / T-517 / T-518 / T-519 / T-520 / T-522 / T-523 / T-527 / T-528 etc.). Hand-pinned via the F-4 generator-flag route `--psnr=42 --ssim=0.98 --mark-signed`.

## Trade-offs (v1 cosmetic divergences from the compass register)

- **No `transition` clipKind primitive exists in the workspace today.** A workspace-wide search confirms no `transition` clipKind exists in `packages/runtimes/*/src/clips/` — `titleSequence` (T-321), `lowerThird` (T-183), `scoreBug` (T-332a), `newsTicker` (T-356a), `weatherMap` (T-347a), `arOverlay` (T-375a) etc. all exist; `transition` does NOT. The frontmatter `clipKind: transition` IS a **forward-reference** RESERVING the preset slot — the actual transition primitive may need to land in a future cluster-X task (candidate `T-529z`-family primitive carve-out, OR a cluster-wedding-events composer task downstream, OR a cross-cluster transition primitive bundle). T-529's role is to RESERVE the preset slot with documented compass posture; the primitive-level wiring is downstream. This is consistent with the structural-extension rule (§13 of CLAUDE.md): T-529 does NOT introduce a new clipKind in runtime code; it documents the compass posture for a candidate primitive that downstream tasks will materialize.
- **Parity-fixture rendering is gated on the transition primitive landing.** Until a `transition` clipKind exists, the parity-fixture cannot render — the `signOff.parityFixture` field is `pending-user-review` per cluster-norm, but the canonical hand-pinned PSNR / SSIM thresholds (42 dB / 0.98) are reserved for the downstream consumer task that materializes the primitive AND lands the parity render. v1 ships the preset slot reservation; the parity render is downstream consumer-task territory.
- **Rendered family for petal-overlay layer is determined by the primitive.** When a `transition` primitive lands, its `font.family` prop (if any — petal-layer is text-free in v1) will determine the rendered family. The frontmatter declares `preferredFont: GT Sectra` (proprietary-byo) + `fallbackFont: Cormorant Garamond 600` (ofl) for type-design batch review consistency with sibling cluster-wedding-events presets (T-527 themes, T-528 compositions); the v1 transition has no text slot so the type-design batch review is a metadata-consistency operation, not a render-visible operation.
- **Soft-rose petal color `#E5C0C7` is the theme-neutral default, NOT a theme-specific accent.** The transition's theme-agnostic register pins the petal color to soft rose; production deployments MAY flip the petal color to a theme-specific value (rustic burgundy `#7F1D1D`, modern sage `#84A98C`, classic gold `#D4AF37`) at the binding-wire step. v1 ships the soft-rose default; theme-specific overlay parity is composer-task territory under a future `T-529a`-family follow-up.
- **Petal silhouette geometry is stylized, NOT photorealistic.** The petal-overlay layer renders ~12-18 stylized silhouette shapes (closed bezier curves approximating a generic petal outline), NOT photorealistic petal photography composited as PNG sprites. Photorealistic petal compositing is composer-task territory under a future `T-529a`-family follow-up; v1 ships the stylized-silhouette canonical default.
- **No `petalCount` / `petalColor` / `petalScale` props carved out.** The petal-overlay layer renders at canonical defaults (~12-18 petals, soft rose, 8-24 px scale range). Wiring these as primitive-level props is a candidate `T-529z`-family follow-up; v1 ships the canonical defaults verbatim.

## Out of scope

- Per-frame regression fixtures across the 800 ms transition window — captured in the cluster-wedding-events composer task downstream, NOT in T-529. v1 ships the mid-point steady-state at frame 12 as the canonical parity reference frame.
- Theme-specific parity overlays (rustic-theme variant, modern-theme variant, classic-theme variant of the petal cross-fade) — sister cluster-wedding-events presets under a future `T-529a`-family follow-up; v1 ships the theme-neutral soft-rose default only.
- Photorealistic petal-photography compositing — composer-task territory under a future `T-529a`-family follow-up.
- Bespoke `GT Sectra` proprietary-byo wiring — N/A (transition is text-free).
- Cross-fade easing alternatives (non-linear cross-fade ramps) — out of v1 scope; v1 is the canonical linear-symmetric cross-fade.
- Multi-pass cross-fade chains — out of v1 scope; v1 is the single-pass canonical cross-fade.

## References

- The Knot / Brides / Martha Stewart Weddings / Vogue Weddings editorial wedding-films canon — the tender-moment between-shot transition conventions converge on the soft-floral-motif cross-fade
- ADR-004 (preset system contract — frontmatter, loader, validator, parity sign-off, integrity invariants)
- ADR-005 (frontier clip catalogue — transition clipKind is a candidate carve-out; T-529 reserves the preset slot pending primitive landing)
- ADR-012 §D2 (pack manifest schema — vertical-use-case cluster as a free-form `cluster` field)
- ADR-013 §D3 (paid-per-tenant commercial-subscription tier — cluster-wedding-events pack SKU `wedding-events-1y`)
- T-526 — Wedding & Events Pack skeleton (this preset's parent pack; landed the four placeholder cluster-wedding-events preset slots)
- T-527 — Rustic / modern / classic theme variants substantive fill (sister cluster-wedding-events task; three theme variants the deploy-time wiring overlays at the binding-wire step)
- T-528 — Wedding-ceremony + wedding-reception composition templates (sister cluster-wedding-events task; the multi-shot compositions this transition threads between)
- T-529 — Wedding-specific transitions + bumpers (this PR; closes the wedding-transitions placeholder slot)
- T-530 — Pre-licensed audio-bed library (sister cluster-wedding-events placeholder; closes the Wedding & Events Pack v0.2.0)

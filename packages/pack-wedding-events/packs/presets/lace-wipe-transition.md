---
id: lace-wipe-transition
cluster: cluster-wedding-events
clipKind: transition
source: traditional wedding-video canon — lace-pattern wipe lifecycle convention shared across The Knot, Brides, Martha Stewart Weddings, and Vogue Weddings editorial wedding-films (vertical-use-case canon; no entry in docs/compass_artifact.md — wedding-events is a vertical-oriented cluster; transition primitive does NOT yet exist in cluster-A / F / wedding-events workspace today — see Trade-offs)
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

# Lace wipe transition — wedding-events between-shot transition

Second of two transition presets in the Wedding & Events pack (skeleton landed T-526; closes the second quarter of the T-526 wedding-transitions placeholder slot, alongside sibling `petal-cross-fade-transition`; the two bumpers `wedding-bumper-card` + `wedding-final-card` close the other half). Sister transition to `petal-cross-fade-transition` — same theme-agnostic register, same wedding-broadcast canon, but tuned to a DIFFERENT lifecycle posture: **formal-section bridges** (1200 ms diagonal wipe with lace-pattern motif) rather than tender-moment bridges (800 ms cross-fade with petal-overlay motif). The lace wipe is the engraved-formal canonical between-shot transition — the equivalent of a lace-trimmed invitation card revealing the next section.

## Visual tokens

The lace wipe runs the SAME theme-agnostic register established by T-528's composition templates and the sister petal cross-fade — champagne-ivory canvas + soft-rose accent — so it threads cleanly between any T-527 theme overlay (rustic warm-taupe / modern off-white / classic ivory) without a structural rewrite at the binding-wire step. Transition is the structural shape (1200 ms diagonal wipe); theme is the color overlay applied to the surrounding clips.

- **Backdrop (during wipe mid-frame)**: champagne ivory `#FFFAF0` — the same theme-neutral canvas as T-528 composition templates + sister petal cross-fade. At the 600 ms mid-point of the wipe, the outgoing clip has been wiped across ~50 % of the canvas diagonal and the incoming clip occupies the remaining ~50 %, with a lace-pattern edge mask separating the two regions at the diagonal wipe-front. NOT the deep slate `#0F172A` financial-broadcast canvas (T-522 territory), NOT the pure black `#000000` editorial-magazine canvas (T-520 territory).
- **Lace-pattern accent color**: soft rose `#E5C0C7` — wedding-canonical pastel-pink-and-cream accent, the same theme-neutral default as T-528 composition templates + sister petal cross-fade. Renders as a stylized lace-pattern edge mask at the wipe-front: a ~24-32 px-wide band of repeating lace-motif scallops + small-petal cutouts + open-circle eyelets along the diagonal wipe-front boundary. The lace band is the wedding-canon emphasis motif, the lace-trim-on-invitation-cardstock / heirloom-veil-trim tonal-neutral accent that reads correctly against every T-527 theme. NOT committed to a specific theme palette (NOT rustic burgundy `#7F1D1D`, NOT modern sage `#84A98C`, NOT classic gold `#D4AF37`); soft rose is the transition's theme-neutral default. Production deployments MAY flip the lace color to a theme-specific accent at the binding-wire step; v1 ships the soft-rose theme-neutral default.
- **Lace-band opacity envelope**: 0 → 0.8 → 0 across the 1200 ms transition window — the lace band fades in over the first 300 ms (synchronized with the wipe-front entrance), holds at peak 0.8 opacity for 600 ms, fades out over the trailing 300 ms (synchronized with the wipe-front exit). The lace-band envelope is timed to peak through the middle 600 ms of the wipe so the lace-trim motif reads strongest at the moment of greatest visual transition.
- **Wipe direction**: diagonal NW → SE — the wipe-front sweeps from the upper-left canvas corner to the lower-right canvas corner across the 1200 ms window. The diagonal direction IS the formal-section wedding-broadcast canon — engraved-invitation card-reveals canonically use diagonal motion (the formal-cardstock-flip-reveal gesture) rather than horizontal or vertical wipe (which read as broadcast-news / sports-broadcast register respectively).
- **Wipe-front geometry**: linear diagonal at ~37° from horizontal (a clean NW-SE diagonal across a 1280×720 canvas — `atan(720/1280) ≈ 29.4°` is the canvas-aspect diagonal; 37° pulls the wipe-front to a slightly-steeper-than-canvas-diagonal angle that reads as the canonical formal-card-flip gesture). NOT vertical (broadcast-news territory), NOT horizontal (sports-broadcast territory), NOT curved / arched (cinematic-feature-film territory).
- **No fourth accent color, no atmospheric grain, no light-leaks.** The two-color palette (ivory backdrop + soft-rose lace band) IS the transition's signature; adding a third hue or atmospheric overlay migrates the visual onto cluster-D prestige-TV title territory and OFF the wedding-broadcast register.
- **No text content.** Transitions are purely visual; they carry no headline / tagline slot. The wedding-broadcast canon for between-shot transitions is text-free — adding text to the transition migrates the visual onto bumper territory (sister `wedding-bumper-card` / `wedding-final-card`).
- **Layout**: full-bleed 1280×720 (the parity-CLI's fixed `DEFAULT_COMPOSITION`) — the lace-band edge-mask layer renders along the diagonal wipe-front boundary, anchored at canvas-relative coordinates that track the wipe-front position frame-by-frame.

The transition is the wedding-canon equivalent of a lace-trim invitation card being slid across the frame to reveal the next section — the soft-rose lace-band edge reads as heirloom-veil-trim / engraved-invitation-cardstock-lace-edge, the in-camera-formal-card-reveal gesture editorial-wedding-films use to bridge formal-section moments (procession-to-officiant-introduction, officiant-introduction-to-vows-recitation, pronouncement-to-recessional, toast-to-toast formal-section bridges).

## Animation

- **Diagonal wipe duration**: 1200 ms total — the wipe-front translates linearly from the upper-left canvas corner (position 0 %) to the lower-right canvas corner (position 100 %) across the full 1200 ms window. Linear easing on the wipe-front position channel (NOT EASE_OUT_QUART / NOT EASE_IN_QUART) — wedding-broadcast formal-card-reveal canon uses linear ramps for the steady-formal-card-slide gesture; quart easings produce an acceleration / deceleration reading that breaks the steady-formal-card register.
- **Lace-band layer envelope**:
  - 0 → 300 ms: lace-band opacity ramps 0 → 0.8 with EASE_OUT_QUART (rapid entrance synchronized with wipe-front emerging from the upper-left corner)
  - 300 → 900 ms: lace-band opacity holds at 0.8 (mid-hold across the bulk of the wipe traversal)
  - 900 → 1200 ms: lace-band opacity ramps 0.8 → 0 with EASE_IN_QUART (rapid exit synchronized with wipe-front disappearing into the lower-right corner)
- **Mid-segment steady-state at frame 18** (cluster-norm; the parity-CLI's fixed 36-frame transition window @ 30 fps means frame 18 = 600 ms falls cleanly at the wipe mid-point). At frame 18 the render captures: outgoing clip occupies ~50 % of the canvas (lower-right region beyond the wipe-front); incoming clip occupies ~50 % of the canvas (upper-left region behind the wipe-front); lace-band edge mask at peak opacity 0.8 along the diagonal wipe-front boundary.
- **No state-transition animation in v1 beyond the diagonal wipe + lace-band layer.** State transitions (per-lace-motif staggered entry, lace-pattern-color-jumps, multi-pass wipe chains) belong to other transition presets and other clusters; the lace wipe is the clean single-pass diagonal wipe with a lace-band motif.

## Rules

- **Use for formal-section bridges specifically** — the lace wipe is reserved for between-shot transitions in formal-section lifecycle moments: ceremony-procession-to-officiant-introduction, officiant-introduction-to-vows-recitation, pronouncement-to-recessional, reception-welcome-to-toasts, toast-to-toast formal-section bridges. The wedding-broadcast canon distinguishes formal-moment transitions (lace wipes, curtain reveals, geometric wipes) from tender-moment transitions (petal cross-fades, soft-light-leaks, bokeh-particle drifts). The lace wipe IS the formal-section canonical choice.
- **Do not use for tender-moment transitions** — use the sister `petal-cross-fade-transition` instead for procession-to-vows, vows-to-rings, first-dance segments, parent-dance segments, and tender candid-portrait montages. The lace wipe's diagonal-formal-card-reveal reads as too formal for tender-moment bridges.
- **Do not use for bumper-card sections** — bumpers (sister `wedding-bumper-card` / `wedding-final-card`) are standalone clips, NOT transitions; the lace wipe does NOT replace a bumper or compose with one.
- **Do not use for broadcast-news contexts** (use a Cluster A transition equivalent — currently no cluster-A transition primitive exists; the broadcast-news between-shot canon is hard-cut). Do not use for sports-broadcast scoring-strip contexts (use a Cluster B equivalent). Do not use for cinematic-tech-reviewer contexts (use a Cluster F equivalent).
- **1200 ms duration is canonical — do not stretch beyond 1500 ms or compress below 900 ms.** Wedding-broadcast diagonal-wipe canon is the 900-1500 ms range; 1200 ms is the canonical mid-point. Stretching beyond 1500 ms migrates the visual onto cinematic-feature-film wipe territory (the 2+ second dramatic wipe); compressing below 900 ms migrates onto broadcast-news fast-wipe territory.
- **Diagonal direction NW → SE — do not invert.** The wipe-front direction is canonical NW-to-SE; inverting to SE-to-NW reads as a backwards-card-reveal that breaks the formal-cardstock-flip gesture. Horizontal / vertical wipes read as broadcast-news / sports-broadcast register and migrate OFF the wedding-broadcast register entirely.
- **Soft-rose lace-band accent stays inside the edge-mask slot.** The soft-rose `#E5C0C7` is reserved for the lace-band edge mask along the wipe-front; the wiping clip layers retain their own intrinsic colors. NEVER paint the wipe layers rose. NEVER use the soft-rose for narrative text content within the transition.
- **No atmospheric overlays beyond the lace-band layer.** No optical grain, no light-leak, no dust-particle drift, no compositional gradient. The lace-band-edge-mask IS the wedding-canon emphasis motif; atmospheric overlays migrate the visual onto cluster-D prestige-TV title territory.
- **Designed for ceremony-recap + reception-recap wedding-video deliverables** consumed alongside T-528 composition templates as between-shot transitions in the multi-shot composition timeline.

## Acceptance (parity)

One reference-frame fixture at `frame: 18` (mid-segment steady-state at the 600 ms wipe mid-point; cluster-norm via the parity-CLI's fixed 36-frame transition window @ 30 fps):

- `golden-frame-18.png` — the canonical lace wipe rendered as a full-bleed 1280×720 frame with: champagne-ivory `#FFFAF0` backdrop visible in both wipe regions; outgoing clip occupying the lower-right ~50 % of the canvas; incoming clip occupying the upper-left ~50 % of the canvas; a diagonal soft-rose `#E5C0C7` lace-band edge mask at peak 0.8 opacity along the ~37° NW-SE wipe-front boundary; no atmospheric grain; no light-leaks; no text content. Static layout at frame 18 (the wipe-front sits at the canvas midpoint at the 50 % traversal point).

Thresholds: **PSNR ≥ 42 dB**, **SSIM ≥ 0.98** (matches the cross-cluster norm used by T-323 / T-325 / T-326 / T-327 / T-328 / T-329 / T-330 / T-339a / T-355 / T-356 / T-357 / T-358 / T-359 / T-360 / T-507 / T-508 / T-509 / T-512 / T-513 / T-514 / T-515 / T-517 / T-518 / T-519 / T-520 / T-522 / T-523 / T-527 / T-528 etc.). Hand-pinned via the F-4 generator-flag route `--psnr=42 --ssim=0.98 --mark-signed`.

## Trade-offs (v1 cosmetic divergences from the compass register)

- **No `transition` clipKind primitive exists in the workspace today.** Same posture as sister `petal-cross-fade-transition` — a workspace-wide search confirms no `transition` clipKind exists in `packages/runtimes/*/src/clips/`. The frontmatter `clipKind: transition` IS a **forward-reference** RESERVING the preset slot — the actual transition primitive may need to land in a future cluster-X task (candidate `T-529z`-family primitive carve-out, OR a cluster-wedding-events composer task downstream, OR a cross-cluster transition primitive bundle). T-529's role is to RESERVE the preset slot with documented compass posture; the primitive-level wiring is downstream. This is consistent with the structural-extension rule (§13 of CLAUDE.md): T-529 does NOT introduce a new clipKind in runtime code; it documents the compass posture for a candidate primitive that downstream tasks will materialize.
- **Parity-fixture rendering is gated on the transition primitive landing.** Until a `transition` clipKind exists, the parity-fixture cannot render — the `signOff.parityFixture` field is `pending-user-review` per cluster-norm, but the canonical hand-pinned PSNR / SSIM thresholds (42 dB / 0.98) are reserved for the downstream consumer task that materializes the primitive AND lands the parity render. v1 ships the preset slot reservation; the parity render is downstream consumer-task territory.
- **Rendered family for lace-band layer is determined by the primitive.** When a `transition` primitive lands, its `font.family` prop (if any — lace-band is text-free in v1) will determine the rendered family. The frontmatter declares `preferredFont: GT Sectra` (proprietary-byo) + `fallbackFont: Cormorant Garamond 600` (ofl) for type-design batch review consistency with sibling cluster-wedding-events presets (T-527 themes, T-528 compositions); the v1 transition has no text slot so the type-design batch review is a metadata-consistency operation, not a render-visible operation.
- **Soft-rose lace-band color `#E5C0C7` is the theme-neutral default, NOT a theme-specific accent.** The transition's theme-agnostic register pins the lace-band color to soft rose; production deployments MAY flip the lace-band color to a theme-specific value (rustic burgundy `#7F1D1D`, modern sage `#84A98C`, classic gold `#D4AF37`) at the binding-wire step. v1 ships the soft-rose default; theme-specific overlay parity is composer-task territory under a future `T-529a`-family follow-up.
- **Lace-pattern geometry is stylized, NOT photorealistic.** The lace-band edge mask renders as repeating stylized lace-motif scallops + small-petal cutouts + open-circle eyelets along the wipe-front, NOT photorealistic lace photography composited as PNG sprites. Photorealistic lace compositing is composer-task territory under a future `T-529a`-family follow-up; v1 ships the stylized-vector canonical default.
- **No `laceBandWidth` / `laceColor` / `wipeAngleDeg` props carved out.** The lace-wipe transition renders at canonical defaults (~24-32 px-wide lace band, soft rose, ~37° NW-SE diagonal). Wiring these as primitive-level props is a candidate `T-529z`-family follow-up; v1 ships the canonical defaults verbatim.
- **Wipe-front angle is 37°, NOT the 29.4° canvas-aspect-natural diagonal.** A pure canvas-aspect diagonal across a 1280×720 frame is `atan(720/1280) ≈ 29.4°`; the lace wipe pins the wipe-front at the slightly-steeper 37° for the canonical formal-card-flip gesture (the slightly-steeper-than-aspect diagonal reads as the formal-cardstock-tilt that aspect-natural diagonals miss). Production deployments at 1920×1080 or 4K canvas dimensions retain the 37° pin (the wipe-front angle is canvas-aspect-invariant).

## Out of scope

- Per-frame regression fixtures across the 1200 ms transition window — captured in the cluster-wedding-events composer task downstream, NOT in T-529. v1 ships the mid-point steady-state at frame 18 as the canonical parity reference frame.
- Theme-specific parity overlays (rustic-theme variant, modern-theme variant, classic-theme variant of the lace wipe) — sister cluster-wedding-events presets under a future `T-529a`-family follow-up; v1 ships the theme-neutral soft-rose default only.
- Photorealistic lace-photography compositing — composer-task territory under a future `T-529a`-family follow-up.
- Bespoke `GT Sectra` proprietary-byo wiring — N/A (transition is text-free).
- Wipe-angle alternatives (vertical / horizontal / curved / arched wipes) — out of v1 scope; v1 is the canonical 37° NW-SE diagonal wipe.
- Multi-pass wipe chains — out of v1 scope; v1 is the single-pass canonical wipe.

## References

- The Knot / Brides / Martha Stewart Weddings / Vogue Weddings editorial wedding-films canon — the formal-section between-shot transition conventions converge on the diagonal-lace-trim wipe
- ADR-004 (preset system contract — frontmatter, loader, validator, parity sign-off, integrity invariants)
- ADR-005 (frontier clip catalogue — transition clipKind is a candidate carve-out; T-529 reserves the preset slot pending primitive landing)
- ADR-012 §D2 (pack manifest schema — vertical-use-case cluster as a free-form `cluster` field)
- ADR-013 §D3 (paid-per-tenant commercial-subscription tier — cluster-wedding-events pack SKU `wedding-events-1y`)
- T-526 — Wedding & Events Pack skeleton (this preset's parent pack; landed the four placeholder cluster-wedding-events preset slots)
- T-527 — Rustic / modern / classic theme variants substantive fill (sister cluster-wedding-events task; three theme variants the deploy-time wiring overlays at the binding-wire step)
- T-528 — Wedding-ceremony + wedding-reception composition templates (sister cluster-wedding-events task; the multi-shot compositions this transition threads between)
- T-529 — Wedding-specific transitions + bumpers (this PR; closes the wedding-transitions placeholder slot)
- T-530 — Pre-licensed audio-bed library (sister cluster-wedding-events placeholder; closes the Wedding & Events Pack v0.2.0)

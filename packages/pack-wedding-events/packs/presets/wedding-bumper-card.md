---
id: wedding-bumper-card
cluster: cluster-wedding-events
clipKind: title-sequence
source: traditional wedding-video canon — mid-section bumper-card lifecycle convention shared across The Knot, Brides, Martha Stewart Weddings, and Vogue Weddings editorial wedding-films (vertical-use-case canon; no entry in docs/compass_artifact.md — wedding-events is a vertical-oriented cluster)
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

# Wedding bumper card — mid-section title-card bumper

First of two bumper presets in the Wedding & Events pack (skeleton landed T-526; closes the third quarter of the T-526 wedding-transitions placeholder slot, alongside sibling `wedding-final-card`; the two transitions `petal-cross-fade-transition` + `lace-wipe-transition` close the other half). UNLIKE T-529's sister transitions (between-shot 800 ms / 1200 ms motion clips), this preset is a **standalone mid-section bumper card** — a 3-second full-frame title card that plays between major lifecycle sections (e.g. between the ceremony arc and the reception arc, between the toasts arc and the first-dance arc) to signal a major lifecycle pivot.

## Visual tokens

The wedding bumper card runs the SAME theme-agnostic register established by T-528's composition templates — champagne-ivory canvas + soft-rose accent + black text — so it threads cleanly between any T-527 theme overlay (rustic warm-taupe / modern off-white / classic ivory) without a structural rewrite at the binding-wire step. Bumper is the structural shape (3-second full-frame title card); theme is the color overlay applied to the surrounding clips.

- **Backdrop**: champagne ivory `#FFFAF0` — full-bleed soft-warm canvas across the full 3-second bumper window. The tone is intentionally tonal-neutral: warm enough to blend with rustic-theme's warm-taupe overlay (T-527 rustic — `#8B7355` accent), cool enough to blend with modern-theme's off-white overlay (T-527 modern — `#FAFAFA` accent), and on-canon with classic-theme's ivory register (T-527 classic — exact match). NOT the deep slate `#0F172A` financial-broadcast canvas, NOT the pure black `#000000` editorial-magazine canvas.
- **Foreground / primary headline color**: `#000000` — pure black. Maximum-contrast black text on the ivory canvas; cross-register wedding-broadcast canon for headline slots. The black-on-ivory contrast pattern carries the engraved-invitation gravitas the bumper-card use case demands and reads correctly across all three T-527 theme overlays at the binding-wire step. SAME headline color as T-528 composition templates (the bumper is the cross-cluster sibling of the composition templates' title-slide register).
- **Accent color**: soft rose `#E5C0C7` — wedding-canonical pastel-pink-and-cream accent. Reserved for a centered ~480 px-wide × 2 px-tall horizontal lace-trim divider rendered ~24 px BELOW the headline plate — the divider IS the wedding-canon emphasis motif, the lace-trim-on-invitation-cardstock tonal-neutral accent that reads correctly against every T-527 theme. NOT committed to a specific theme palette (NOT rustic burgundy, NOT modern sage, NOT classic gold) — soft rose is the bumper's theme-neutral default. Production deployments MAY flip the divider color to a theme-specific accent at the binding-wire step; v1 ships the soft-rose theme-neutral default.
- **No fourth accent color, no atmospheric grain, no light-leaks.** The three-color palette (ivory canvas + black headline + soft-rose lace-trim divider) IS the bumper's signature; adding a fourth hue dilutes the theme-agnostic neutrality and migrates the visual onto a specific theme overlay (which is the theme-variant task's territory, not the bumper-card task's).
- **Layout** — centered full-frame title card. Headline plate centered at the canvas vertical midline (`y: 360` at 1280×720); soft-rose lace-trim divider ~24 px below the headline plate centerline; NO subtitle / tagline slot in v1 (the bumper is a single-slot full-frame title card, NOT a plate-and-credits composition). The headline plate uses the centered full-frame register (the `titleSequence` primitive's default).

The bumper IS the wedding-broadcast lifecycle-pivot canonical UX gesture — a single 3-second full-frame title card with a section-name headline and a lace-trim divider that signals "we are moving from one major arc to the next" without competing with the surrounding compositions' multi-shot pacing.

## Typography

- **`preferredFont: GT Sectra`** (`proprietary-byo` — Grilli Type's editorial-magazine display serif). Same preferred family as T-520 prestige-creator AND T-522 earnings-call AND T-523 investor-deck AND T-527 classic-theme AND T-528 composition templates; the transitional / didone hybrid construction with its sharp wedge-serif terminals and high-contrast modulation IS the cross-cluster prestige register. The shared-preferred-family discipline across cluster-F (T-520) + cluster-finance (T-522 / T-523) + cluster-wedding-events (T-527 classic, T-528 compositions, T-529 bumpers) establishes the cross-cluster prestige-typography signature. Cluster-F's type-design batch covers the cluster-wedding-events type sign-off by precedent (T-527 classic-theme is the closest sibling register); cluster-wedding-events type-design batch review is the cluster-composer task downstream. `signOff.typeDesign` MUST be `'pending-cluster-batch'` or `'signed:YYYY-MM-DD'`, NOT `'na'`.
- **`fallbackFont: Cormorant Garamond 600`** (`ofl` — SIL Open Font License 1.1 via Google Fonts). Same OFL fallback as T-520 / T-522 / T-523 / T-527 classic-theme / T-528 composition templates — the canonical OFL transitional-serif-revival fallback for prestige-typography registers. Cormorant Garamond is the OFL transitional-serif-revival closest to GT Sectra in construction — sharp wedge serifs, high contrast modulation, narrow proportions. Type-design consultant approval on the GT Sectra → Cormorant Garamond fallback path is pending the cluster-wedding-events type-design batch review per ADR-004 §D4.
- **Headline (`titlePlate.content.text`)**: Mixed Case at the snapshot string level — the canonical default for the mid-section bumper is `'Reception'` (signaling the ceremony-to-reception lifecycle pivot in the canonical use case). Other mid-section bumpers may carry `'Ceremony'` / `'Toasts'` / `'First Dance'` / `'Cake Cutting'` etc. depending on the production's lifecycle-arc layout. Rendered via `font: { family, weight: 700, size: 72, letterSpacing: -0.005 }` at the schema-prop level — 72 px sits above T-528 composition templates' 56 px because the bumper card is a single-slot full-frame display register with no competing tagline / divider for screen real estate; the headline dominates the canvas. Mixed Case (NOT UPPERCASE) IS the wedding-broadcast register — engraved-invitation typography uses sentence-case Mixed Case consistently across heavyweight-cardstock invitation, ballroom-table place card, and ceremony-monogram backdrop. UPPERCASE section titles would read as broadcast-news (T-507 / T-508 / T-509 register) and migrate the visual off the cluster-wedding-events register entirely.
- **No subtitle / tagline slot.** The bumper card is a single-slot full-frame title card; the lace-trim divider takes the slot that the composition templates' tagline-slot occupies. The lace-trim divider IS the canonical visual decoration in lieu of a tagline — production deployments needing a subtitle line (date / venue / officiant attribution) should use a T-528 composition-template title slide rather than the bumper card.
- **Casing transform**: `'as-is'` (default). Casing is applied at the snapshot-string level (Mixed Case headlines) so the primitive's casing-transform layer is a no-op.
- **No italic, no underline, no strikethrough.** Wedding-broadcast typography never uses them — even the most formal engraved-invitation typography stays in Mixed Case sentence-case at varying sizes, not italic.

## Animation

- **Duration**: 3000 ms total — the bumper card occupies a single 3-second window in the composition timeline. Slower than the sister transitions (800 ms petal cross-fade / 1200 ms lace wipe) because the bumper is a self-contained lifecycle-pivot card, NOT a between-shot bridge; the 3-second hold matches the wedding-broadcast canon for full-frame title-card display time (long enough to read + register the section pivot, short enough to maintain the composition's pacing).
- **Choreography target (spec)** — leisurely wedding-broadcast lifecycle pacing across the full bumper window:
  - Fade-in 600 ms EASE_OUT_QUART (primitive default `entrance: 'fade'`) — slightly faster than T-528 composition templates' 800 ms because the bumper is a lifecycle-pivot signal that should register quickly
  - Mid-hold 1800 ms — the bulk of the bumper window holds the full-opacity headline + lace-trim divider for the reading + recognition pass
  - Fade-out 600 ms EASE_IN_QUART (transitionOut `'fade'`, synchronized 600 ms before the bumper's `endMs`)
  - Total: 3000 ms — slower than T-528 composition templates' per-shot ~5.4 s? Wait — the bumper is a single-shot 3000 ms hold; T-528 per-shot is ~5.4 s; the bumper is FASTER per-shot than T-528 because the bumper is a pivot-signal, not a section-segment. The bumper IS the lifecycle-pivot canonical UX gesture.
- **Mid-segment steady-state at frame 45** (cluster-norm; the parity-CLI's fixed 90-frame composition window for a 3000 ms @ 30 fps clip means frame 45 = 1500 ms falls cleanly in the bumper's mid-hold window — 600 ms entrance + 1800 ms hold + 600 ms exit). At frame 45 the render captures the bumper card at full opacity with both the headline plate and the lace-trim divider settled at their final positions.
- **No state-transition animation in v1.** State transitions (per-letter staggered entry, per-shot color-jumps, photographic-overlay tinting) belong to other style bundles and other clusters; the wedding-bumper register is the clean steady-state full-frame title-card register.

## Rules

- **Bound primitive**: `titleSequence` (cluster-D — T-321) bound via `PRESET_ID_BINDINGS` per Pattern C cross-cluster register reuse — same model T-520 prestige-creator (cluster-F), T-522 earnings-call (cluster-finance), T-523 investor-deck (cluster-finance), AND T-528 composition templates (cluster-wedding-events) established. The `'titleSequence'` arm in `DEFAULT_CLIP_KIND_RESOLVER` stays UNCHANGED at the cluster-D squid-game-geometric clipKind-default (T-350); the wedding-bumper-card register threads via `PRESET_ID_BINDINGS['wedding-bumper-card']` at the binding-wire step. **Second cluster-wedding-events consumer of `titleSequence` primitive** after T-528 composition templates.
- **Cross-cluster register reuse: cluster-wedding-events preset binding cluster-D `titleSequence` primitive.** Same Pattern C model T-520 / T-522 / T-523 / T-528 established. The wedding-bumper register's wedding-broadcast canon is materially closer to cluster-D prestige-TV title-card register than to any other existing cluster's title-card register. Reusing the existing `titleSequence` primitive — rather than introducing a new `weddingBumper` cluster-wedding-events primitive — keeps the implementation surface small AND respects the structural-extension rule (§13 of CLAUDE.md): no new clipKind, no new degree-of-freedom on the document or binding model, just a new cluster-wedding-events preset binding an existing primitive. The visual register difference (wedding-broadcast vs prestige-TV) is captured in the snapshot constants (`WEDDING_BUMPER_CARD_PROPS`) — same primitive, different props.
- **Theme-agnostic by design.** The bumper runs the same visual register (champagne-ivory backdrop + black text + soft-rose lace-trim divider) regardless of which T-527 theme variant (rustic / modern / classic) the deploy-time wiring overlays. Production deployments MAY flip the divider color to a theme-specific accent at the binding-wire step; v1 ships the theme-neutral defaults.
- **Use for major lifecycle-section pivots specifically** — the wedding bumper card is reserved for mid-composition transitions between major lifecycle arcs (ceremony → reception, toasts → first-dance, first-dance → cake-cutting, cake-cutting → send-off). Do not use as a per-shot section divider WITHIN a composition arc (use T-528 composition templates' lower-third sub-shots instead). Do not use as a final outro card (use sister `wedding-final-card` instead).
- **Mixed Case headline — NOT UPPERCASE.** UPPERCASE titles migrate the register onto broadcast-news (Sky News / ITV / RAI / CNN-breaking) territory entirely. Engraved-invitation typography is sentence-case Mixed Case across the wedding-broadcast register.
- **Soft-rose lace-trim divider stays inside the divider slot.** The soft-rose `#E5C0C7` is reserved for the centered ~480 px-wide × 2 px-tall horizontal lace-trim divider below the headline plate. NEVER paint the canvas rose. NEVER use the soft-rose for narrative text content.
- **No subtitle / tagline slot.** The bumper card is a single-slot full-frame title card; v1 ships without a subtitle / tagline. Production deployments needing a subtitle line should use a T-528 composition-template title slide rather than the bumper card.
- **No atmospheric overlays.** No optical grain, no light-leak, no dust-particle drift. The composition-card canvas IS the register; atmospheric overlays migrate the visual onto cluster-D prestige-TV title territory.
- **Designed for ceremony-recap + reception-recap wedding-video deliverables** — same legibility requirements as the cluster-A news-broadcaster register (headline ≥ 34 pt; primitive's 72 px exceeds substantially).
- **Reference frame for parity is mid-segment (frame 45)** per cluster-norm — single canonical variant capturing the bumper card at the 1500 ms mid-hold steady-state.

## Acceptance (parity)

One reference-frame fixture at `frame: 45` (mid-segment steady-state per cluster-norm; the parity-CLI's fixed 90-frame composition window for a 3000 ms @ 30 fps bumper):

- `golden-frame-45.png` — the canonical wedding bumper card rendered as a centered full-frame title card on a champagne-ivory `#FFFAF0` full-bleed canvas; headline `'Reception'` rendered at 72 px / fontWeight 700 / Cormorant Garamond OFL fallback / Mixed Case at canvas center (`x: 640, y: 360` at 1280×720); soft-rose `#E5C0C7` centered horizontal lace-trim divider rendered ~24 px below the headline plate centerline (a ~480 px-wide × 2 px-tall band centered horizontally); both the headline plate and the divider at full opacity (`opacity: 1`) at the steady-state mid-hold; no atmospheric overlays. Static layout (no animation; the centered full-frame title-card register renders both visual elements at full opacity at the reference frame — no entrance / exit animation active).

Thresholds: **PSNR ≥ 42 dB**, **SSIM ≥ 0.98** (matches the cross-cluster norm). Hand-pinned via the F-4 generator-flag route `--psnr=42 --ssim=0.98 --mark-signed`.

## Trade-offs (v1 cosmetic divergences from the compass register)

- **Rendered family is `Cormorant Garamond 600` (OFL fallback), not the bespoke `GT Sectra` (proprietary BYO).** The `titleSequence` primitive's `font.family` prop IS wired into the rendered output, so the rendered family follows the binding's snapshot `font.family` value verbatim. The binding-wire step (cluster-wedding-events composer task) sets `font.family: 'Cormorant Garamond'` for the parity render; flipping to `'GT Sectra'` requires the bespoke font to be BYO-wired at deploy time. v1 ships the OFL fallback verbatim.
- **Soft-rose lace-trim divider color `#E5C0C7` is the theme-neutral default, NOT a theme-specific accent.** The bumper's theme-agnostic register pins the divider color to soft rose for the parity render; production deployments MAY flip the divider color to a theme-specific value (rustic burgundy `#7F1D1D`, modern sage `#84A98C`, classic gold `#D4AF37`) at the binding-wire step. The parity-fixture captures the soft-rose default; theme-specific overlay parity is composer-task territory under a future `T-529a`-family follow-up.
- **Headline size 72 px, not the T-528 composition templates' 56 px or the T-522 earnings-call 48 px conservative-corporate range.** The wedding-bumper-card register reads at a larger headline scale than the composition-template title-slide register because the bumper is a single-slot full-frame title card with no competing tagline / divider for screen real estate; the headline dominates the canvas. Production deployments with a 1920×1080 or 4K canvas can scale up via the binding override.
- **No tagline / subtitle slot rendered at the parity reference frame.** The bumper card is a single-slot full-frame title card; the `'plate-and-credits'` style bundle T-528 composition templates use is NOT used here — the bumper uses a `'plate-only'` style bundle (or equivalent: the primitive renders the headline plate solo with no overlapping credits-block tagline). Production deployments needing a subtitle line should use a T-528 composition-template title slide rather than the bumper card.
- **Lace-trim divider is a flat band, NOT a photorealistic lace-trim image.** The divider renders as a flat soft-rose `#E5C0C7` rectangle ~480 px × 2 px centered below the headline plate, NOT a photorealistic lace-trim photograph composited as a PNG sprite. Photorealistic lace-trim compositing is composer-task territory under a future `T-529a`-family follow-up; v1 ships the flat-band canonical default.
- **No `weddingMonogram` companion clip carved out.** The wedding-broadcast canon sometimes features a gold-leaf or floral-frame monogram backdrop card behind the title strip on engraved-wedding intro cards (T-527 classic-theme references this as an out-of-scope candidate; T-528 composition templates reiterate). A dedicated `weddingMonogram` primitive (specialized for the engraved-foil monogram-card register with built-in floral-frame border) is a candidate primitive-level carve-out under the cluster-wedding-events compose-tools label; v1 reuses the cluster-D `titleSequence` primitive without the monogram-card.

## Out of scope

- Multi-bumper composition templates (e.g. a five-bumper lifecycle-pivot chain across the full ceremony + reception arc) — composer-task territory under a future `T-529a`-family follow-up; v1 ships the single-bumper preset only.
- Theme-specific parity overlays (rustic-theme variant, modern-theme variant, classic-theme variant of the bumper) — sister cluster-wedding-events presets under a future `T-529a`-family follow-up; v1 ships the theme-neutral soft-rose default only.
- Photorealistic lace-trim compositing — composer-task territory under a future `T-529a`-family follow-up.
- Bespoke `GT Sectra` proprietary-byo wiring — production-fidelity preference, BYO-license-gated at deploy time. v1 ships the Cormorant Garamond OFL fallback for the parity render.
- Subtitle / tagline slot — out of v1 scope; v1 is a single-slot full-frame title card with a lace-trim divider in lieu of a tagline.

## References

- The Knot / Brides / Martha Stewart Weddings / Vogue Weddings editorial wedding-films canon — the major-lifecycle-pivot bumper conventions converge on the centered full-frame title-card with a lace-trim divider
- ADR-004 (preset system contract)
- ADR-005 (frontier clip catalogue — titleSequence posture)
- ADR-012 §D2 (pack manifest schema — vertical-use-case cluster as a free-form `cluster` field)
- ADR-013 §D3 (paid-per-tenant commercial-subscription tier — cluster-wedding-events pack SKU `wedding-events-1y`)
- T-321 — `titleSequence` runtime-clip primitive (cluster-D; bound here for the bumper title-card register)
- T-348 — Stranger Things Benguiat preset (sister `titleSequence` consumer; cluster-D prestige-TV register — T-529 omits the atmospherics for the cluster-wedding-events register)
- T-360 — `PRESET_ID_BINDINGS` mechanism (binding path for non-default `titleSequence` consumers)
- T-520 — Prestige-creator cinematic title-card composition preset (sibling composition; cross-cluster register reuse precedent)
- T-522 — Earnings-call composition template (sibling composition; cross-cluster register reuse precedent)
- T-523 — Investor-deck composition template (sibling composition; cross-cluster register reuse precedent)
- T-526 — Wedding & Events Pack skeleton (this preset's parent pack; landed the four placeholder cluster-wedding-events preset slots)
- T-527 — Rustic / modern / classic theme variants substantive fill (sibling task; three theme variants the deploy-time wiring overlays at the binding-wire step)
- T-528 — Wedding-ceremony + wedding-reception composition templates (sibling task; the multi-shot compositions this bumper threads between)
- T-529 — Wedding-specific transitions + bumpers (this PR; closes the wedding-transitions placeholder slot)
- T-530 — Pre-licensed audio-bed library (sister cluster-wedding-events placeholder; closes the Wedding & Events Pack v0.2.0)

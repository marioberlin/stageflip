---
id: wedding-final-card
cluster: cluster-wedding-events
clipKind: title-sequence
source: traditional wedding-video canon — final-outro card lifecycle convention shared across The Knot, Brides, Martha Stewart Weddings, and Vogue Weddings editorial wedding-films (vertical-use-case canon; no entry in docs/compass_artifact.md — wedding-events is a vertical-oriented cluster)
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

# Wedding final card — outro thank-you title-card bumper

Second of two bumper presets in the Wedding & Events pack (skeleton landed T-526; closes the fourth quarter of the T-526 wedding-transitions placeholder slot, alongside sibling `wedding-bumper-card`; the two transitions `petal-cross-fade-transition` + `lace-wipe-transition` close the other half). Sister bumper to `wedding-bumper-card` — same Pattern C cross-cluster binding model, same cluster-wedding-events vertical cluster, same theme-agnostic visual register, but tuned to a DIFFERENT lifecycle posture: the **outro thank-you card** (5-second full-frame title card with both a headline plate AND a couple-signature tagline) rather than the mid-section pivot card (3-second full-frame title card with a lace-trim divider in lieu of a tagline).

## Visual tokens

The wedding final card runs the SAME theme-agnostic register established by T-528's composition templates AND the sister `wedding-bumper-card` — champagne-ivory canvas + soft-rose accent + black text — so it threads cleanly between any T-527 theme overlay (rustic warm-taupe / modern off-white / classic ivory) without a structural rewrite at the binding-wire step. Final card is the structural shape (5-second full-frame title card with headline + signature-tagline); theme is the color overlay applied at the binding-wire step.

- **Backdrop**: champagne ivory `#FFFAF0` — full-bleed soft-warm canvas across the full 5-second final-card window. Same theme-neutral default as sister `wedding-bumper-card` and T-528 composition templates. NOT the deep slate `#0F172A` financial-broadcast canvas, NOT the pure black `#000000` editorial-magazine canvas.
- **Foreground / primary headline color**: `#000000` — pure black. Maximum-contrast black text on the ivory canvas; cross-register wedding-broadcast canon for headline slots. Same headline color as sister `wedding-bumper-card` and T-528 composition templates (the final card is the cross-cluster sibling of the composition templates' thank-you card shot — T-528 wedding-ceremony-template shot 7).
- **Tagline color**: `#000000` — pure black (same as headline). The couple-signature tagline below the headline plate renders in matching black for the cohesive engraved-invitation register. (T-528 composition templates also render the tagline in black — same canon.)
- **Accent color**: soft rose `#E5C0C7` — wedding-canonical pastel-pink-and-cream accent. Reserved for a small (~12 px diameter) centered soft-rose dot rendered between the headline plate and the couple-signature tagline as a punctuation divider — the dot is the wedding-canon emphasis motif, the engraved-invitation-bullet-dot tonal-neutral accent that reads correctly against every T-527 theme. NOT committed to a specific theme palette (NOT rustic burgundy, NOT modern sage, NOT classic gold) — soft rose is the final card's theme-neutral default. Production deployments MAY flip the dot color to a theme-specific accent at the binding-wire step; v1 ships the soft-rose theme-neutral default.
- **No fourth accent color, no atmospheric grain, no light-leaks.** The three-color palette (ivory canvas + black headline + black tagline + soft-rose punctuation dot) IS the final card's signature; adding a fourth hue dilutes the theme-agnostic neutrality and migrates the visual onto a specific theme overlay.
- **Layout** — centered full-frame title card with two stacked text slots. Headline plate centered ~80 px ABOVE the canvas vertical midline (`y: 280` at 1280×720); soft-rose punctuation dot centered at the canvas vertical midline (`y: 360`); couple-signature tagline centered ~80 px BELOW the canvas vertical midline (`y: 440`). The three elements stack vertically with the punctuation dot acting as the visual fulcrum. The headline plate + tagline both use the centered full-frame register (the `titleSequence` primitive's `'plate-and-credits'` style — same style bundle as T-528 composition templates' title slide + thank-you card).

The final card IS the wedding-broadcast outro canonical UX gesture — a 5-second full-frame title card with a "Thank You" headline and a couple-signature tagline that closes the composition with the engraved-invitation gravitas the wedding-events register demands.

## Typography

- **`preferredFont: GT Sectra`** (`proprietary-byo`). Same preferred family as the sister `wedding-bumper-card` AND T-528 composition templates AND T-520 / T-522 / T-523 / T-527 classic-theme. Cluster-F's type-design batch covers the cluster-wedding-events type sign-off by precedent. `signOff.typeDesign` MUST be `'pending-cluster-batch'` or `'signed:YYYY-MM-DD'`, NOT `'na'`.
- **`fallbackFont: Cormorant Garamond 600`** (`ofl`). Same OFL fallback as the full cross-cluster prestige-typography canon. Type-design consultant approval on the fallback path is pending the cluster-wedding-events type-design batch review per ADR-004 §D4.
- **Headline (`titlePlate.content.text`)**: Mixed Case at the snapshot string level — the canonical default for the final card is `'Thank You'` (signaling the composition outro / closing-gratitude moment). Rendered via `font: { family, weight: 700, size: 72, letterSpacing: -0.005 }` at the schema-prop level — 72 px matches the sister `wedding-bumper-card` headline scale and exceeds T-528 composition templates' 56 px (the bumpers are single-slot full-frame display registers vs the composition templates' plate-and-credits paired register).
- **Tagline (`titlePlate.content.tagline`)**: Plus Jakarta Sans 500 / 26 px — sans-serif body register for the couple-signature line, rendered slightly larger than T-528 composition templates' thank-you card tagline (24 px) and the title-slide tagline (22 px) for the closing-gratitude emphasis. The canonical default tagline content is `'With love, Eleanor & Thomas'` (matching T-528 wedding-ceremony-template shot 7). The serif-headline + sans-tagline split is the canonical typographic signature shared with T-520 / T-522 / T-523 / T-528 — same cross-cluster prestige-typography canon.
- **Casing transform**: `'as-is'` (default). Casing is applied at the snapshot-string level (Mixed Case headline, Mixed Case tagline) so the primitive's casing-transform layer is a no-op.
- **No italic, no underline, no strikethrough.** Wedding-broadcast typography never uses them — even the most formal engraved-invitation typography stays in Mixed Case sentence-case at varying sizes, not italic.

## Animation

- **Duration**: 5000 ms total — the final card occupies a single 5-second window in the composition timeline. Slower than the sister `wedding-bumper-card` (3000 ms) because the final card is the composition-closing outro card and warrants a longer hold for the reading + recognition + lingering-gratitude pass; faster than T-528 composition templates' per-shot ~5.4 s by a small margin (the final card is a single-shot 5000 ms hold; T-528 per-shot is ~5.4 s).
- **Choreography target (spec)** — leisurely wedding-broadcast lifecycle pacing across the full final-card window:
  - Fade-in 800 ms EASE_OUT_QUART (primitive default `entrance: 'fade'`) — matching T-528 composition templates' per-shot entrance for the consistent closing-gratitude pacing
  - Mid-hold 3600 ms — the bulk of the final-card window holds the full-opacity headline + punctuation dot + tagline for the reading + recognition + lingering pass
  - Fade-out 600 ms EASE_IN_QUART (transitionOut `'fade'`, synchronized 600 ms before the final card's `endMs`) — matching T-528 composition templates' per-shot exit
  - Total: 5000 ms — the leisurely outro pacing IS the wedding-broadcast outro canonical UX gesture
- **Mid-segment steady-state at frame 75** (cluster-norm; the parity-CLI's fixed 150-frame composition window for a 5000 ms @ 30 fps clip means frame 75 = 2500 ms falls cleanly in the final card's mid-hold window — 800 ms entrance + 3600 ms hold + 600 ms exit; frame 75 sits ~1700 ms into the mid-hold). At frame 75 the render captures the final card at full opacity with the headline plate, punctuation dot, AND couple-signature tagline all settled at their final positions.
- **No state-transition animation in v1.** State transitions (per-letter staggered entry, per-shot color-jumps, photographic-overlay tinting) belong to other style bundles and other clusters; the wedding-final-card register is the clean steady-state full-frame title-card register.

## Rules

- **Bound primitive**: `titleSequence` (cluster-D — T-321) bound via `PRESET_ID_BINDINGS` per Pattern C cross-cluster register reuse — same model T-520 / T-522 / T-523 / T-528 / sister `wedding-bumper-card` established. The `'titleSequence'` arm in `DEFAULT_CLIP_KIND_RESOLVER` stays UNCHANGED at the cluster-D squid-game-geometric clipKind-default (T-350); the wedding-final-card register threads via `PRESET_ID_BINDINGS['wedding-final-card']` at the binding-wire step. **Third cluster-wedding-events consumer of `titleSequence` primitive** after T-528 composition templates and sister `wedding-bumper-card`.
- **Cross-cluster register reuse: cluster-wedding-events preset binding cluster-D `titleSequence` primitive.** Same Pattern C model T-520 / T-522 / T-523 / T-528 / sister bumper established. Reusing the existing `titleSequence` primitive — rather than introducing a new `weddingFinalCard` cluster-wedding-events primitive — keeps the implementation surface small AND respects the structural-extension rule (§13 of CLAUDE.md): no new clipKind, no new degree-of-freedom on the document or binding model, just a new cluster-wedding-events preset binding an existing primitive. The visual register difference is captured in the snapshot constants (`WEDDING_FINAL_CARD_PROPS`) — same primitive, different props.
- **Theme-agnostic by design.** The final card runs the same visual register (champagne-ivory backdrop + black text + soft-rose punctuation dot) regardless of which T-527 theme variant (rustic / modern / classic) the deploy-time wiring overlays. Production deployments MAY flip the dot color to a theme-specific accent at the binding-wire step; v1 ships the theme-neutral defaults.
- **Use for composition outros specifically** — the wedding final card is reserved for the closing outro card at the END of a complete wedding-events composition (after the reception-recap arc concludes). Do not use as a mid-section pivot card (use sister `wedding-bumper-card` instead). Do not use as a per-shot section divider WITHIN a composition arc (use T-528 composition templates' lower-third sub-shots instead).
- **Mixed Case headline + Mixed Case tagline — NOT UPPERCASE for either.** UPPERCASE titles migrate the register onto broadcast-news (Sky News / ITV / RAI / CNN-breaking) territory entirely. Engraved-invitation typography is sentence-case Mixed Case across the wedding-broadcast register; the Mixed-Case-across-the-board register IS the wedding-broadcast typographic signature.
- **Soft-rose punctuation dot stays inside the punctuation slot.** The soft-rose `#E5C0C7` is reserved for the small (~12 px diameter) centered punctuation dot between the headline plate and the couple-signature tagline. NEVER paint the canvas rose. NEVER use the soft-rose for narrative text content.
- **Couple-signature tagline is editorially `'With love, <couple-names>'` or equivalent.** The canonical default is `'With love, Eleanor & Thomas'` matching T-528 wedding-ceremony-template shot 7. Production deployments MAY flip the tagline content at the binding-wire step (`'Forever yours, <couple>'`, `'<couple-names>'` solo, `'<date> · <couple-names>'`, etc.); v1 ships the canonical default.
- **No atmospheric overlays.** No optical grain, no light-leak, no dust-particle drift. The composition-card canvas IS the register; atmospheric overlays migrate the visual onto cluster-D prestige-TV title territory.
- **Designed for ceremony-recap + reception-recap wedding-video deliverables** — same legibility requirements as the cluster-A news-broadcaster register (headline ≥ 34 pt; primitive's 72 px exceeds substantially; tagline ≥ 18 pt; primitive's 26 px exceeds).
- **Reference frame for parity is mid-segment (frame 75)** per cluster-norm — single canonical variant capturing the final card at the 2500 ms mid-hold steady-state.

## Acceptance (parity)

One reference-frame fixture at `frame: 75` (mid-segment steady-state per cluster-norm; the parity-CLI's fixed 150-frame composition window for a 5000 ms @ 30 fps final card):

- `golden-frame-75.png` — the canonical wedding final card rendered as a centered full-frame title card on a champagne-ivory `#FFFAF0` full-bleed canvas; headline `'Thank You'` rendered at 72 px / fontWeight 700 / Cormorant Garamond OFL fallback / Mixed Case at canvas position (`x: 640, y: 280` at 1280×720); soft-rose `#E5C0C7` punctuation dot (~12 px diameter) rendered at canvas center (`x: 640, y: 360`); Mixed Case couple-signature tagline `'With love, Eleanor & Thomas'` rendered at 26 px / fontWeight 500 / Plus Jakarta Sans at canvas position (`x: 640, y: 440`); all three elements at full opacity (`opacity: 1`) at the steady-state mid-hold; no atmospheric overlays. Static layout (no animation; the `'plate-and-credits'` style renders all three visual elements at full opacity at the reference frame — no entrance / exit animation active).

Thresholds: **PSNR ≥ 42 dB**, **SSIM ≥ 0.98** (matches the cross-cluster norm). Hand-pinned via the F-4 generator-flag route `--psnr=42 --ssim=0.98 --mark-signed`.

## Trade-offs (v1 cosmetic divergences from the compass register)

- **Rendered family is `Cormorant Garamond 600` (OFL fallback), not the bespoke `GT Sectra` (proprietary BYO).** The `titleSequence` primitive's `font.family` prop IS wired into the rendered output, so the rendered family follows the binding's snapshot `font.family` value verbatim. The binding-wire step (cluster-wedding-events composer task) sets `font.family: 'Cormorant Garamond'` for the parity render; flipping to `'GT Sectra'` requires the bespoke font to be BYO-wired at deploy time. v1 ships the OFL fallback verbatim.
- **Soft-rose punctuation dot color `#E5C0C7` is the theme-neutral default, NOT a theme-specific accent.** The final card's theme-agnostic register pins the dot color to soft rose for the parity render; production deployments MAY flip the dot color to a theme-specific value at the binding-wire step. The parity-fixture captures the soft-rose default; theme-specific overlay parity is composer-task territory under a future `T-529a`-family follow-up.
- **Headline size 72 px matches sister `wedding-bumper-card`, NOT T-528 composition templates' 56 px.** The wedding-final-card register reads at a larger headline scale than the composition-template thank-you-card register because the bumper / final-card siblings are standalone single-shot full-frame title cards with no surrounding composition arc competing for screen real estate; the headline dominates the canvas. Production deployments with a 1920×1080 or 4K canvas can scale up via the binding override.
- **Tagline size 26 px, slightly larger than T-528 composition templates' thank-you card tagline (24 px) and title-slide tagline (22 px).** The closing-gratitude emphasis warrants a slightly larger tagline scale; the standalone single-shot full-frame register has the screen real estate to accommodate the larger tagline without competing layout slots.
- **`'plate-and-credits'` style overlap window pins both headline + tagline shots active at the reference frame.** Same overlap-window posture as T-528 composition templates' title-slide + thank-you card shots — the headline plate and the credits-block tagline overlap in their primitive `startMs` / `endMs` envelopes; at the reference frame both shots are active simultaneously. The primitive's `'plate-and-credits'` dispatch renders BOTH active shots layered (the headline plate above, the credits block beneath); the v1 parity render captures this two-shot overlap as the steady-state register.
- **Punctuation dot is a flat circle, NOT a photorealistic engraved-invitation bullet.** The dot renders as a flat soft-rose `#E5C0C7` ~12 px diameter circle, NOT a photorealistic engraved-invitation bullet composited as a PNG sprite. Photorealistic bullet compositing is composer-task territory under a future `T-529a`-family follow-up; v1 ships the flat-circle canonical default.
- **No `weddingMonogram` companion clip carved out.** Same posture as sister `wedding-bumper-card` and T-527 classic-theme + T-528 composition templates — a dedicated `weddingMonogram` primitive is a candidate primitive-level carve-out under the cluster-wedding-events compose-tools label; v1 reuses the cluster-D `titleSequence` primitive without the monogram-card.

## Out of scope

- Multi-card outro composition templates (e.g. a `'Thank You'` card → `'Photography Credits'` card → `'Music Credits'` card outro chain) — composer-task territory under a future `T-529a`-family follow-up; v1 ships the single-card preset only.
- Theme-specific parity overlays (rustic-theme variant, modern-theme variant, classic-theme variant of the final card) — sister cluster-wedding-events presets under a future `T-529a`-family follow-up; v1 ships the theme-neutral soft-rose default only.
- Photorealistic engraved-invitation-bullet compositing — composer-task territory under a future `T-529a`-family follow-up.
- Bespoke `GT Sectra` proprietary-byo wiring — production-fidelity preference, BYO-license-gated at deploy time. v1 ships the Cormorant Garamond OFL fallback for the parity render.
- Per-shot regression fixtures across the 5000 ms final-card window — captured in the cluster-wedding-events composer task downstream, NOT in T-529. v1 ships the mid-hold steady-state at frame 75 as the canonical parity reference frame.

## References

- The Knot / Brides / Martha Stewart Weddings / Vogue Weddings editorial wedding-films canon — the outro thank-you card conventions converge on the centered full-frame title-card with a couple-signature tagline
- ADR-004 (preset system contract)
- ADR-005 (frontier clip catalogue — titleSequence posture)
- ADR-012 §D2 (pack manifest schema — vertical-use-case cluster as a free-form `cluster` field)
- ADR-013 §D3 (paid-per-tenant commercial-subscription tier — cluster-wedding-events pack SKU `wedding-events-1y`)
- T-321 — `titleSequence` runtime-clip primitive (cluster-D; bound here for the final-card title-card register)
- T-348 — Stranger Things Benguiat preset (sister `titleSequence` consumer; cluster-D prestige-TV register — T-529 omits the atmospherics for the cluster-wedding-events register)
- T-360 — `PRESET_ID_BINDINGS` mechanism (binding path for non-default `titleSequence` consumers)
- T-520 — Prestige-creator cinematic title-card composition preset (sibling composition; cross-cluster register reuse precedent)
- T-522 — Earnings-call composition template (sibling composition; cross-cluster register reuse precedent)
- T-523 — Investor-deck composition template (sibling composition; cross-cluster register reuse precedent)
- T-526 — Wedding & Events Pack skeleton (this preset's parent pack; landed the four placeholder cluster-wedding-events preset slots)
- T-527 — Rustic / modern / classic theme variants substantive fill (sibling task; three theme variants the deploy-time wiring overlays at the binding-wire step)
- T-528 — Wedding-ceremony + wedding-reception composition templates (sibling task; the multi-shot compositions this final card closes)
- T-529 — Wedding-specific transitions + bumpers (this PR; closes the wedding-transitions placeholder slot)
- T-530 — Pre-licensed audio-bed library (sister cluster-wedding-events placeholder; closes the Wedding & Events Pack v0.2.0)

---
id: classic-theme
cluster: cluster-wedding-events
clipKind: lowerThird
source: traditional / ballroom-wedding compass register (vertical-use-case canon; no entry in docs/compass_artifact.md — the wedding-events cluster is vertical-oriented, not brand-oriented)
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
ownerTask: T-527
relatedTasks:
  - T-526
  - T-528
  - T-529
  - T-530
---

# Classic theme — wedding & events lower third

## Visual tokens
- Bar: ivory `#FFFAF0` fill — the canonical formal-ballroom / traditional-wedding backdrop tone for engraved-invitation signage and refined on-screen titles. Distinct from rustic-theme's warm taupe `#8B7355` (T-527 sister preset; warm-intimate-barn register) and modern-theme's off-white `#FAFAFA` (T-527 sister preset; clean-editorial-urban register); ivory is the classic-wedding cluster's signature, warmer-than-off-white and cooler-than-cream, the heavyweight-cardstock tone of engraved formal-wedding stationery and ballroom-banquet menu cards. The `LowerThird` primitive (T-183) accepts `background` as a single hex string with no opacity channel; v1 renders at 100 % opacity on the flat-color parity canvas. Classic-wedding production runs the bar at 100 % over ballroom-chandelier + formal-portrait B-roll for refined-formal posture — no production opacity tunable applies here (see "Trade-offs").
- Accent strip: champagne gold `#D4AF37` — rendered as a 6 px-wide flex child on the **left edge** of the composite (`borderRadius: 3`); this gold strip IS the classic-wedding emphasis color (formal-ballroom palette canon — gold on ivory = engraved-foil + heavyweight-cardstock palette). Never paint the full bar gold. Distinct from rustic-theme's burgundy `#7F1D1D` (warm-intimate emphasis) and modern-theme's muted sage `#84A98C` (botanical-greenery emphasis). The gold is a champagne tone (warm + slightly desaturated), NOT a bright yellow-gold — bright gold would migrate the visual off the refined-formal register onto a celebratory-decorative register.
- Headline color `#D4AF37` (champagne gold on ivory) — the canonical refined-formal reading on the ivory bar; champagne gold headline is the classic-wedding canon's signature for the couple-name slot, the engraved-foil tone of formal-invitation typography. NOTE: this is a textColor-equals-accent rendering — the only theme variant of the three where headline + accent share the SAME color (rustic: cream-on-taupe with burgundy strip; modern: dark-slate-on-off-white with sage strip; classic: champagne-gold-on-ivory with the gold strip MATCHING the headline). Subtitle color renders in `#D4AF37` (champagne gold — see "Trade-offs"; not an independently colorable channel-host token under the primitive's prop surface unless `subtitleColor` is wired).
- Emphasis token (Out of v1 scope at the primitive level): the spec calls for `#000000` (pure black) as the emphasis-text color for forward-referenced ceremony-emphasis lines (e.g. dates, RSVP). The `LowerThird` primitive (T-183) does not expose a separate emphasis-color prop; the v1 emphasis token is reserved for the wedding-events composition-template task (T-528) to wire through.
- Bar anchored bottom-left at `insetLeftPx: 64`, `insetBottomPx: 56` — matches the T-507 Sky News Pro asymmetric left-aligned anchor norm, shared with sister rustic-theme + modern-theme. Classic-wedding production canon places the title strip a touch above the lower-frame margin reserved for the venue-attribution + ceremony-officiant stack. Asymmetric left-aligned, NOT center-anchored — classic-wedding canon is engraved-invitation-third, not broadcast-strip. Center-anchored center-of-frame ceremonial cards (the formal-ballroom photographer's frame-center wedding-monogram card) are composition territory under T-528.
- Card auto-fits the headline against a `minWidth: 240` floor with `padding: '12px 20px'` and uniform `borderRadius: 6` — the primitive's default geometry reads correctly against the classic register. Classic-wedding production occasionally uses a softer rounded card (10–12 px) consistent with engraved cardstock with rounded edges; the primitive renders all four corners at uniform 6 px (see "Trade-offs").
- v1 uses the existing `LowerThird` primitive (T-183) prop surface: `background`, `accent`, `textColor`, `name`, `title`, `insetLeftPx`, `insetBottomPx`. Snapshot constants live in `CLASSIC_THEME_PROPS` (exported from `@stageflip/parity-cli` at the cluster sign-off step).

## Typography
- Headline (`name`): Mixed Case applied at the snapshot string level (`'Eleanor & Thomas'`). Rendered at the primitive's default 34 px / fontWeight 700 — within the classic-wedding register's 32–36 pt headline range. Mixed Case (NOT UPPERCASE) is the classic-wedding canon's signature for the couple-name slot — engraved-invitation typography uses sentence-case Mixed Case (`Eleanor & Thomas`, `The Hartfords`) consistently across heavyweight-cardstock invitation, ballroom-table place card, and ceremony-monogram backdrop. UPPERCASE titles would read as broadcast-news (T-507 / T-508 / T-509 register) and migrate the visual off the classic-wedding cluster entirely.
- Subtitle (`title`): Mixed Case ceremony-formal line (`'The Plaza Hotel, New York — September 12, 2026'`); rendered at 18 px / fontWeight 500. The ceremony-formal line is canonically Mixed Case + slightly tracked across classic-wedding signage; the primitive's hard-coded `letterSpacing: '0.02em'` on the title line approximates the engraved-formal tracking (see "Trade-offs" — the canonical engraved tracking is slightly wider).
- Rendered family v1: `Plus Jakarta Sans` (the primitive's hard-coded inline `fontFamily`). The bespoke `GT Sectra` (proprietary BYO; classic-wedding refined transitional serif used on engraved invitations — same family neighborhood as T-520 prestige-creator + T-522 earnings-call cross-cluster prestige-typography canon) and the OFL fallback `Cormorant Garamond 600` declared in frontmatter exist for the type-design batch review (sister wedding-events cluster composer task). The OFL fallback `Cormorant Garamond` is shared with T-520 prestige-creator + T-522 earnings-call + T-527 sister rustic-theme (transitional-serif family — refined-formal register typography canon). Adding a `font.family` prop to the `LowerThird` primitive remains a candidate `T-183z` primitive-level follow-up.
- Letter-spacing: the primitive hard-codes `letterSpacing: '-0.015em'` on the name (tight Mixed-Case headline) and `letterSpacing: '0.02em'` on the title (open ceremony-formal line). Classic-wedding engraved typography uses a wider tracking on the name (~0.0em to +0.01em range — refined-display tracking, NOT tight-display tracking like the primitive's default); the primitive's hard-coded tight name + open-context posture is the closest of the three theme variants to where the canonical engraved-formal register pulls AWAY from the primitive's default (see "Trade-offs").

## Animation
- Slide-in from the left over `ceil(fps * 1.0)` frames easing `EASE_OUT_QUART`; mid-shot hold; slide-out to the right over the last `ceil(fps * 0.8)` frames easing `EASE_IN_QUART` (per the `LowerThird` primitive contract from T-183). At 30 fps: ~1000 ms entrance, ~800 ms exit — classic-wedding pacing is the slowest of the three theme variants (rustic: 800/600, modern: 600/400), ceremonious-formal tempo consistent with slow-pan ballroom-chandelier B-roll and processional-walk-down-the-aisle footage.
- Steady-state mid-hold: `translatePct == 0`, `opacity == 1`. The parity golden captures this state at frame 105 (= 3500 ms @ 30 fps composition) — matches the classic-wedding 3.5-second mid-hold target.
- The spec's canonical classic pacing target is "1000 ms fade-in, 3.5-second mid-hold, 800 ms fade-out". The primitive's mid-hold is implicit — `translatePct` settles at 0 after frame `enterEnd` and stays there until `exitStart`; the composition's `durationInFrames` controls the total hold. The parity-fixture composition pins `durationInFrames` to 159 (= 5300 ms @ 30 fps = 1000 + 3500 + 800) by default; the 3.5-second mid-hold target falls out naturally from the composition's clip-envelope duration, not from a primitive-level prop.
- Fade-in is implicit in the primitive's opacity ramp (opacity interpolates 0→1 alongside the slide-in `translatePct`); the spec's "fade-in" reads as the opacity ramp synchronized with the slide-in entrance. v1 accepts the primitive's slide+fade entrance as the classic-wedding pacing target match. Pure fade-only entrance (no horizontal travel) is a candidate primitive-level follow-up under the `T-183z`-family label.

## Rules
- Use when a classic / formal / ballroom-wedding lower-third title register is called for — couple-name attribution cards, ceremony-formal lines, ballroom-toast attribution strips. Classic theme sits within the wedding-events vertical cluster next to T-527's rustic + modern theme variants. Choose classic theme for the refined-formal-ballroom-wedding register specifically.
- Do not use for broadcast-news contexts (use a Cluster A `lowerThird` preset).
- Do not use for sports-broadcast scoring-strip contexts (use a Cluster B `scoreBug` preset).
- Do not use for cinematic-tech-reviewer contexts (use a Cluster F preset).
- Do not use for earnings-call / investor-deck contexts (use a Cluster Finance preset — though the GT Sectra typography canon is shared with T-522 / T-523).
- Do not paint the full bar gold. The 6 px-wide champagne gold `#D4AF37` accent strip on the left is the emphasis color — pulling the bar to gold would over-saturate the refined-formal register onto a celebratory-decorative register entirely off the classic-wedding cluster.
- Do not substitute bright yellow-gold (`#FFD700` / similar) for the champagne gold. Bright gold migrates the visual onto a celebratory-decorative register; the champagne gold `#D4AF37` MUST stay desaturated.
- Mixed Case headline + Mixed Case ceremony-formal line — NOT UPPERCASE. Uppercase titles read as broadcast-news and migrate the visual onto Cluster A territory; the classic-wedding register is engraved-invitation-third.
- Do not substitute the gold strip for any other accent color across the classic register. The strip IS the engraved-foil emphasis and ties the chyron to the broader classic-wedding visual identity (chandelier-prism highlight, gold-leaf-monogram accent, engraved-cardstock-foil shimmer all share `#D4AF37`).
- Designed for classic-wedding on-air officiants + couple-name attribution across the ceremony + reception lifecycle — same legibility requirements as the Cluster A news-broadcaster register (subtitle ≥ 18 pt; primitive's 18 px default satisfies).

## Acceptance (parity)
- Reference frame: 105 (= 3500 ms @ 30 fps; steady-state mid-hold; bar + strip + headline + ceremony-formal line fully settled).
- PSNR ≥ 42 dB, SSIM ≥ 0.98 (hand-pinned per `parity-fixture-signoff.md` workflow per the F-4 follow-up flagged in T-359b — generator default 35 / 0.95 is overwritten on land; matches T-323 / T-507 / T-517 / T-518 / T-520 / T-522 cross-cluster norm).

## Trade-offs (v1 cosmetic divergences from the compass register)
- **Headline + subtitle text both render champagne gold.** The `LowerThird` primitive (T-183) uses `textColor` for the headline and `color: subtitleColor ?? accent` for the subtitle. With `textColor: '#D4AF37'`, `accent: '#D4AF37'`, and `subtitleColor` unset, both the couple-name headline and the ceremony-formal subtitle line read in champagne gold on the ivory bar — this is the canonical classic-wedding register (gold-on-ivory is the engraved-foil-on-cardstock canon). NO trade-off here for the headline color — this is the intended rendering, distinguishing classic theme from rustic + modern siblings (where the headline color is NOT the accent color).
- **Emphasis-text color (`#000000` pure black) is not wired through the primitive.** The spec calls for pure black as the emphasis-text color for forward-referenced ceremony-emphasis lines (dates, RSVP). The `LowerThird` primitive does not expose a separate emphasis-color prop; v1 ships without the emphasis-color rendering. Wiring an `emphasisColor` prop is a candidate `T-183z`-family follow-up — and the T-528 composition-template task is the natural consumer.
- **Rendered family is `Plus Jakarta Sans`, not the proprietary `GT Sectra` or the OFL fallback `Cormorant Garamond 600`.** The primitive hard-codes `fontFamily: 'Plus Jakarta Sans, sans-serif'`. The proprietary `GT Sectra` (BYO; classic-wedding refined transitional serif — same family neighborhood as T-520 / T-522 prestige-typography canon) and the OFL fallback `Cormorant Garamond` declared in frontmatter exist for the type-design batch review's evaluation of declared fonts and are not honored at render time. The Cormorant Garamond fallback is shared with T-520 prestige-creator + T-522 earnings-call + T-527 sister rustic-theme (transitional-serif family canon); wiring it through is a candidate `T-183z`-family follow-up — and the most-visible v1 divergence on this preset since the refined-formal register is typography-led.
- **Headline letter-spacing is `-0.015em`, not the canonical engraved-formal +0.00 to +0.01em range.** The primitive hard-codes `letterSpacing: '-0.015em'` on the name. Classic-wedding engraved typography uses near-zero or slightly-positive tracking on the headline (refined-display tracking, NOT tight-display tracking); v1 accepts the primitive's default. The visual cluster identity (ivory bar + gold strip + champagne-gold Mixed-Case typography) still reads correctly at -0.015em tracking — tighter than canon, but still classic-wedding registered against the rustic + modern siblings. Adding a `nameLetterSpacingEm?` prop is a candidate primitive-level follow-up under the `T-183z`-family label.
- **Uniform 6 px border radius, not the slightly-softer 10–12 px engraved-cardstock corners.** The primitive's card uses `borderRadius: 6` on all four corners. Classic-wedding engraved cardstock sometimes features slightly-softer rounded corners (~10–12 px) consistent with high-end cardstock cuts; v1 uses uniform 6 px — close to the canonical intent; the visual cluster identity reads correctly at 6 px uniform. Per-corner radii (or a higher-radius opt-in) is a candidate primitive-level follow-up under the same `T-183z`-family label.
- **Mid-hold duration is composition-controlled, not primitive-pinned.** The spec calls for a 3.5-second mid-hold between the 1000 ms entrance and 800 ms exit. The `LowerThird` primitive does not expose a mid-hold duration prop; the mid-hold falls out of the composition's `durationInFrames`. The parity-fixture composition pins `durationInFrames: 159` (= 5300 ms @ 30 fps) to match. Adding an explicit `holdDurationFrames` prop is a candidate primitive-level follow-up under the same label.

## Out of scope
- Gold-leaf monogram backdrop (the engraved gold-leaf couple-monogram backdrop card behind the title strip on classic-wedding broadcast cards) — semantically a separate wedding-events-cluster composition primitive, candidate T-528 composition-template territory.
- Wax-seal foil companion (the bottom-right gold-foil wax-seal badge that appears alongside the title strip on engraved-wedding intro cards) — composition territory, candidate T-528 sister preset IF Reviewer scrutiny demands.
- Animated curtain-reveal transition (the formal-ballroom curtain-reveal between scenes) — clipKind territory, candidate T-529 wedding-specific-transitions slot.
- Audio-bed pairing (the formal-ballroom-string-quartet underscore that pairs with the title strip on production cards) — pack-internal cross-cut, candidate T-530 audio-bed-library slot.
- Emphasis-text color (canonical pure-black `#000000` for ceremony-emphasis lines) — primitive-level cosmetic concern under the `T-183z`-family label; the most-visible structural gap on this preset (consumed by T-528 composition-template task).
- GT Sectra rendering (canonical proprietary BYO + Cormorant Garamond OFL fallback vs primitive's hard-coded Plus Jakarta Sans) — primitive-level typography concern under the `T-183z`-family label; the most-visible v1 divergence on this preset since the refined-formal register is typography-led.

## References
- ADR-004 (preset system contract)
- T-183 — `LowerThird` primitive (the chyron this preset wires)
- T-183z — `LowerThird` enhancement label (carries the `subtitleColor` / `font` / `emphasisColor` schema; rendered-CSS wiring is a downstream follow-up)
- T-323 — first `lowerThird` clipKind binding (`cnn-classic`, clipKind-default arm)
- T-325 — second `lowerThird` clipKind binding (`bbc-reith-dark`, first `PRESET_ID_BINDINGS` override; structural template for this preset)
- T-360 — `PRESET_ID_BINDINGS` mechanism (binding path for non-default `lowerThird` consumers)
- T-507 — Sky News Pro register (cluster-A lowerThird; same primitive, different brand palette)
- T-517 — MKBHD Pro register (cluster-F lowerThird; same primitive, cinematic-tech-reviewer register)
- T-520 — prestige-creator composition preset (cluster-F; shared GT Sectra + Cormorant Garamond transitional-serif typography neighborhood)
- T-522 — earnings-call composition template (cluster-finance; shared GT Sectra + Cormorant Garamond transitional-serif typography neighborhood — closest stylistic neighbor to classic theme by refined-formal typography canon)
- T-526 — Wedding & Events pack skeleton (this preset's parent pack; landed the four placeholder wedding-events-vertical preset slots)
- T-527 — Rustic / modern / classic theme variants substantive fill (this PR; three theme variants in one task; T-528 / T-529 / T-530 fill the remaining placeholder slots)

---
id: modern-theme
cluster: cluster-wedding-events
clipKind: lowerThird
source: minimalist / urban-loft-wedding compass register (vertical-use-case canon; no entry in docs/compass_artifact.md — the wedding-events cluster is vertical-oriented, not brand-oriented)
status: substantive
preferredFont:
  family: Plus Jakarta Sans
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
ownerTask: T-527
relatedTasks:
  - T-526
  - T-528
  - T-529
  - T-530
---

# Modern theme — wedding & events lower third

## Visual tokens
- Bar: off-white `#FAFAFA` fill — the canonical minimalist / urban-loft-wedding backdrop tone for editorial-wedding signage and clean-canvas on-screen titles. Distinct from rustic-theme's warm taupe `#8B7355` (T-527 sister preset; warm-intimate-barn register) and classic-theme's ivory `#FFFAF0` (T-527 sister preset; formal-ballroom register); off-white is the modern-wedding cluster's signature, cooler-than-ivory and warmer-than-pure-white, the gallery-card tone of contemporary urban-wedding paper-stock. The `LowerThird` primitive (T-183) accepts `background` as a single hex string with no opacity channel; v1 renders at 100 % opacity on the flat-color parity canvas. Modern-wedding production runs the bar at 100 % over urban-loft + natural-light B-roll for clean-editorial posture — no production opacity tunable applies here (see "Trade-offs").
- Accent strip: sage green `#84A98C` — rendered as a 6 px-wide flex child on the **left edge** of the composite (`borderRadius: 3`); this muted sage strip IS the modern-wedding emphasis color (botanical-greenery palette canon — sage on off-white = eucalyptus-bouquet + neutral-stationery palette). Never paint the full bar sage. Explicitly muted (NOT bright green) — bright-green accents would migrate the visual off the modern-minimalist register onto a generic-color-pop register. Distinct from rustic-theme's burgundy `#7F1D1D` (warm-intimate emphasis) and classic-theme's pure-black `#000000` (high-contrast formal emphasis).
- Headline color `#1F2937` (dark slate on off-white) — the highest-contrast neutral-toned reading on the off-white bar; dark slate is the modern-wedding canon's signature dark text, a near-black with a hint of blue undertone consistent with editorial-magazine typography. Subtitle color renders in `#84A98C` (sage — see "Trade-offs" below; not an independently colorable channel-host token under the primitive's prop surface unless `subtitleColor` is wired).
- Bar anchored bottom-left at `insetLeftPx: 64`, `insetBottomPx: 56` — matches the T-507 Sky News Pro asymmetric left-aligned anchor norm, shared with sister rustic-theme + classic-theme. Modern-wedding production canon places the title strip a touch above the lower-frame margin reserved for the venue-attribution + couple-name stack. Asymmetric left-aligned, NOT center-anchored — modern-wedding canon is editorial-gallery-third, not broadcast-strip.
- Card auto-fits the headline against a `minWidth: 240` floor with `padding: '12px 20px'` and uniform `borderRadius: 6` — the primitive's default geometry reads correctly against the modern register. Modern-wedding production occasionally uses a sharper rectangular card (0 px corner radius) consistent with gallery-print editorial cards; the primitive renders all four corners at uniform 6 px (see "Trade-offs").
- v1 uses the existing `LowerThird` primitive (T-183) prop surface: `background`, `accent`, `textColor`, `name`, `title`, `insetLeftPx`, `insetBottomPx`. Snapshot constants live in `MODERN_THEME_PROPS` (exported from `@stageflip/parity-cli` at the cluster sign-off step).

## Typography
- Headline (`name`): Mixed Case applied at the snapshot string level (`'Maya & Alex'`). Rendered at the primitive's default 34 px / fontWeight 700 — though the modern-theme canon calls for a LIGHTER weight (Plus Jakarta Sans 300, NOT 700 — minimalist register; see "Trade-offs"). Mixed Case (NOT UPPERCASE) is the modern-wedding canon's signature for the couple-name slot — editorial-minimalist signage uses sentence-case Mixed Case (`Maya & Alex`, `The Hendersons`) consistently across gallery-card invitation, venue-table card, and reception-backdrop. UPPERCASE titles would read as broadcast-news (T-507 / T-508 / T-509 register) and migrate the visual off the modern-wedding cluster entirely.
- Subtitle (`title`): Mixed Case venue-attribution line (`'The Wythe Hotel, Brooklyn — May 23, 2026'`); rendered at 18 px / fontWeight 500. The venue-attribution line is canonically Mixed Case + slightly tracked across modern-wedding signage; the primitive's hard-coded `letterSpacing: '0.02em'` on the title line approximates the editorial tracking.
- Rendered family v1: `Plus Jakarta Sans` (the primitive's hard-coded inline `fontFamily`). The OFL preferred `Plus Jakarta Sans 300` (light-weight; modern-minimalist canon) and the OFL fallback `Inter 300` declared in frontmatter exist for the type-design batch review (sister wedding-events cluster composer task). Plus Jakarta Sans IS the primitive's hard-coded family, so the family matches — only the rendered weight diverges from the preferred 300 (see "Trade-offs"). Adding a `font.weight` prop to the `LowerThird` primitive remains a candidate `T-183z` primitive-level follow-up.
- Letter-spacing: the primitive hard-codes `letterSpacing: '-0.015em'` on the name (tight Mixed-Case headline) and `letterSpacing: '0.02em'` on the title (open venue-attribution line). Modern-wedding editorial typography uses a similar tight-name + open-context posture — the primitive's defaults align cleanly with the modern register; this is the closest of the three theme variants to the primitive's hard-coded letter-spacing canon.

## Animation
- Slide-in from the left over `ceil(fps * 0.6)` frames easing `EASE_OUT_QUART`; mid-shot hold; slide-out to the right over the last `ceil(fps * 0.4)` frames easing `EASE_IN_QUART` (per the `LowerThird` primitive contract from T-183). At 30 fps: ~600 ms entrance, ~400 ms exit — modern-wedding pacing is the fastest of the three theme variants (rustic: 800/600, classic: 1000/800), clean-editorial tempo consistent with crisp gallery-cut transitions and natural-light footage.
- Steady-state mid-hold: `translatePct == 0`, `opacity == 1`. The parity golden captures this state at frame 75 (= 2500 ms @ 30 fps composition) — matches the modern-wedding 2.5-second mid-hold target.
- The spec's canonical modern pacing target is "600 ms fade-in, 2.5-second mid-hold, 400 ms fade-out". The primitive's mid-hold is implicit — `translatePct` settles at 0 after frame `enterEnd` and stays there until `exitStart`; the composition's `durationInFrames` controls the total hold. The parity-fixture composition pins `durationInFrames` to 105 (= 3500 ms @ 30 fps = 600 + 2500 + 400) by default; the 2.5-second mid-hold target falls out naturally from the composition's clip-envelope duration, not from a primitive-level prop.
- Fade-in is implicit in the primitive's opacity ramp (opacity interpolates 0→1 alongside the slide-in `translatePct`); the spec's "fade-in" reads as the opacity ramp synchronized with the slide-in entrance. v1 accepts the primitive's slide+fade entrance as the modern-wedding pacing target match. Pure fade-only entrance (no horizontal travel) is a candidate primitive-level follow-up under the `T-183z`-family label.

## Rules
- Use when a modern / minimalist / urban-loft-wedding lower-third title register is called for — couple-name attribution cards, venue-attribution lines, gallery-toast attribution strips. Modern theme sits within the wedding-events vertical cluster next to T-527's rustic + classic theme variants. Choose modern theme for the clean-editorial-urban-wedding register specifically.
- Do not use for broadcast-news contexts (use a Cluster A `lowerThird` preset).
- Do not use for sports-broadcast scoring-strip contexts (use a Cluster B `scoreBug` preset).
- Do not use for cinematic-tech-reviewer contexts (use a Cluster F preset).
- Do not use for earnings-call / investor-deck contexts (use a Cluster Finance preset).
- Do not paint the full bar sage. The 6 px-wide sage `#84A98C` accent strip on the left is the emphasis color — pulling the strip to dark slate (to recover a slate-subtitle stub spec) would destroy the botanical-greenery palette signal, and pulling the bar to sage would over-saturate the minimalist register.
- Do not substitute bright green (`#10B981` / similar) for the muted sage. Bright green migrates the visual onto a generic-color-pop register entirely off the modern-minimalist cluster. The sage `#84A98C` MUST stay muted.
- Mixed Case headline + Mixed Case venue-attribution line — NOT UPPERCASE. Uppercase titles read as broadcast-news and migrate the visual onto Cluster A territory; the modern-wedding register is editorial-gallery-third.
- Do not substitute the sage strip for any other accent color across the modern register. The strip IS the botanical-greenery emphasis and ties the chyron to the broader modern-wedding visual identity (eucalyptus-bouquet accent, neutral-stationery wash, natural-light-window highlight all share `#84A98C`).
- Designed for modern-wedding on-air officiants + couple-name attribution across the ceremony + reception lifecycle — same legibility requirements as the Cluster A news-broadcaster register (subtitle ≥ 18 pt; primitive's 18 px default satisfies).

## Acceptance (parity)
- Reference frame: 75 (= 2500 ms @ 30 fps; steady-state mid-hold; bar + strip + headline + venue-attribution line fully settled).
- PSNR ≥ 42 dB, SSIM ≥ 0.98 (hand-pinned per `parity-fixture-signoff.md` workflow per the F-4 follow-up flagged in T-359b — generator default 35 / 0.95 is overwritten on land; matches T-323 / T-507 / T-517 / T-518 cross-cluster norm).

## Trade-offs (v1 cosmetic divergences from the compass register)
- **Subtitle text renders sage, not dark slate.** The `LowerThird` primitive (T-183) renders the optional `title` line at `color: subtitleColor ?? accent`. With `accent: '#84A98C'` and `subtitleColor` unset, the venue-attribution line reads in sage on the off-white bar — the spec's canonical venue-attribution color is dark slate. v1 ships with the primitive's default subtitle-falls-back-to-accent rendering; setting `subtitleColor: '#1F2937'` would recover the canonical dark-slate venue-attribution line and is preferred at the wedding-events cluster composer task's binding-wire step. The trade-off here is conservative: v1 leaves the existing primitive call site unchanged from the placeholder shape. Same trade-off as T-507 / T-517 / T-518 / T-527 sister rustic-theme documented.
- **Rendered weight is 700 (primitive default), not the canonical 300 light-weight.** The primitive hard-codes `fontWeight: 700` on the headline. The modern-minimalist canon calls for a LIGHT weight (300) to read as editorial-magazine typography; the primitive's default 700 reads heavier than the canon. The OFL preferred Plus Jakarta Sans 300 + OFL fallback Inter 300 declared in frontmatter exist for the type-design batch review's evaluation. Wiring a `font.weight` prop into the primitive is a candidate `T-183z`-family follow-up. The visual cluster identity (off-white bar + sage strip + dark-slate Mixed-Case typography) still reads correctly at fontWeight 700 — heavier than canon, but still modern-minimalist registered against the rustic + classic siblings.
- **Uniform 6 px border radius, not the sharper rectangular 0 px corners.** The primitive's card uses `borderRadius: 6` on all four corners. Modern-wedding editorial cards sometimes feature pure rectangular corners (0 px) consistent with gallery-print posture; v1 uses uniform 6 px — close to the canonical intent; the visual cluster identity reads correctly at 6 px uniform. Per-corner radii (or a `borderRadius: 0` opt-in) is a candidate primitive-level follow-up under the same `T-183z`-family label.
- **Mid-hold duration is composition-controlled, not primitive-pinned.** The spec calls for a 2.5-second mid-hold between the 600 ms entrance and 400 ms exit. The `LowerThird` primitive does not expose a mid-hold duration prop; the mid-hold falls out of the composition's `durationInFrames`. The parity-fixture composition pins `durationInFrames: 105` (= 3500 ms @ 30 fps) to match. Adding an explicit `holdDurationFrames` prop is a candidate primitive-level follow-up under the same label.

## Out of scope
- Geometric-pattern backdrop banner (the linear-pattern backdrop card behind the title strip on modern-wedding broadcast cards) — semantically a separate wedding-events-cluster composition primitive, candidate T-528 composition-template territory.
- Sage-leaf decorative companion (the bottom-right eucalyptus-leaf badge that appears alongside the title strip on editorial-wedding intro cards) — composition territory, candidate T-528 sister preset IF Reviewer scrutiny demands.
- Animated swipe transition (the clean-cut horizontal swipe between scenes) — clipKind territory, candidate T-529 wedding-specific-transitions slot.
- Audio-bed pairing (the natural-light-piano-arpeggio underscore that pairs with the title strip on production cards) — pack-internal cross-cut, candidate T-530 audio-bed-library slot.
- Light-weight headline rendering (canonical Plus Jakarta Sans 300 vs primitive's hard-coded 700) — primitive-level cosmetic concern under the `T-183z`-family label; the most visible v1 divergence on this preset.

## References
- ADR-004 (preset system contract)
- T-183 — `LowerThird` primitive (the chyron this preset wires)
- T-183z — `LowerThird` enhancement label (carries the `subtitleColor` / `font` schema; rendered-CSS wiring is a downstream follow-up)
- T-323 — first `lowerThird` clipKind binding (`cnn-classic`, clipKind-default arm)
- T-325 — second `lowerThird` clipKind binding (`bbc-reith-dark`, first `PRESET_ID_BINDINGS` override; structural template for this preset)
- T-360 — `PRESET_ID_BINDINGS` mechanism (binding path for non-default `lowerThird` consumers)
- T-507 — Sky News Pro register (cluster-A lowerThird; same primitive, different brand palette)
- T-517 — MKBHD Pro register (cluster-F lowerThird; same primitive, cinematic-tech-reviewer register)
- T-518 — Vox-deluxe register (cluster-F lowerThird; same primitive, magazine-explainer register — closest stylistic neighbor to modern theme by light-weight + clean-canvas register)
- T-526 — Wedding & Events pack skeleton (this preset's parent pack; landed the four placeholder wedding-events-vertical preset slots)
- T-527 — Rustic / modern / classic theme variants substantive fill (this PR; three theme variants in one task; T-528 / T-529 / T-530 fill the remaining placeholder slots)

---
id: rustic-theme
cluster: cluster-wedding-events
clipKind: lowerThird
source: barn-wedding / countryside-wedding compass register (vertical-use-case canon; no entry in docs/compass_artifact.md — the wedding-events cluster is vertical-oriented, not brand-oriented)
status: substantive
preferredFont:
  family: Tan Pearl
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

# Rustic theme — wedding & events lower third

## Visual tokens
- Bar: warm taupe `#8B7355` fill — the canonical barn-wood / weathered-oak backdrop tone for countryside-wedding signage and on-screen titles. Distinct from the cluster-A near-black broadcaster bars (`#080f15` / `#000000` family per T-507 / T-323) and from cluster-F's pure-black MKBHD register (T-517 — `#000000`); the warm taupe is the rustic-wedding cluster's signature, halfway between mid-brown wood and aged-leather harness. The `LowerThird` primitive (T-183) accepts `background` as a single hex string with no opacity channel; v1 renders at 100 % opacity on the flat-color parity canvas. Rustic-wedding production runs the bar at 100 % over candlelit-reception B-roll for warm-intimate posture — no production opacity tunable applies here (see "Trade-offs").
- Accent strip: burgundy `#7F1D1D` — rendered as a 6 px-wide flex child on the **left edge** of the composite (`borderRadius: 3`); this burgundy strip IS the rustic-wedding emphasis color (wine-and-roses palette canon — burgundy on warm taupe = barn-banquet table-runner palette). Never paint the full bar burgundy. Distinct from MKBHD Red `#E63946` (T-517; cinematic-tech-reviewer coral) and Sky News Red `#E10600` (T-507; British broadcaster primary) — `#7F1D1D` is a deeper oxblood, the rustic-wedding canon.
- Headline color `#F5F1E8` (cream on taupe) — the highest-contrast warm-toned reading on the taupe bar; cream is the rustic-wedding canon's signature off-white, the cardstock tone of letterpress wedding invitations and barn-banner cotton. Subtitle color renders in `#7F1D1D` (burgundy — see "Trade-offs" below; not an independently colorable channel-host token under the primitive's prop surface unless `subtitleColor` is wired).
- Bar anchored bottom-left at `insetLeftPx: 64`, `insetBottomPx: 56` — matches the T-507 Sky News Pro asymmetric left-aligned anchor norm, intermediate between BBC Reith's `insetBottomPx: 48` (sits visually lowest) and CNN-Classic's `insetBottomPx: 64`. Rustic-wedding broadcast canon places the title strip a touch above the lower-frame margin reserved for the ceremony-officiant + couple-name attribution stack. Asymmetric left-aligned, NOT center-anchored — rustic-wedding canon is letterpress-card-third, not broadcast-strip.
- Card auto-fits the headline against a `minWidth: 240` floor with `padding: '12px 20px'` and uniform `borderRadius: 6` — the primitive's default geometry reads correctly against the rustic register. Rustic-wedding production occasionally uses a softer rounded card (8–10 px) consistent with hand-lettered banner cards; the primitive renders all four corners at uniform 6 px (see "Trade-offs").
- v1 uses the existing `LowerThird` primitive (T-183) prop surface: `background`, `accent`, `textColor`, `name`, `title`, `insetLeftPx`, `insetBottomPx`. Snapshot constants live in `RUSTIC_THEME_PROPS` (exported from `@stageflip/parity-cli` at the cluster sign-off step).

## Typography
- Headline (`name`): Mixed Case applied at the snapshot string level (`'Sarah & James'`). Rendered at the primitive's default 34 px / fontWeight 700 — within the rustic-wedding register's 32–36 pt headline range. Mixed Case (NOT UPPERCASE) is the rustic-wedding canon's signature for the couple-name slot — hand-lettered wedding signage uses sentence-case Mixed Case (`Sarah & James`, `The Wilsons`) consistently across letterpress invitation, signing-table card, and ceremony backdrop. UPPERCASE titles would read as broadcast-news (T-507 / T-508 / T-509 register) and migrate the visual off the rustic-wedding cluster entirely.
- Subtitle (`title`): Mixed Case ceremony-context line (`'Two Become One — June 14, 2026'`); rendered at 18 px / fontWeight 500. The ceremony-context line is canonically Mixed Case + slightly tracked across rustic-wedding signage; the primitive's hard-coded `letterSpacing: '0.02em'` on the title line approximates the hand-lettered tracking (see "Trade-offs" — the canonical letterpress tracking is slightly wider).
- Rendered family v1: `Plus Jakarta Sans` (the primitive's hard-coded inline `fontFamily`). The bespoke `Tan Pearl` (proprietary BYO; rustic-wedding hand-lettered serif used on letterpress invitations) and the OFL fallback `Cormorant Garamond 600` declared in frontmatter exist for the type-design batch review (sister wedding-events cluster composer task). The OFL fallback `Cormorant Garamond` is shared with T-520 prestige-creator + T-522 earnings-call (transitional-serif family — see "Trade-offs"). Adding a `font.family` prop to the `LowerThird` primitive remains a candidate `T-183z` primitive-level follow-up.
- Letter-spacing: the primitive hard-codes `letterSpacing: '-0.015em'` on the name (tight Mixed-Case headline) and `letterSpacing: '0.02em'` on the title (open ceremony-context line). Rustic-wedding hand-lettered typography uses a similar tight-name + open-context posture — the primitive's defaults align with the register; only the ceremony-context line's canonical letterpress tracking is slightly wider than the primitive can express without a carve-out (see "Trade-offs").

## Animation
- Slide-in from the left over `ceil(fps * 0.8)` frames easing `EASE_OUT_QUART`; mid-shot hold; slide-out to the right over the last `ceil(fps * 0.6)` frames easing `EASE_IN_QUART` (per the `LowerThird` primitive contract from T-183). At 30 fps: ~800 ms entrance, ~600 ms exit — rustic-wedding pacing is the slowest of the three theme variants (modern: 600/400, classic: 1000/800), warm-intimate tempo consistent with candlelit-reception B-roll and slow-pan ceremony footage.
- Steady-state mid-hold: `translatePct == 0`, `opacity == 1`. The parity golden captures this state at frame 90 (= 3000 ms @ 30 fps composition) — matches the rustic-wedding 3-second mid-hold target.
- The spec's canonical rustic pacing target is "800 ms fade-in, 3-second mid-hold, 600 ms fade-out". The primitive's mid-hold is implicit — `translatePct` settles at 0 after frame `enterEnd` and stays there until `exitStart`; the composition's `durationInFrames` controls the total hold. The parity-fixture composition pins `durationInFrames` to 132 (= 4400 ms @ 30 fps = 800 + 3000 + 600) by default; the 3-second mid-hold target falls out naturally from the composition's clip-envelope duration, not from a primitive-level prop.
- Fade-in is implicit in the primitive's opacity ramp (opacity interpolates 0→1 alongside the slide-in `translatePct`); the spec's "fade-in" reads as the opacity ramp synchronized with the slide-in entrance. v1 accepts the primitive's slide+fade entrance as the rustic-wedding pacing target match. Pure fade-only entrance (no horizontal travel) is a candidate primitive-level follow-up under the `T-183z`-family label.

## Rules
- Use when a rustic / barn-wedding / countryside-wedding lower-third title register is called for — couple-name attribution cards, ceremony-context lines, reception-toast attribution strips. Rustic theme sits within the wedding-events vertical cluster next to T-527's modern + classic theme variants. Choose rustic theme for the warm-intimate-barn-wedding register specifically.
- Do not use for broadcast-news contexts (use a Cluster A `lowerThird` preset like `sky-news-pro-register` T-507 / `itv-pro-register` T-508 / `cnn-classic` T-323 / `bbc-reith-dark` T-325).
- Do not use for sports-broadcast scoring-strip contexts (use a Cluster B `scoreBug` preset like `nba-pro-register` T-512 / `nfl-pro-register` T-513 / `mlb-register` T-514 / `f1-pro-register` T-515).
- Do not use for cinematic-tech-reviewer contexts (use a Cluster F preset like `mkbhd-pro-register` T-517 / `vox-deluxe-register` T-518 / `linus-tech-tips-pro-register` T-519).
- Do not use for earnings-call / investor-deck contexts (use a Cluster Finance preset like `earnings-call-template` T-522 / `investor-deck-template` T-523).
- Do not paint the full bar burgundy. The 6 px-wide burgundy `#7F1D1D` accent strip on the left is the emphasis color — pulling the strip to cream (to recover a cream-subtitle stub spec) would destroy the wine-and-roses palette signal, and pulling the bar to burgundy would over-saturate the warm-intimate register.
- Mixed Case headline + Mixed Case ceremony-context line — NOT UPPERCASE. Uppercase titles read as broadcast-news and migrate the visual onto Cluster A territory; the rustic-wedding register is letterpress-card-third.
- Do not substitute the burgundy strip for any other accent color across the rustic register. The strip IS the wine-and-roses emphasis and ties the chyron to the broader rustic-wedding visual identity (banquet table-runner accent, wax-seal envelope tone, candlelit-centerpiece highlight all share `#7F1D1D`).
- Designed for rustic-wedding on-air officiants + couple-name attribution across the ceremony + reception lifecycle — same legibility requirements as the Cluster A news-broadcaster register (subtitle ≥ 18 pt; primitive's 18 px default satisfies).

## Acceptance (parity)
- Reference frame: 90 (= 3000 ms @ 30 fps; steady-state mid-hold; bar + strip + headline + ceremony-context line fully settled).
- PSNR ≥ 42 dB, SSIM ≥ 0.98 (hand-pinned per `parity-fixture-signoff.md` workflow per the F-4 follow-up flagged in T-359b — generator default 35 / 0.95 is overwritten on land; matches T-323 / T-324 / T-325 / T-507 / T-508 / T-517 / T-518 cross-cluster norm).

## Trade-offs (v1 cosmetic divergences from the compass register)
- **Subtitle text renders burgundy, not cream.** The `LowerThird` primitive (T-183) renders the optional `title` line at `color: subtitleColor ?? accent`. With `accent: '#7F1D1D'` and `subtitleColor` unset, the ceremony-context line reads in burgundy on the taupe bar — the spec's canonical ceremony-context color is cream. v1 ships with the primitive's default subtitle-falls-back-to-accent rendering; setting `subtitleColor: '#F5F1E8'` would recover the canonical cream ceremony-context line and is preferred at the wedding-events cluster composer task's binding-wire step. The trade-off here is conservative: v1 leaves the existing primitive call site unchanged from the placeholder shape. Same trade-off as T-507 / T-517 / T-518 documented.
- **Rendered family is `Plus Jakarta Sans`, not the proprietary `Tan Pearl` or the OFL fallback `Cormorant Garamond 600`.** The primitive hard-codes `fontFamily: 'Plus Jakarta Sans, sans-serif'`. The proprietary `Tan Pearl` (BYO; rustic-wedding hand-lettered serif) and the OFL fallback `Cormorant Garamond` declared in frontmatter exist for the type-design batch review's evaluation of declared fonts and are not honored at render time. The Cormorant Garamond fallback is shared with T-520 prestige-creator and T-522 earnings-call (transitional-serif family); wiring it through is a candidate `T-183z`-family follow-up.
- **Ceremony-context letter-spacing is `0.02em`, not the canonical wider letterpress tracking.** The primitive hard-codes `letterSpacing: '0.02em'` on the title line. Rustic-wedding letterpress typography uses a slightly wider tracking (~0.04–0.06em range) on hand-set ceremony cards. v1 accepts the primitive's default; adding a `subtitleLetterSpacingEm?` prop is a candidate primitive-level follow-up under the `T-183z`-family label.
- **Uniform 6 px border radius, not the slightly-softer 8–10 px rounded corners.** The primitive's card uses `borderRadius: 6` on all four corners. Rustic-wedding hand-lettered banner cards sometimes feature slightly-softer rounded corners (~8–10 px) consistent with hand-cut cardstock; v1 uses uniform 6 px — close to the canonical intent; the visual cluster identity (taupe bar + burgundy strip + cream Mixed-Case typography) reads correctly at 6 px uniform. Per-corner radii (or a higher-radius opt-in) is a candidate primitive-level follow-up under the same `T-183z`-family label.
- **Mid-hold duration is composition-controlled, not primitive-pinned.** The spec calls for a 3-second mid-hold between the 800 ms entrance and 600 ms exit. The `LowerThird` primitive does not expose a mid-hold duration prop; the mid-hold falls out of the composition's `durationInFrames`. The parity-fixture composition pins `durationInFrames: 132` (= 4400 ms @ 30 fps) to match. Adding an explicit `holdDurationFrames` prop is a candidate primitive-level follow-up under the same label.

## Out of scope
- Hand-lettered backdrop banner (the cloth-banner backdrop card behind the title strip on rustic-wedding broadcast cards) — semantically a separate wedding-events-cluster composition primitive, candidate T-528 composition-template territory.
- Wax-seal envelope companion (the bottom-right envelope-seal badge that appears alongside the title strip on letterpress-wedding intro cards) — composition territory, candidate T-528 sister preset IF Reviewer scrutiny demands.
- Animated petal-fall transition (the rose-petal-fall animation between scenes) — clipKind territory, candidate T-529 wedding-specific-transitions slot.
- Audio-bed pairing (the candlelit-reception piano underscore that pairs with the title strip on production cards) — pack-internal cross-cut, candidate T-530 audio-bed-library slot.
- Mixed-case ceremony-context wide-tracking (canonical letterpress tracking ~0.04–0.06em vs primitive's hard-coded 0.02em) — primitive-level cosmetic concern under the `T-183z`-family label.

## References
- ADR-004 (preset system contract)
- T-183 — `LowerThird` primitive (the chyron this preset wires)
- T-183z — `LowerThird` enhancement label (carries the `subtitleColor` / `font` schema; rendered-CSS wiring is a downstream follow-up)
- T-323 — first `lowerThird` clipKind binding (`cnn-classic`, clipKind-default arm)
- T-325 — second `lowerThird` clipKind binding (`bbc-reith-dark`, first `PRESET_ID_BINDINGS` override; structural template for this preset)
- T-360 — `PRESET_ID_BINDINGS` mechanism (binding path for non-default `lowerThird` consumers)
- T-507 — Sky News Pro register (cluster-A lowerThird; same primitive, different brand palette)
- T-517 — MKBHD Pro register (cluster-F lowerThird; same primitive, cinematic-tech-reviewer register — structural template for this preset)
- T-518 — Vox-deluxe register (cluster-F lowerThird; same primitive, magazine-explainer register — palette inversion comparator)
- T-526 — Wedding & Events pack skeleton (this preset's parent pack; landed the four placeholder wedding-events-vertical preset slots)
- T-527 — Rustic / modern / classic theme variants substantive fill (this PR; three theme variants in one task; T-528 / T-529 / T-530 fill the remaining placeholder slots)

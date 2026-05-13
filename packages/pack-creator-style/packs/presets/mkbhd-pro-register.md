---
id: mkbhd-pro-register
cluster: cluster-f
clipKind: lowerThird
source: https://www.youtube.com/@MKBHD + channel wordmark canon (public reference; no entry in docs/compass_artifact.md)
status: substantive
preferredFont:
  family: MKBHD Display
  license: proprietary-byo
fallbackFont:
  family: Inter
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# MKBHD Pro — lower third

## Visual tokens
- Bar: solid black `#000000` fill — the canonical MKBHD studio backdrop, the visual signature carried across every tech-reviewer thumbnail and on-screen card in Marques Brownlee's catalog since the channel's premium-tech reposition. Pure black is the MKBHD register; near-black `#1A1A1A` belongs to the broadcast scoring-strip Cluster B (T-512..T-515), and `#080f15` is the `LowerThird` primitive's near-black default. The `LowerThird` primitive (T-183) accepts `background` as a single hex string with no opacity channel; v1 renders at 100 % opacity on the flat-color parity canvas. MKBHD production cards run the bar at 100 % over cinematic-tech B-roll for high-contrast cinematic posture — no production opacity tunable applies here (see "Trade-offs").
- Accent strip: MKBHD Red `#E63946` — rendered as a 6 px-wide flex child on the **left edge** of the composite (`borderRadius: 3`); this red strip IS the MKBHD brand identifier and ties the chyron to the channel-art highlight color. Never paint the full bar red. Distinct from Sky News Red `#E10600` (T-507; British broadcaster) by a half-step warmer hue — the MKBHD red leans coral against pure black, the Sky News red leans pure-primary against pure black.
- Headline color `#FFFFFF` (white on black) — the highest-contrast reading on the deep-black bar. Subtitle color renders in `#E63946` (MKBHD Red — see "Trade-offs" below; not an independently colorable channel-host token under the primitive's prop surface unless `subtitleColor` is wired).
- Bar anchored bottom-left at `insetLeftPx: 64`, `insetBottomPx: 56` — matches the T-507 Sky News Pro asymmetric left-aligned anchor norm, intermediate between BBC Reith's `insetBottomPx: 48` (sits visually lowest) and CNN-Classic's `insetBottomPx: 64`. MKBHD broadcast canon places the title strip a touch above the lower-frame margin reserved for the subscribe-prompt + product-on-table b-roll stack. Asymmetric left-aligned, NOT center-anchored — tech-reviewer canon is cinematic-third, not broadcast-strip.
- Card auto-fits the headline against a `minWidth: 240` floor with `padding: '12px 20px'` and uniform `borderRadius: 6` — the primitive's default geometry reads correctly against the MKBHD register. MKBHD broadcasts occasionally use a sharper rectangular card with no corner softening; the primitive renders all four corners at uniform 6 px (see "Trade-offs").
- v1 uses the existing `LowerThird` primitive (T-183) prop surface: `background`, `accent`, `textColor`, `name`, `title`, `insetLeftPx`, `insetBottomPx`. Snapshot constants live in `MKBHD_PRO_REGISTER_PROPS` (exported from `@stageflip/parity-cli` at the cluster sign-off step).

## Typography
- Headline (`name`): Mixed Case applied at the snapshot string level (`'iPhone 17 Pro Review'`). Rendered at the primitive's default 34 px / fontWeight 700 — within the cinematic-tech-reviewer register's 32–36 pt headline range. Mixed Case (NOT UPPERCASE) is the MKBHD register's signature for the title slot — the wordmark `MKBHD` is the only uppercase token on the card; tech reviews are themselves Mixed Case (product names follow the manufacturer's own casing, e.g. `iPhone 17 Pro`, `Pixel 10 Pro`, `MacBook Air M5`). UPPERCASE titles would read as broadcast-news (T-507 Sky News / T-508 ITV / T-509 RAI register) and migrate the visual off the cinematic-tech-reviewer cluster entirely.
- Subtitle (`title`): UPPERCASE channel/host name (`'MKBHD'`); rendered at 18 px / fontWeight 500. The channel wordmark is canonically uppercase + wide-tracked across every on-screen card in the catalog; the primitive's hard-coded `letterSpacing: '0.02em'` on the title line approximates the wordmark's wide tracking (see "Trade-offs" — the wordmark's production tracking is wider than the primitive's default).
- Rendered family v1: `Plus Jakarta Sans` (the primitive's hard-coded inline `fontFamily`). The bespoke `MKBHD Display` (proprietary BYO; the channel's bespoke display family used on-air) and the OFL fallback `Inter 700` declared in frontmatter exist for the type-design batch review (sister cluster-F composer task). Adding a `font.family` prop to the `LowerThird` primitive remains a candidate `T-183z` primitive-level follow-up — the prop already exists per T-183z schema (lines 55–65), but is not wired into the rendered output by the existing primitive's CSS without the carve-out work.
- Letter-spacing: the primitive hard-codes `letterSpacing: '-0.015em'` on the name (tight Mixed-Case headline) and `letterSpacing: '0.02em'` on the title (open uppercase channel-name). MKBHD broadcast typography uses a similar tight-name + open-wordmark posture — the primitive's defaults align with the register; only the wordmark's production tracking is wider than the primitive can express without a carve-out (see "Trade-offs").

## Animation
- Slide-in from the left over `ceil(fps * 0.45)` frames easing `EASE_OUT_QUART`; mid-shot hold; slide-out to the right over the last `ceil(fps * 0.35)` frames easing `EASE_IN_QUART` (per the `LowerThird` primitive contract from T-183). At 30 fps: ~450 ms entrance, ~350 ms exit — tech-reviewer pacing is the BBC humanist tempo, slower than broadcast-news scoring-strip pacing (T-512 NBA Pro's 350 ms / 250 ms).
- Steady-state mid-hold: `translatePct == 0`, `opacity == 1`. The parity golden captures this state at frame 60 (= 2000 ms @ 30 fps composition) — matches T-507 / T-508 / T-509 / T-512 / T-513 / T-514 / T-515 cross-cluster lower-third + score-bug parity-fixture frame-pinning norm.
- The spec's canonical MKBHD pacing target is "450 ms in, 3-second mid-hold, 350 ms out". The primitive's mid-hold is implicit — `translatePct` settles at 0 after frame `enterEnd` and stays there until `exitStart`; the composition's `durationInFrames` controls the total hold. The parity-fixture composition pins `durationInFrames` to 90 (= 3000 ms @ 30 fps) by default; the 3-second mid-hold target falls out naturally from the composition's clip-envelope duration, not from a primitive-level prop.
- Fade-in is implicit in the primitive's opacity ramp (lines 107–118: opacity interpolates 0→1 alongside the slide-in `translatePct`); the spec's "fade-in" reads as the opacity ramp synchronized with the slide-in entrance. v1 accepts the primitive's slide+fade entrance as the MKBHD pacing target match. Pure fade-only entrance (no horizontal travel) is a candidate primitive-level follow-up under the `T-183z`-family label.

## Rules
- Use when a premium-tech-reviewer cinematic-third title register is called for — product-review intro cards, channel-host attribution, cinematic-tech-B-roll title strips. MKBHD Pro register sits within Cluster F's creator-economy family next to T-518 Vox-deluxe (still placeholder), T-519 Linus-Tech-Tips-pro (still placeholder), T-520 prestige-creator composition preset (still placeholder). Choose MKBHD Pro for the premium-tech-reviewer cinematic register specifically.
- Do not use for broadcast-news contexts (use a Cluster A `lowerThird` preset like `sky-news-pro-register` T-507 / `itv-pro-register` T-508 / `rai-pro-register` T-509 / `cnn-classic` T-323 / `bbc-reith-dark` T-325).
- Do not use for sports-broadcast scoring-strip contexts (use a Cluster B `scoreBug` preset like `nba-pro-register` T-512 / `nfl-pro-register` T-513 / `mlb-register` T-514 / `f1-pro-register` T-515).
- Do not paint the full bar red. The 6 px-wide MKBHD Red `#E63946` accent strip on the left is the brand identifier — pulling the strip to white (to recover a white-subtitle stub spec) would destroy the brand signal, and pulling the bar to red would saturate the cinematic register.
- Mixed Case headline + UPPERCASE channel wordmark — NOT both uppercase. Uppercase headlines read as broadcast-news and migrate the visual onto Cluster A territory; the MKBHD register is cinematic-tech-reviewer.
- Do not substitute the red strip for any other accent color. The strip IS the brand mark and ties the chyron to MKBHD's broader on-air identity (channel-art highlight, subscribe-prompt accent, end-card chevron all use the same `#E63946`).
- Designed for cinematic-tech-reviewer on-air talent and product-title identification across the full MKBHD catalog — same legibility requirements as the Cluster A news-broadcaster register (subtitle ≥ 18 pt; primitive's 18 px default satisfies).

## Acceptance (parity)
- Reference frame: 60 (= 2000 ms @ 30 fps; steady-state mid-hold; bar + strip + headline + wordmark fully settled).
- PSNR ≥ 42 dB, SSIM ≥ 0.98 (hand-pinned per `parity-fixture-signoff.md` workflow per the F-4 follow-up flagged in T-359b — generator default 35 / 0.95 is overwritten on land; matches T-323 / T-324 / T-325 / T-333 / T-334 / T-335 / T-358 / T-359 / T-360 / T-507 / T-508 / T-509 / T-512 / T-513 / T-514 / T-515 cross-cluster norm).

## Trade-offs (v1 cosmetic divergences from the compass register)
- **Subtitle text renders red, not white.** The `LowerThird` primitive (T-183) renders the optional `title` line at `color: subtitleColor ?? accent` (lower-third.tsx:91). With `accent: '#E63946'` and `subtitleColor` unset, the wordmark reads in MKBHD Red on the black bar — the spec's canonical wordmark color is white. v1 ships with the primitive's default subtitle-falls-back-to-accent rendering; setting `subtitleColor: '#FFFFFF'` would recover the canonical white wordmark and is preferred at the cluster-F composer task's binding-wire step. The trade-off here is conservative: v1 leaves the existing primitive call site unchanged from the placeholder shape. Same trade-off as T-507 Sky News + T-323 CNN-Classic + T-325 BBC-Reith-Dark documented.
- **Rendered family is `Plus Jakarta Sans`, not the proprietary `MKBHD Display` or the OFL fallback `Inter 700`.** The primitive hard-codes `fontFamily: 'Plus Jakarta Sans, sans-serif'` (line 88). The proprietary `MKBHD Display` (BYO) and the OFL fallback `Inter` declared in frontmatter exist for the type-design batch review's evaluation of declared fonts and are not honored at render time. The primitive's `font.family` prop (T-183z, lines 55–65) is wired into the schema but the rendered CSS does not yet use it; wiring it through is a candidate `T-183z`-family follow-up under the same label.
- **Wordmark letter-spacing is `0.02em`, not the production wider tracking.** The primitive hard-codes `letterSpacing: '0.02em'` on the title line. MKBHD's production wordmark uses a wider tracking (~0.08–0.12em range) on the channel's on-air cards. v1 accepts the primitive's default; adding a `subtitleLetterSpacingEm?` prop is a candidate primitive-level follow-up under the `T-183z`-family label.
- **Uniform 6 px border radius, not pure-rectangular sharp corners.** The primitive's card uses `borderRadius: 6` on all four corners. MKBHD's broadcast title strips occasionally feature pure rectangular cards with no corner softening (cinematic-tech-reviewer aesthetic); v1 uses uniform 6 px — close to the canonical intent; the visual cluster identity (black bar + red strip + Mixed-Case typography) reads correctly at 6 px uniform. Per-corner radii (or a `borderRadius: 0` opt-in) is a candidate primitive-level follow-up under the same `T-183z`-family label.
- **Mid-hold duration is composition-controlled, not primitive-pinned.** The spec calls for a 3-second mid-hold between the 450 ms entrance and 350 ms exit. The `LowerThird` primitive does not expose a mid-hold duration prop; the mid-hold falls out of the composition's `durationInFrames`. The parity-fixture composition pins `durationInFrames: 90` (= 3000 ms @ 30 fps) to match. Adding an explicit `holdDurationFrames` prop is a candidate primitive-level follow-up under the same label.

## Out of scope
- Subscribe-prompt companion (the bottom-right channel-subscribe badge that appears alongside the title strip on MKBHD on-air cards) — semantically a separate cluster-F `subscribeButton` primitive (already exists per `subscribe-button.tsx` in frame-runtime-bridge); composition territory, candidate `T-517a` sister preset IF Reviewer scrutiny demands.
- End-card chevron animation (the right-edge red chevron that animates in on outro cards) — primitive-level animation enum addition, candidate `T-183z` follow-up.
- Product-name uppercase override (the optional UPPERCASE product-name register used on some MKBHD review intros, e.g. `IPHONE 17 PRO REVIEW`) — per-preset binding override; the snapshot uses the canonical Mixed Case register (`iPhone 17 Pro Review`).
- Animated brand-strip pulse (the 6 px red strip pulsing during cinematic transitions) — primitive-level animation enum addition under the same `T-183z`-family label.
- Wide-tracked wordmark rendering (production tracking ~0.08–0.12em vs primitive's hard-coded 0.02em) — primitive-level cosmetic concern under the `T-183z`-family label.

## References
- https://www.youtube.com/@MKBHD — canonical MKBHD YouTube channel (wordmark canon observed: pure black backdrop + `#E63946` red highlight + uppercase wide-tracked `MKBHD` wordmark)
- ADR-004 (preset system contract)
- T-183 — `LowerThird` primitive (the chyron this preset wires)
- T-183z — `LowerThird` enhancement label (carries the `subtitleColor` / `font` schema; rendered-CSS wiring is a downstream follow-up)
- T-323 — first `lowerThird` clipKind binding (`cnn-classic`, clipKind-default arm)
- T-325 — second `lowerThird` clipKind binding (`bbc-reith-dark`, first `PRESET_ID_BINDINGS` override; structural template for this preset)
- T-360 — `PRESET_ID_BINDINGS` mechanism (binding path for non-default `lowerThird` consumers)
- T-507 — Sky News Pro register (sister cluster-A lowerThird; closest stylistic neighbor — same primitive, same anchor pattern, different brand palette)
- T-516 — Creator Style pack skeleton (this preset's parent pack; landed the four placeholder cluster-F preset slots)
- T-517 — MKBHD Pro register substantive fill (this PR; first of three register slots; T-518 Vox-deluxe + T-519 Linus-Tech-Tips-pro fill the remaining register slots; T-520 fills the prestige-creator composition preset)

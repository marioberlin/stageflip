---
id: rai-pro-register
cluster: cluster-a
clipKind: lowerThird
source: https://www.rai.it/ + Wikipedia "TG1" / "Rai 1" (public reference; no entry in docs/compass_artifact.md)
status: substantive
preferredFont:
  family: Helvetica Neue (RAI variant)
  license: proprietary-byo
fallbackFont:
  family: Plus Jakarta Sans
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# RAI Pro — lower third

## Visual tokens
- Bar: solid RAI / TG1 blue `#003F88` fill — the canonical Italian-state-broadcaster register and the distinguishing trait of the RAI register vs Sky News (black) / ITV (white) / BBC Reith (black) / CNN-Classic (black). Italian-state-broadcaster register sits adjacent to BBC's humanist authority but with European-state-broadcaster institutional weight — formal, traditional, distinct from UK and US broadcaster registers. The deep navy blue provides high-contrast scaffolding for the white brand strip and white text. As with the Sky / ITV / BBC / CNN consumers, the `LowerThird` primitive (T-183) accepts `background` as a single hex string with no opacity channel; v1 renders at 100 % opacity. RAI / TG1 production broadcasts commonly run the bar at ~90 % opacity over footage for legibility; on a flat-color parity canvas the solid blue reads correctly at 100 % (see "Trade-offs").
- Accent strip: white `#FFFFFF` — rendered as a 6 px-wide flex child on the **left edge** of the composite (`borderRadius: 3`); the inverse register from Sky / BBC / ITV (colored-strip-on-neutral-bar). RAI's broadcast canon is blue-bar-with-white-strip — the white strip provides the brand-mark separation on the saturated blue field. Never paint the full bar white.
- Headline color `#FFFFFF` (white on RAI blue — distinguishes RAI from ITV where text is dark on white, and matches Sky / BBC / CNN's white-on-dark posture); subtitle color renders in `#FFFFFF` (white — see "Trade-offs" below; the accent-driven subtitle color happens to match the headline color in this preset because both the strip and the subtitle pick from the same `accent` value).
- Bar anchored bottom-left at `insetLeftPx: 64`, `insetBottomPx: 60` — between ITV's `insetBottomPx: 52` and CNN-Classic's `insetBottomPx: 64`, slightly higher than Sky News's `insetBottomPx: 56` and BBC Reith's `insetBottomPx: 48`. RAI / TG1 broadcast canon places the bar lower in the frame, leaving room above for the TG1 logo + crawl-companion content.
- Card auto-fits the headline against a `minWidth: 240` floor with `padding: '12px 20px'` and uniform `borderRadius: 6` (RAI / TG1 broadcasts often use a sharper left edge against the white strip with a slightly rounder right edge; the primitive renders all four corners uniform — see "Trade-offs").
- v1 uses the existing `LowerThird` primitive (T-183) prop surface: `background`, `accent`, `textColor`, `name`, `title`, `insetLeftPx`, `insetBottomPx`. Snapshot constants live in `RAI_PRO_REGISTER_PROPS` (exported from `@stageflip/parity-cli` at the cluster sign-off step).

## Typography
- Headline (`name`): Mixed Case applied at the snapshot string level (`'Giorgio Zanchini'`). Rendered at the primitive's default 34 px / fontWeight 700 — close to the broadcast register's 32–34 pt range. Mixed Case (NOT UPPERCASE) is the European-state-broadcaster register's signature; UPPERCASE would read as American-tabloid, contrary to RAI / TG1's formal-institutional voice (adjacent to BBC's humanist register but with European-state-broadcaster authority).
- Subtitle (`title`): Mixed Case (`'Conduttore TG1'`); rendered at 18 px / fontWeight 500. Italian-language presenter role meaning "TG1 Anchor"; ASCII-only; full coverage in the Plus Jakarta Sans fallback. The Italian role copy reinforces the Italian-state-broadcaster register beyond the visual cue of the blue bar.
- Rendered family v1: `Plus Jakarta Sans` (the primitive's hard-coded inline `fontFamily`). The bespoke `Helvetica Neue (RAI variant)` (proprietary BYO) and the OFL fallback `Plus Jakarta Sans 700` declared in frontmatter exist for the type-design batch review (sister cluster-A composer task) — the OFL fallback happens to match the primitive's hard-coded family in this case, so the rendered family is faithful to the declared fallback. Adding a `font.family` prop to the `LowerThird` primitive remains a candidate `T-183z` primitive-level follow-up.
- Letter-spacing: the primitive hard-codes `letterSpacing: '-0.015em'` on the name and `letterSpacing: '0.02em'` on the title. RAI / TG1 broadcast typography uses a similar tight-name + open-subtitle posture, so the primitive's defaults align with the register without divergence.

## Animation
- Slide-in from the left over `ceil(fps * 0.45)` frames easing `EASE_OUT_QUART`; mid-shot hold; slide-out to the right over the last `ceil(fps * 0.35)` frames easing `EASE_IN_QUART` (per the `LowerThird` primitive contract from T-183). At 30 fps: ~450 ms entrance, ~350 ms exit.
- Steady-state mid-hold: `translatePct == 0`, `opacity == 1`. The parity golden captures this state at frame 60 (= 2000 ms @ 30 fps composition).
- RAI / TG1 broadcast canon shares the slide-in-from-left entrance choreography with the BBC + CNN + Sky News + ITV registers; the timing constants (450 ms entrance / 350 ms exit) match the primitive's default contract.
- Animated decorations from the broadcast register — TG1 logo bug, crawl scroll, breaking-news (edizione straordinaria) white-strip flash — are deferred (see "Out of scope").

## Rules
- Use when a formal, European-state-broadcaster register is called for — on-air talent identification, presenter / role chyrons, contributor attribution with an Italian-state-broadcaster visual identity (RAI / TG1). RAI register sits adjacent to BBC Reith's humanist authority but with European-state-broadcaster institutional weight — choose RAI Pro for formal, traditional broadcaster tone with an Italian-state register that distinguishes from UK (Sky / BBC / ITV) and US (CNN / Fox) broadcasters.
- Do not use for breaking-news / urgent-alert contexts (use a `breakingBanner`-clipKind preset like `cnn-breaking` or `fox-news-alert`).
- Do not paint the full bar white. The 6 px-wide white `#FFFFFF` accent strip on the left against the RAI blue bar is the brand identifier — pulling the strip to blue (to collapse the register into a single-color block) would destroy the brand signal.
- Mixed Case (NOT UPPERCASE) for both headline and subtitle. UPPERCASE breaks the European-state-broadcaster register and migrates the visual onto American-tabloid territory (CNN's UPPERCASE chevron).
- Do not substitute the RAI / TG1 blue `#003F88` for a brighter / lighter blue. The deep navy is the canonical TG1 broadcast color; lighter blues (e.g., Sky-Blue, Periwinkle) read as a separate channel identity and break the RAI register.
- Designed for live-news on-air talent identification across the full RAI / TG1 broadcast day — same legibility requirements as Sky News + ITV + BBC Reith (subtitle ≥ 18 pt; primitive's 18 px default satisfies).

## Acceptance (parity)
- Reference frame: 60 (= 2000 ms @ 30 fps; steady-state mid-hold; bar + strip + headline + subtitle fully settled).
- PSNR ≥ 42 dB, SSIM ≥ 0.98 (hand-pinned per `parity-fixture-signoff.md` workflow per the F-4 follow-up flagged in T-359b — generator default 35 / 0.95 is overwritten on land; matches T-323 / T-324 / T-325 / T-358 / T-359 / T-360 / T-507 / T-508 cross-cluster norm).

## Trade-offs (v1 cosmetic divergences from the compass register)
- **Subtitle text renders white, matching the headline color rather than a contrasting secondary tone.** The `LowerThird` primitive (T-183) renders the optional `title` line at `color: accent` (lower-third.tsx:129). With `accent: '#FFFFFF'` the subtitle reads in white on the RAI blue bar — happening to match the headline color. Broadcast canon for RAI / TG1 commonly places the subtitle in a lighter secondary tone (light-blue tint or off-white) against the blue bar, distinct from the headline color. Painting `accent` to a secondary tone would also paint the left-edge strip to that tone, killing the white-strip brand signal against the blue bar. v1 accepts the white subtitle text on the blue bar — still legible at fontSize 18 against `#003F88` (white-on-deep-navy is high-contrast) and the secondary-tone separation is a v2 concern. Allowing independent strip-vs-subtitle coloring (e.g., a new `subtitleColor?` prop) is a candidate primitive-level follow-up under the `T-183z`-family label — same trade-off T-323 + T-325 + T-507 + T-508 documented as D-T323-5 / D-T325 trade-off 1 / D-T507 trade-off 1 / D-T508 trade-off 1.
- **Rendered family is `Plus Jakarta Sans`, not the proprietary `Helvetica Neue (RAI variant)`.** The primitive hard-codes `fontFamily: 'Plus Jakarta Sans, sans-serif'` (lines 112, 126). The OFL fallback declared in frontmatter happens to match the hard-coded family for this preset, so the rendered family is faithful to the declared fallback — a quiet upgrade vs BBC + CNN where the declared OFL family diverged from the rendered family, and matching the T-507 Sky News + T-508 ITV posture. The proprietary `Helvetica Neue (RAI variant)` (BYO) declared in frontmatter exists for the type-design batch review's evaluation of declared fonts and is not honored at render time.
- **Uniform 6 px border radius, not asymmetric sharp-left / rounded-right corners.** The primitive's card uses `borderRadius: 6` on all four corners. RAI / TG1 broadcast lower-thirds occasionally feature a sharper left edge against the white strip with a slightly rounder right edge; v1 uses uniform 6 px — close to the canonical intent; the visual cluster identity (blue bar + white strip + Mixed-Case typography + white text) reads correctly at 6 px uniform. Asymmetric corner radii (e.g., `borderRadiusTopRightPx`) is a candidate primitive-level follow-up under the same `T-183z`-family label.
- **Background opacity rendered at 100 %, not the production ~90 %.** The primitive's `background` prop accepts a single hex string with no opacity channel. Pre-blending against an assumed canvas color is wrong on arbitrary footage; the 90 % spec is a production-time tunable for video-overlay legibility. v1 parity renders at 100 % on the flat-color parity canvas. Adding a `backgroundOpacity?` prop is a candidate primitive-level follow-up under the same `T-183z`-family label.

## Out of scope
- TG1 logo bug (persistent TG1 channel-bug graphic in the lower-right or upper-right of the frame during news programming) — primitive-level concern; the `LowerThird` primitive does not expose a `channelBug` slot. Sister `imageOverlay` composition territory, candidate `T-509a` IF Reviewer scrutiny demands.
- Crawl / ticker companion below the bar — semantically a `newsTicker`-clipKind preset; T-510 (News Pro premium news-ticker) covers the pack's ticker register.
- Breaking-news ("edizione straordinaria") white-strip flash (the strip pulsing during urgent on-air moments) — primitive-level animation enum addition, candidate `T-509b` IF Reviewer scrutiny demands.
- Asymmetric corner radii (sharp left against the strip; rounder right) — primitive-level cosmetic concern under the `T-183z`-family label.
- Sister Italian-state-broadcaster registers (Rai 2 / Rai 3 / TG2 / TG3 / TGR) — separate-channel-identity preset candidates; out of scope for the current TG1-targeted RAI register v1.

## References
- https://www.rai.it/ — canonical RAI website (brand colors observed in production: `#003F88` RAI / TG1 blue + white)
- Wikipedia "TG1" — TG1 (Telegiornale 1) broadcast brand history and on-air register notes
- Wikipedia "Rai 1" — Rai 1 channel brand identity and visual register
- ADR-004 (preset system contract)
- T-183 — `LowerThird` primitive (the chyron this preset wires)
- T-323 — first `lowerThird` clipKind binding (`cnn-classic`, clipKind-default arm)
- T-325 — second `lowerThird` clipKind binding (`bbc-reith-dark`, first `PRESET_ID_BINDINGS` override; structural template for this preset)
- T-360 — `PRESET_ID_BINDINGS` mechanism (binding path for non-default `lowerThird` consumers)
- T-506 — News Pro pack skeleton (this preset's parent pack; landed the three placeholder register slots)
- T-507 — Sky News register substantive fill (first of three register slots; structural template for this preset)
- T-508 — ITV register substantive fill (second of three register slots; structural template for this preset)
- T-509 — RAI register substantive fill (this PR; third + final of three register slots; T-510 fills the news-ticker)

---
id: itv-pro-register
cluster: cluster-a
clipKind: lowerThird
source: https://news.itv.com/ + Wikipedia "ITV News" (post-2022 ITVx rebrand; public reference; no entry in docs/compass_artifact.md)
status: substantive
preferredFont:
  family: ITV Reem
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

# ITV Pro — lower third

## Visual tokens
- Bar: solid white `#FFFFFF` fill — the distinguishing trait of the modern ITVx register vs Sky News (black) / BBC Reith (black) / CNN-Classic (black). Friendlier than Sky News's authoritative-broadcaster posture, less formal than BBC Reith's humanist authority. The white bar provides a high-contrast scaffolding for the ITVx magenta brand strip and dark text. As with the BBC + CNN + Sky News consumers, the `LowerThird` primitive (T-183) accepts `background` as a single hex string with no opacity channel; v1 renders at 100 % opacity. ITV News production broadcasts commonly run the bar at ~90 % opacity over footage for legibility; on a flat-color parity canvas the solid white reads correctly at 100 % (see "Trade-offs").
- Accent strip: ITVx magenta `#E8118E` — rendered as a 6 px-wide flex child on the **left edge** of the composite (`borderRadius: 3`); this magenta strip IS the modern ITVx brand identifier. Never paint the full bar magenta. Older ITV News (pre-2022) used yellow `#FFCC00`; the modern register uses the magenta and v1 targets the current-day broadcast.
- Headline color `#1A1A1A` (near-black on white — distinguishes ITV from Sky / BBC / CNN where text is white on dark); subtitle color renders in `#E8118E` (ITVx magenta — see "Trade-offs" below; not a stub-specified dark color).
- Bar anchored bottom-left at `insetLeftPx: 64`, `insetBottomPx: 52` — between BBC Reith's `insetBottomPx: 48` (sits visually lowest) and Sky News's `insetBottomPx: 56`. ITV broadcast canon places the bar slightly lower than Sky News (more screen-content breathing-room above the lower-frame margin).
- Card auto-fits the headline against a `minWidth: 240` floor with `padding: '12px 20px'` and uniform `borderRadius: 6` (ITV broadcasts often use a sharper left edge against the magenta strip with a slightly rounder right edge; the primitive renders all four corners uniform — see "Trade-offs").
- v1 uses the existing `LowerThird` primitive (T-183) prop surface: `background`, `accent`, `textColor`, `name`, `title`, `insetLeftPx`, `insetBottomPx`. Snapshot constants live in `ITV_PRO_REGISTER_PROPS` (exported from `@stageflip/parity-cli` at the cluster sign-off step).

## Typography
- Headline (`name`): Mixed Case applied at the snapshot string level (`'Mary Nightingale'`). Rendered at the primitive's default 34 px / fontWeight 700 — close to the broadcast register's 32–34 pt range. Mixed Case (NOT UPPERCASE) is the British-broadcaster register's signature; UPPERCASE would read as American-tabloid, contrary to ITV News's friendlier-than-Sky-but-less-formal-than-BBC voice (between Sky News's authoritative news-broadcaster and BBC Reith's humanist register).
- Subtitle (`title`): Mixed Case (`'Chief Political Editor'`); rendered at 18 px / fontWeight 500. Three-word presenter role; ASCII-only; full coverage in the Plus Jakarta Sans fallback.
- Rendered family v1: `Plus Jakarta Sans` (the primitive's hard-coded inline `fontFamily`). The bespoke `ITV Reem` (proprietary BYO) and the OFL fallback `Plus Jakarta Sans 700` declared in frontmatter exist for the type-design batch review (sister cluster-A composer task) — the OFL fallback happens to match the primitive's hard-coded family in this case, so the rendered family is faithful to the declared fallback. Adding a `font.family` prop to the `LowerThird` primitive remains a candidate `T-183z` primitive-level follow-up.
- Letter-spacing: the primitive hard-codes `letterSpacing: '-0.015em'` on the name and `letterSpacing: '0.02em'` on the title. ITV News broadcast typography uses a similar tight-name + open-subtitle posture, so the primitive's defaults align with the register without divergence.

## Animation
- Slide-in from the left over `ceil(fps * 0.45)` frames easing `EASE_OUT_QUART`; mid-shot hold; slide-out to the right over the last `ceil(fps * 0.35)` frames easing `EASE_IN_QUART` (per the `LowerThird` primitive contract from T-183). At 30 fps: ~450 ms entrance, ~350 ms exit.
- Steady-state mid-hold: `translatePct == 0`, `opacity == 1`. The parity golden captures this state at frame 60 (= 2000 ms @ 30 fps composition).
- ITV News broadcast canon shares the slide-in-from-left entrance choreography with the BBC + CNN + Sky News registers; the timing constants (450 ms entrance / 350 ms exit) match the primitive's default contract.
- Animated decorations from the broadcast register — ITV News "LIVE" badge, ticker scroll, breaking-news magenta-strip flash — are deferred (see "Out of scope").

## Rules
- Use when a modern UK-broadcaster, friendly-but-credible register is called for — on-air talent identification, presenter / role chyrons, contributor attribution with a post-2022 ITVx visual identity. ITV register sits between Sky News's authoritative-broadcaster posture and BBC Reith's humanist authority; choose ITV Pro for British-broadcaster tone with a friendlier, more approachable register than Sky News.
- Do not use for breaking-news / urgent-alert contexts (use a `breakingBanner`-clipKind preset like `cnn-breaking` or `fox-news-alert`).
- Do not paint the full bar magenta. The 6 px-wide ITVx magenta `#E8118E` accent strip on the left is the brand identifier — pulling the strip to white (to recover a hypothetical dark-subtitle stub spec) would destroy the brand signal.
- Mixed Case (NOT UPPERCASE) for both headline and subtitle. UPPERCASE breaks the British-broadcaster register and migrates the visual onto American-tabloid territory (CNN's UPPERCASE chevron).
- Do not substitute the magenta strip for the older yellow `#FFCC00` ITV News brand color. The pack targets the current-day (post-2022 ITVx rebrand) broadcast register; the yellow is a separate retro register candidate.
- Designed for live-news on-air talent identification across the full ITV News broadcast day — same legibility requirements as BBC Reith + Sky News (subtitle ≥ 18 pt; primitive's 18 px default satisfies).

## Acceptance (parity)
- Reference frame: 60 (= 2000 ms @ 30 fps; steady-state mid-hold; bar + strip + headline + subtitle fully settled).
- PSNR ≥ 42 dB, SSIM ≥ 0.98 (hand-pinned per `parity-fixture-signoff.md` workflow per the F-4 follow-up flagged in T-359b — generator default 35 / 0.95 is overwritten on land; matches T-323 / T-324 / T-325 / T-358 / T-359 / T-360 / T-507 cross-cluster norm).

## Trade-offs (v1 cosmetic divergences from the compass register)
- **Subtitle text renders magenta, not a dark on-white-bar color.** The `LowerThird` primitive (T-183) renders the optional `title` line at `color: accent` (lower-third.tsx:129). With `accent: '#E8118E'` the subtitle reads in ITVx magenta on the white bar — broadcast canon for ITV News commonly places the subtitle in a darker secondary tone (mid-grey) against the white bar. Painting `accent` darker to match would also paint the left-edge strip darker, killing the ITVx magenta brand signal. v1 accepts the magenta subtitle text on the white bar (still legible at fontSize 18 against `#FFFFFF`; magenta on white is high-contrast). Allowing independent strip-vs-subtitle coloring (e.g., a new `subtitleColor?` prop) is a candidate primitive-level follow-up under the `T-183z`-family label — same trade-off T-323 + T-325 + T-507 documented as D-T323-5 / D-T325 trade-off 1 / D-T507 trade-off 1.
- **Rendered family is `Plus Jakarta Sans`, not the proprietary `ITV Reem`.** The primitive hard-codes `fontFamily: 'Plus Jakarta Sans, sans-serif'` (lines 112, 126). The OFL fallback declared in frontmatter happens to match the hard-coded family for this preset, so the rendered family is faithful to the declared fallback — a quiet upgrade vs BBC + CNN where the declared OFL family diverged from the rendered family, and matching the T-507 Sky News posture. The proprietary `ITV Reem` (BYO) declared in frontmatter exists for the type-design batch review's evaluation of declared fonts and is not honored at render time.
- **Uniform 6 px border radius, not asymmetric sharp-left / rounded-right corners.** The primitive's card uses `borderRadius: 6` on all four corners. ITV News broadcast lower-thirds occasionally feature a sharper left edge against the magenta strip with a slightly rounder right edge; v1 uses uniform 6 px — close to the canonical intent; the visual cluster identity (white bar + magenta strip + Mixed-Case typography + dark text) reads correctly at 6 px uniform. Asymmetric corner radii (e.g., `borderRadiusTopRightPx`) is a candidate primitive-level follow-up under the same `T-183z`-family label.
- **Background opacity rendered at 100 %, not the production ~90 %.** The primitive's `background` prop accepts a single hex string with no opacity channel. Pre-blending against an assumed canvas color is wrong on arbitrary footage; the 90 % spec is a production-time tunable for video-overlay legibility. v1 parity renders at 100 % on the flat-color parity canvas. Adding a `backgroundOpacity?` prop is a candidate primitive-level follow-up under the same `T-183z`-family label.

## Out of scope
- ITV News "LIVE" badge (white "LIVE" pill on a magenta fill, persistent during live programming) — primitive-level concern; the `LowerThird` primitive does not expose a `liveIndicator` slot. Sister `breakingBanner` or `imageOverlay` composition territory, candidate `T-508a` IF Reviewer scrutiny demands.
- Ticker / flipper companion below the bar — semantically a `newsTicker`-clipKind preset; T-510 (News Pro premium news-ticker) covers the pack's ticker register.
- Breaking-news magenta-strip flash (the strip pulsing during urgent on-air moments) — primitive-level animation enum addition, candidate `T-508b` IF Reviewer scrutiny demands.
- Asymmetric corner radii (sharp left against the strip; rounder right) — primitive-level cosmetic concern under the `T-183z`-family label.
- Retro yellow `#FFCC00` ITV News (pre-2022) register — separate retro-register preset candidate; out of scope for the current-day-targeted News Pro pack v1.

## References
- https://news.itv.com/ — canonical ITV News website (brand colors observed in production: `#E8118E` magenta strip + white bar; post-2022 ITVx rebrand)
- Wikipedia "ITV News" — broadcast brand history and on-air register notes (post-2022 ITVx rebrand)
- ADR-004 (preset system contract)
- T-183 — `LowerThird` primitive (the chyron this preset wires)
- T-323 — first `lowerThird` clipKind binding (`cnn-classic`, clipKind-default arm)
- T-325 — second `lowerThird` clipKind binding (`bbc-reith-dark`, first `PRESET_ID_BINDINGS` override; structural template for this preset)
- T-360 — `PRESET_ID_BINDINGS` mechanism (binding path for non-default `lowerThird` consumers)
- T-506 — News Pro pack skeleton (this preset's parent pack; landed the three placeholder register slots)
- T-507 — Sky News register substantive fill (first of three register slots; structural template for this preset)
- T-508 — ITV register substantive fill (this PR; second of three register slots; T-509 RAI fills the remaining slot; T-510 fills the news-ticker)

---
id: fox-news-alert
cluster: news
clipKind: breakingBanner
source: docs/compass_artifact.md#fox-news-alert-system
status: substantive
preferredFont:
  family: FF Good OT Black
  license: commercial-byo
fallbackFont:
  family: League Gothic
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: 'signed:2026-05-05'
  typeDesign: pending-cluster-batch
---

# Fox News Alert — breaking banner

## Visual tokens
- Sliver: `#003366` Prussian Blue (Fox primary fill), persistent narrow strip anchored top-left of the frame, ~30 % of frame width per the `BreakingBanner` primitive's sliver-mode `sliverWidthPct` default. The sliver IS the brand mark — never paint it full-width and never animate its entrance (per T-324a D-T324a-6 sliver mode skips entrance entirely; the canonical Fox posture is the persistent register, NOT entrance animation).
- `FOX NEWS ALERT` label badge: red `#C20017` block + white `#FFFFFF` text (Fox accent / alert color); brand-locked text. Rendered as the leftmost child inside the sliver.
- Headline: `#FFFFFF` white on Prussian Blue, **Mixed-Case** (NOT all-caps; per stub line 31 "Heavy / Black, Mixed Case"). Distinct from CNN's UPPERCASE register.
- No flag end-cap. Unlike CNN-Breaking (T-324) which carries a 12 px-wide red flag end-cap on the left, Fox does not — the colored sliver block IS the brand identifier; the badge + headline composition fills the sliver itself.
- Sliver height 64 px (vs banner-mode 96 px) per the `BreakingBanner` primitive's sliver-mode container-style dispatch.
- v1 uses the existing `BreakingBanner` primitive (T-324a) prop surface: `headline`, `label`, `background`, `headlineColor`, `mode`, `slideAxis`, `sliverAnchor`, `sliverWidthPct`, `casing`, `font`. Snapshot constants live in `FOX_NEWS_ALERT_PROPS` (exported from `@stageflip/parity-cli`).

## Typography
- `FOX NEWS ALERT` label: rendered at fontSize 18 / fontWeight 800 with `background: '#C20017'` + `color: '#FFFFFF'` (sliver-mode primitive default). Pre-uppercased in the snapshot string per stub line 30 ("Banner label: ALL CAPS"); the primitive's `casing` prop applies to `headline` only.
- Headline: rendered at fontSize 18 / fontWeight 800 with `color: '#FFFFFF'`. Mixed-Case applied via the primitive's `casing: 'as-is'` no-op transform — the snapshot string `'Major Storm Approaches East Coast'` is rendered verbatim. This contrasts with CNN-Breaking's `casing: 'uppercase'` (T-324) — the casing primitive is the same across consumers; the register difference is whether the consumer transforms or preserves the literal.
- Rendered family v1: `League Gothic 700` (the OFL fallback declared in frontmatter, honored at render time via the primitive's `font` prop override per T-324a D-T324a-9). Like T-324 (`Inter Tight 800` for CNN), the `BreakingBanner` primitive does honor a `font` prop; the snapshot passes `{ family: 'League Gothic', weight: 700 }` to render the declared OFL fallback faithfully (D-T327-13). The bespoke `FF Good OT Black` (commercial BYO) is declared for the type-design batch review (T-331 / sister cluster-A composer task).
- T-327 is the **first preset to declare `League Gothic` in the font registry**. The font-registry build picks up the declaration from the frontmatter automatically; the puppeteer renderer's FontManager preload list resolves League Gothic 700 OFL TTF at render time.

## Animation
- v1 ships **steady-state persistent sliver only**. Per T-324a D-T324a-6, when `mode === 'sliver'` the primitive short-circuits the slide-axis math: `enterPct = 0`, `exitPct = 0`, `translatePct = 0`, `opacity = 1`. The rendered sliver is bit-identical at every frame.
- The `slideAxis: 'vertical'` setting is documented for the **exit** (per stub line 38 — "Exit: slide down, 400 ms") and as a record of Fox's signature axis if a future v2 enum extension (e.g., `mode: 'sliver-animated'`) opts the sliver into entrance/exit. **At the canonical reference frame 60 the rendered sliver is bit-identical regardless of `slideAxis`** — sliver mode skips both entrance and exit animation.
- The signature vertical-slide motion (stub line 35 "Signature vertical slide motion — elements slide up/down, not horizontal wipes") is preserved as a brand-axis declaration; it does not exercise at the steady-state mid-hold golden.
- Animated decorations from the broadcast register — searchlight morph (return-from-commercial bumper), LIVE pulse bug, ticker scroll, semi-transparent dark overlay, vertical exit slide — are deferred (see "Out of scope").

## Rules
- "Fox News Alert" sliver is persistent during nearly all breaking coverage; hide only during non-breaking programming. Do not repurpose the sliver for non-Fox-register content.
- The Prussian Blue + Fox-red palette is brand-locked. Do not substitute alternate alert / accent colors.
- Vertical slide is the Fox signature; do not substitute horizontal wipes for the exit (the v1 golden does not exercise the exit, but the brand-axis declaration is canonical).
- Headline is **Mixed-Case** by Fox convention; do not uppercase. The `casing: 'as-is'` primitive setting preserves the literal headline string.
- Do not paint the full frame Prussian Blue. The narrow sliver (~30 % width, anchored top-left) IS the brand identifier — banner-mode rendering would migrate the visual onto CNN's full-width register and is forbidden for Fox.
- Do not add a flag end-cap. Unlike CNN-Breaking, Fox doesn't use one; the sliver IS the brand mark.
- Do not use `mode: 'banner'` for Fox — the canonical Fox posture is the persistent narrow sliver. The banner-mode register is CNN territory (sister Cluster A preset T-324 `cnn-breaking` via the clipKind-default arm).
- The searchlight morph is a Fox-specific bumper flourish; do not migrate to other cluster-A presets.

## Acceptance (parity)
- Reference frame: 60 (= 2000 ms @ 30 fps; steady-state mid-hold; persistent sliver fully on screen with no slide). Under sliver mode the rendered sliver is bit-identical at every frame; the choice of frame 60 matches the cross-cluster mid-hold convention (T-323 / T-324 / T-325 / T-326 / T-329 / T-330 / T-358 / T-359 / T-360 / T-356 / T-357 / T-362 / T-367 / T-350) and the parity-fixture-signoff default.
- PSNR ≥ 42 dB, SSIM ≥ 0.98 (auto-written by the F-4 generator-flag pin `--psnr=42 --ssim=0.98` per D-T327-8 — generator default 35 / 0.95 is overwritten on land; NO manual `thresholds.json` edit).

## Trade-offs (v1 cosmetic divergences from the compass register)
- **Steady-state persistent sliver only — no vertical-slide entrance / exit animation.** Sliver mode skips entrance per T-324a D-T324a-6 (the canonical Fox posture is the persistent register). The vertical slide-down exit (stub line 38) and any other multi-stage broadcast choreography are deferred — the mid-hold steady-state golden at frame 60 captures the persistent-sliver register; the entrance / exit choreography difference is documented (D-T327-5) and not visible at the canonical reference frame.
- **No flag end-cap (deliberate; not a divergence).** Unlike CNN-Breaking's red flag end-cap, Fox doesn't use one. The sliver IS the brand mark.
- **League Gothic 700 honored via `font` prop (NOT a divergence — UPGRADE vs lower-third presets).** Unlike the cluster's `lowerThird` presets which render at the `LowerThird` primitive's hard-coded `Plus Jakarta Sans`, T-327 renders the declared OFL fallback `League Gothic 700` faithfully (D-T327-13). The type-design batch review evaluates declared fonts; the rendered family matching the declared fallback is a substantive cosmetic upgrade. T-327 is the first preset to declare League Gothic; the font-registry build picks up the declaration from the frontmatter automatically.
- **Flat 0-radius sliver corners.** The primitive renders `borderRadius: 0` by default; the stub's "flat design with white border" (line 23) primarily characterizes the bug element, not the sliver edge. v1 accepts the flat-corner register; the white-border ornament is not a primitive-supported axis and is documented as a deferred minor cosmetic.

## Out of scope
- Searchlight morph (return-from-commercial bumper — per stub line 36): "bug returns as simple angled lines that morph into searchlight beams, other elements zoom and fade, 1.2 s total sequence." Multi-stage glyph morph not in the `BreakingBanner` primitive's prop surface (per T-324a D-T324a-12). Candidate `T-327a` IF Reviewer scrutiny demands.
- Return-from-commercial multi-stage sequence — multi-clip orchestration; not a primitive prop. Candidate `T-327b` IF demanded.
- LIVE pulse bug (red pulsing dot + "LIVE" badge, 2 s cycle, per stub line 37) — primitive-level concern; the `BreakingBanner` primitive does not expose a `livePulse` slot. Shared concern with T-324; candidate `T-324b` IF Reviewer demands (covers both consumers since both stubs reference LIVE pulse).
- Ticker strip below sliver (per stub line 32 — Fox introduced the ticker on 9/11/2001) — semantically a `newsTicker` clipKind (already wired in the resolver per T-356); composes externally via `news-ticker-bar` (T-356a) in adjacent layout slot, NOT a follow-up to T-327.
- Semi-transparent dark overlay below all graphics (per stub line 27) — aux-layer composition; not a `BreakingBanner` primitive prop; would be a separate composed `imageOverlay` / `colorPanel` clip at compose-time. Candidate sister-clip carve-out IF demanded.
- Vertical-slide entrance / exit animation for the sliver — sliver mode skips entrance per T-324a D-T324a-6. A sliver-with-entrance variant is a v2 enum extension at the primitive level (e.g., `mode: 'sliver-animated'`), NOT a T-327 carve-out.
- Banner-mode register (`mode: 'banner'`) for Fox — the canonical Fox posture is persistent sliver. Banner mode is the CNN posture (T-324). If a Fox-banner-mode variant is later required, that's a sister preset (e.g., `fox-news-banner`), NOT a T-327 expansion.
- White border ornament around the bug element (per stub line 23) — not a primitive-supported axis; deferred minor cosmetic.

## References
- `docs/compass_artifact.md` § Fox News Alert system
- ADR-004 (preset system contract)
- T-324a — `BreakingBanner` primitive (the breaking-banner this preset wires; just-shipped direct dep)
- T-324 — first `breakingBanner` clipKind binding (`cnn-breaking`, clipKind-default arm; T-327 leaves it UNCHANGED and binds via `PRESET_ID_BINDINGS` override per Pattern C)
- T-327 — preset promotion + second `breakingBanner` clipKind binding (this PR)
- Sibling preset: `cnn-breaking` (T-324 — banner-mode register; sliver-register-vs-banner-register distinction documented)
- Structural template: `bbc-reith-dark` (T-325 — first `PRESET_ID_BINDINGS` override for a clipKind; T-327 mirrors the override pattern)
- Successor: T-328 `msnbc-big-board` (`fullScreen` clipKind; closes Cluster A 8/8)

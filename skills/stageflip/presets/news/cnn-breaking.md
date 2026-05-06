---
id: cnn-breaking
cluster: news
clipKind: breakingBanner
source: docs/compass_artifact.md#cnn-breaking-news-banner
status: substantive
preferredFont:
  family: CNN Sans
  license: proprietary-byo
fallbackFont:
  family: Inter Tight
  weight: 800
  license: ofl
permissions: []
signOff:
  parityFixture: 'signed:2026-05-05'
  typeDesign: pending-cluster-batch
---

# CNN Breaking — urgent banner

## Visual tokens
- Banner: `#FFFFFF` fill (white), full-width, anchored at the bottom of the frame — the canonical CNN-Breaking news strap.
- End cap: `#CC0000` flag on the far left (Boston University Red / PMS 2347 C); 12 px-wide full-height bar per the `BreakingBanner` primitive's banner-mode `endCapStyle.width`. The flag end-cap IS the brand identifier; never paint the full banner red.
- `BREAKING NEWS` label badge: red `#CC0000` block + white `#FFFFFF` text; brand-locked text per stub line 44 ("not customizable"). Rendered immediately right of the flag end-cap.
- Headline: `#000000` black on the white banner, UPPERCASE.
- Inset: `insetBottomPx: 60` — the banner sits flush near the bottom edge (closer to the frame bottom than the lower-third's 64 px chyron); honors the safe-zone while pinning the strap to the lower portion of the 1280×720 canvas.
- v1 uses the existing `BreakingBanner` primitive (T-324a) prop surface: `headline`, `label`, `endCap`, `background`, `headlineColor`, `mode`, `slideAxis`, `casing`, `font`, `insetBottomPx`. Snapshot constants live in `CNN_BREAKING_PROPS` (exported from `@stageflip/parity-cli`).

## Typography
- `BREAKING NEWS` label: rendered at fontSize 26 / fontWeight 800 with `background: '#CC0000'` + `color: '#FFFFFF'` (banner-mode primitive default). Pre-uppercased in the snapshot string per stub line 31 ("ALL CAPS").
- Headline: rendered at fontSize 30 / fontWeight 800 with `color: '#000000'`. UPPERCASE applied via the primitive's `casing: 'uppercase'` transform — defensive even though the snapshot string is already uppercased (D-T324-5).
- Rendered family v1: `Inter Tight 800` (the OFL fallback declared in frontmatter, honored at render time via the primitive's `font` prop override). Unlike T-323 / T-325 / T-326 / T-329 / T-330 (`LowerThird` primitive hard-codes `Plus Jakarta Sans` — no `font` prop available), the `BreakingBanner` primitive (T-324a D-T324a-9) does honor a `font` prop; the snapshot passes `{ family: 'Inter Tight', weight: 800 }` to render the declared OFL fallback faithfully (D-T324-13). The bespoke `CNN Sans` (proprietary BYO) is declared for the type-design batch review (T-331 / sister cluster-A composer task).

## Animation
- Slide-in from the left over `ceil(fps * 0.45)` frames easing `EASE_OUT_QUART`; mid-shot hold; slide-out to the right over the last `ceil(fps * 0.35)` frames easing `EASE_IN_QUART` (per the `BreakingBanner` primitive contract from T-324a banner-mode).
- Steady-state mid-hold: `translatePct == 0`, `opacity == 1`. The parity golden captures this state at frame 60 (5 s @ 30 fps composition; entry-end at frame 14, exit-start at frame 79).
- Animated decorations from the broadcast register — staged red-block sweep entrance, LIVE bug pulse, ticker scroll, red-block-wipe text-change transition — are deferred (see "Out of scope").

## Rules
- Use only for true breaking news. Do not apply to ongoing developing coverage; escalate to `cnn-classic` after the initial breaking beat.
- "BREAKING NEWS" label is not customizable — it is the brand signal; do not brand-override.
- If the story later resolves, exit to `cnn-classic` with the story-update headline; do not just dismiss.
- Do not paint the full banner red. The 12 px-wide red flag end-cap on the left is the identifier.
- Do not use `mode: 'sliver'` for CNN — the canonical CNN posture is the full-width banner. The sliver-register is Fox News territory (sister Cluster A preset T-327 `fox-news-alert` via `PRESET_ID_BINDINGS` override).

## Acceptance (parity)
- Reference frame: 60 (= 2000 ms @ 30 fps; steady-state mid-hold; banner + flag + label + headline fully settled).
- PSNR ≥ 42 dB, SSIM ≥ 0.98 (auto-written by the F-4 generator-flag pin `--psnr=42 --ssim=0.98` per D-T324-8 — generator default 35 / 0.95 is overwritten on land; NO manual `thresholds.json` edit).

## Trade-offs (v1 cosmetic divergences from the compass register)
- **Single-stage horizontal slide-in entrance, not the staged red-block sweep + label-reveal + headline-reveal.** The T-324a primitive ships a single horizontal slide-in from the left as the canonical entrance (per T-324a D-T324a-5); the staged 800 ms red-sweep + label-reveal + headline-reveal multi-stage entrance described in the stub's original `## Animation` section is NOT in v1. The mid-hold steady-state golden at frame 60 captures the post-entry register; the entrance choreography difference is documented (D-T324-12) and not visible at the canonical reference frame.
- **Uniform flat banner, no rounded corners.** The primitive renders `borderRadius: 0` by default; the post-2023 "rounded corners + flatter styling" claim from the stub primarily applies to the `BREAKING NEWS` label badge edge, which is rendered as a flat red block by the primitive. v1 accepts the flat-block register.
- **Inter Tight 800 honored via `font` prop (NOT a divergence — UPGRADE vs lower-third presets).** Unlike the cluster's `lowerThird` presets which render at the `LowerThird` primitive's hard-coded `Plus Jakarta Sans`, T-324 renders the declared OFL fallback `Inter Tight 800` faithfully (D-T324-13). The type-design batch review evaluates declared fonts; the rendered family matching the declared fallback is a substantive cosmetic upgrade.

## Out of scope
- LIVE pulse bug (red pulsing dot + "LIVE" badge, 2 s cycle, 0.6 → 1.0 opacity) — primitive-level concern; the `BreakingBanner` primitive does not expose a `livePulse` slot. Candidate `T-324b` IF Reviewer scrutiny demands.
- CNN bug (rounded white box bottom-right with CNN logo) — orchestration-level composition (separate `imageOverlay` clip beside the breaking banner), candidate `T-324d`.
- Ticker strip below banner (dark gray gradient + chevron-prefixed flipper items) — semantically a `newsTicker` clipKind (already wired in the resolver per T-356); composes externally via `news-ticker-bar` (T-356a) in adjacent layout slot, NOT a follow-up to T-324.
- Red-block-wipe transition between consecutive headlines (600 ms) — orchestration-layer transition between two `BreakingBanner` mounts; not a primitive prop, candidate `T-324c`.
- Staged red-block sweep entrance (L→R sweep + label reveal + headline reveal, 800 ms total) — primitive-level follow-up if demanded, NOT a T-324 carve-out.
- Persistent-sliver register (`mode: 'sliver'`) — exercised by sister Cluster A preset T-327 `fox-news-alert` via `PRESET_ID_BINDINGS` override (T-324 establishes the banner-mode clipKind-default).
- Banner exit transition to `cnn-classic` register — multi-clip orchestration; the mid-hold steady-state golden does not exercise the exit.

## References
- `docs/compass_artifact.md` § CNN Breaking News banner
- ADR-004 (preset system contract)
- T-324a — `BreakingBanner` primitive (the breaking-banner this preset wires; just-shipped direct dep)
- T-324 — preset promotion + first `breakingBanner` clipKind binding (this PR)
- Sibling preset: `cnn-classic` (T-323 — first `lowerThird` clipKind binding; structural template)
- Successor: T-327 `fox-news-alert` (`breakingBanner` shared via `PRESET_ID_BINDINGS` for the sliver register)

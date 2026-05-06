---
id: apple-tv-lt
cluster: news
clipKind: lowerThird
source: docs/compass_artifact.md#apple-tv
status: substantive
preferredFont:
  family: SF Pro
  license: proprietary-byo
fallbackFont:
  family: Inter
  weight: 300
  license: ofl
permissions: []
signOff:
  parityFixture: 'signed:2026-05-05'
  typeDesign: pending-cluster-batch
---

# Apple TV+ — minimalist lower third

## Visual tokens
- **Text-only register** (compass canon line 23 "Text-only; no background elements"). Apple TV+ ships zero colored chrome — no flag, no card visually present against the canvas. The `LowerThird` primitive (T-183 + T-183z) renders a 6 px-wide accent strip by default; T-183z's `noFlag: boolean` prop suppresses the strip entirely. Snapshot pins `noFlag: true` (T-183z first production consumer — D-T330-3). Departure from T-323 / T-325 / T-326 which all carry an accent strip.
- **No visible card** — the primitive renders a card with `padding: '12px 20px'` + `borderRadius: 6` + `boxShadow: '0 8px 24px rgba(0,0,0,0.24)'`. v1 trade-off: set `background: '#000000'` (canvas-matching black) so the card's fill blends into a dark canvas; the box visually disappears. The hard-coded `boxShadow` may produce a faint visible edge — see "Trade-offs" (D-T330-12-a). Carving out a `shadow?` prop is a `T-183z`-family follow-up.
- **Bottom-left anchor with generous whitespace** (compass canon line 26 "130–150 px from left, 90–100 px from bottom @ 1080p"). v1 picks the mid-range of each: `insetLeftPx: 140`, `insetBottomPx: 95`. Departure from T-323 / T-325 / T-326's far-left 64 — Apple TV+ floats inset, not anchored to the edge.
- **Colors** — headline `#FFFFFF` (white-on-black per Apple's clean register); subtitle `#FFFFFF` via T-183z `subtitleColor` (D-T330-4 — talent-line decoupled from `accent`); `accent: '#FFFFFF'` (irrelevant — `noFlag: true` suppresses rendering). The most restrained color register in Cluster A.
- v1 uses the existing `LowerThird` primitive (T-183 + T-183z) prop surface: `name`, `title`, `accent`, `background`, `textColor`, `insetLeftPx`, `insetBottomPx`, `noFlag`, `subtitleColor`, `font`. Snapshot constants live in `APPLE_TV_LT_PROPS` (exported from `@stageflip/parity-cli`).

## Typography
- **Headline (`name`)**: `'Sofia Coppola'` — Mixed Case applied at the snapshot string level (D-T330-7). Two-word ASCII Latin name; full coverage in Inter Light. Real Apple TV+ collaborator (director, "On the Rocks" Apple Original, 2020). Rendered at the primitive's default 34 px / `fontWeight: 300` per T-183z `font.weight`.
- **Subtitle (`title`)**: `'Director'` — Mixed Case (D-T330-7); single-word presenter-role string; ASCII-only. Rendered at 18 px / `fontWeight: 300`. The primitive applies `font.weight` uniformly to both name and title (lines 88–90 of `lower-third.tsx`); v1 picks Light (300) — closer to Apple TV+'s typographic register than the primitive's default 700/500.
- **Family**: `Inter` weight 300 (Light) via T-183z `font: { family: 'Inter', weight: 300 }` (D-T330-5 — first production consumer milestone). Inter Light is the OFL fallback for Apple's proprietary `SF Pro` Light (`proprietary-byo`); Inter ships under SIL Open Font License 1.1 via Google Fonts and is already on the OFL whitelist in `THIRD_PARTY.md` from sister preset corpus. Inter Light closely approximates SF Pro Light at the same x-height and weight curve.
- **Letter-spacing**: the primitive hard-codes `letterSpacing: '-0.015em'` (name) / `'0.02em'` (title). The stub's "letter spacing +75–120" (name) / "+150–200" (title) is not exposed as a primitive prop axis; cosmetic primitive-level concern. v1 ships with the primitive's defaults.
- **Casing**: v1 ships **Mixed Case for both** lines (D-T330-7). The compass stub differentiates name (Mixed Case) and title (UPPERCASE) per Apple's typographic register; the primitive does NOT have a per-line casing prop. The UPPERCASE register is reserved for **show-titles** (`titleSequence` clipKind territory — T-350 et al.) — the steady-state presenter / role-identification lower-third is Mixed Case canonically. Carving out per-line casing is a `T-183z`-family follow-up.
- **Latin-only** — Apple TV+ ships English Latin at canon; no bilingual axis to defer.

## Animation
- Slide-in from the left over `ceil(fps * 0.45)` frames easing `EASE_OUT_QUART`; mid-shot hold; slide-out to the right over the last `ceil(fps * 0.35)` frames easing `EASE_IN_QUART` (per the `LowerThird` primitive contract from T-183).
- Steady-state mid-hold: `translatePct == 0`, `opacity == 1`. The parity golden captures this state at frame 60 (= 2000 ms @ 30 fps composition; comfortably mid-hold per D-T330-8).
- The compass stub describes a refined fade-in with slight scale from 95% → 100%, 600–800 ms, ease-in-out (Apple's signature curve `cubic-bezier(0.42, 0, 0.58, 1)`); plus optional word-by-word reveals; plus a mirrored fade-out exit. The primitive does NOT decompose entrance into per-element timings, does NOT support a scale transform, does NOT support symmetric ease-in-out (its curves are asymmetric `EASE_OUT_QUART` / `EASE_IN_QUART`), and does NOT support per-word reveals. v1 ships only the steady-state register; scale-from-95%, per-word reveals, ease-in-out cubic-bezier, and the mirrored fade-out exit are all primitive-level follow-ups (`T-183z`-family) IF Reviewer scrutiny demands them. Same divergence shape T-323 / T-325 / T-326 documented.
- LiveDataClip / frontier-tenant data updates are out of scope for `lowerThird` (non-frontier clipKind; ADR-005 frontier track owns).

## Rules
- Use for premium / enterprise pitch decks where the content should feel "ratified by Apple." Common deployment: keynote-style presenter identification + role / title attribution.
- The most restrained preset in the cluster (compass canon line 41 "If a dark-background compose needs more, escalate; don't add one"). Do NOT add a flag / card / strip / separator to "improve" the register — minimal IS the register. T-330 honors restraint by passing `noFlag: true`.
- Animation curve is specifically ease-in-out per Apple's iOS / macOS system animations canon — not linear, not ease-out. v1 inherits the primitive's asymmetric curves (cosmetic divergence; D-T330-12-c).
- ALL CAPS is NOT used in the steady-state presenter / role-identification register. UPPERCASE is reserved for show-title plates (`titleSequence` clipKind — T-350 et al.). Mixed Case is the correct register here.
- Typography fallback must preserve the Light-weight x-height and humanist sans-serif posture; the OFL fallback `Inter` weight 300 declared in frontmatter satisfies this for the type-design batch review. v1 renders in Inter Light (T-183z `font` prop) — closer to compass register than T-323 / T-325 / T-326 which render in Plus Jakarta Sans (the primitive's pre-T-183z default).
- Generous left/bottom padding is canonical to Apple's whitespace principle. Do NOT collapse the inset to far-left (64 px) for cluster-internal consistency — Apple TV+'s register depends on the float (140 / 95).

## Acceptance (parity)
- Reference frame: 60 (= 2000 ms @ 30 fps; steady-state mid-hold; headline + subtitle fully on screen at full opacity, no slide).
- PSNR ≥ 42 dB, SSIM ≥ 0.98 — written directly into `parity-fixtures/news/apple-tv-lt/thresholds.json` by the F-4 generator flags `--psnr=42 --ssim=0.98` (D-T330-10). T-330 is the **first preset PR to use F-4 flags**; the manual `thresholds.json` hand-pin step T-323 / T-325 / T-326 used is retired. The text-only register has the lowest aliasing surface in the cluster — `42 / 0.98` sits comfortably above the noise floor.

## Trade-offs (v1 cosmetic divergences from the compass register)
- **Card boxShadow may be visible at edges.** The `LowerThird` primitive hard-codes `boxShadow: '0 8px 24px rgba(0,0,0,0.24)'` on the card (line 146 of `lower-third.tsx`). With `background: '#000000'` matching a dark canvas the card fill blends in; the shadow may still produce a faint visible edge. Apple TV+'s "no background elements" register (compass line 23) does not call for any shadow — the optional very subtle shadow described on line 24 is `0, 1 px, 2 px blur, 20% opacity black`, not the primitive's `0 8px 24px @ 0.24`. Carving out a `shadow?` prop is a `T-183z`-family follow-up. NOT a T-330 fix.
- **Uniform 6 px corner radius.** The primitive's card uses `borderRadius: 6` on all four corners. Apple TV+'s text-only register has no card so corners are visually irrelevant when `background === canvas`; documented for completeness. NOT a T-330 fix.
- **Animation curve asymmetric.** Primitive uses `EASE_OUT_QUART` (entry) / `EASE_IN_QUART` (exit); Apple's signature ease-in-out cubic-bezier `(0.42, 0, 0.58, 1)` is symmetric. Cosmetic; the parity golden is at steady-state mid-hold (frame 60) where the curve is irrelevant. NOT a T-330 fix.
- **No scale-from-95% entrance, no separator line, no per-word reveal, no symmetric fade-out.** Apple TV+'s entrance choreography (refined fade-in + 95→100 scale) is not honored by the primitive's slide-in transform. The optional thin horizontal separator line (`#FFFFFF` @ 40% opacity, 1 px, ≤ 80 px wide) per stub line 25 is not a primitive prop. Per-word word-by-word reveals (stub line 36) are not decomposable from the primitive's whole-composite slide. The mirrored fade-out exit is not a primitive prop. Steady-state mid-hold parity golden at frame 60 sidesteps all four issues entirely. NOT T-330 fixes — all primitive-level `T-183z`-family follow-ups.
- All four divergences SHARE the `T-183z`-family follow-up label. T-330 inherits, does not introduce, does not widen, does not fix.

## Out of scope
- Word-by-word reveals (compass stub line 36) — primitive-level `T-183z`-family carve-out.
- Apple ease-in-out cubic-bezier `(0.42, 0, 0.58, 1)` — primitive-level animation-curve carve-out.
- Scale `95% → 100%` entrance — primitive does not expose a scale transform; carve-out candidate.
- Subtle drop shadow per stub line 24 — primitive's `boxShadow` is hard-coded; `shadow?` prop carve-out candidate.
- Optional thin horizontal separator line — primitive does not render a separator; carve-out candidate.
- Per-line casing (Mixed Case headline + UPPERCASE subtitle per stub line 31) — primitive has no `casing` prop; carve-out candidate.
- Word-level kerning per pair — primitive has no `kerning` prop; cosmetic; v1 ships at default Inter Light kerning.
- LiveDataClip / frontier-tenant data updates — non-frontier clipKind; ADR-005 frontier track owns.
- Multi-variant goldens (compass stub line 46 "0 / 18 / 36 / 150") — single canonical mid-hold per D-T330-8; entry/exit windows evidenced by the primitive's animation contract via `lower-third.test.tsx`, not per-state goldens.
- Cluster A `news` SKILL.md modification — owned by T-331 (cluster composer task).
- `docs/ops/parity-fixture-signoff.md` modification — procedural-only doc per `MEMORY.md` `feedback_parity_signoff_doc_is_procedural.md`; sign-off lives in preset frontmatter, not in this file.

## References
- `docs/compass_artifact.md` § Apple TV+ (News section)
- Compass canon note: most restrained preset in Cluster A — text-only, no chrome, generous whitespace, Inter Light Mixed Case white-on-black.
- ADR-004 (preset system contract)
- T-183 — `LowerThird` primitive base (the chyron this preset wires)
- T-183z — `LowerThird` primitive `noFlag` / `subtitleColor` / `font` props (T-330 is the first production consumer)
- F-4 — `scripts/generate-preset-parity-fixture.ts` `--psnr` / `--ssim` / `--max-failing-frames` flags (T-330 is the first preset PR to use them)
- T-323 — first `lowerThird` clipKind binding (clipKind-default `cnnClassicBinding`; T-330 sits beside as the fourth `lowerThird` consumer via `PRESET_ID_BINDINGS` override)
- T-325 — second `lowerThird` clipKind binding (first `PRESET_ID_BINDINGS` override `bbcReithDarkBinding`)
- T-326 — third `lowerThird` clipKind binding (second `PRESET_ID_BINDINGS` override `alJazeeraOrangeBinding`; T-330's primary template)
- T-360 — `PRESET_ID_BINDINGS` mechanism (T-330's binding path)
- T-330 — preset promotion + fourth `lowerThird` clipKind binding via `PRESET_ID_BINDINGS` override (this preset)

---
id: instagram-link-sticker
cluster: ctas
clipKind: socialMedia
source: docs/compass_artifact.md#instagram-stories-link-sticker
status: substantive
preferredFont:
  family: Instagram platform font (proprietary)
  license: platform-byo
fallbackFont:
  family: Inter
  weight: 500
  license: ofl
permissions: []
signOff:
  parityFixture: 'signed:2026-05-07'
  typeDesign: pending-cluster-batch
---

# Instagram Link Sticker — Stories CTA

## Visual tokens
- Rounded pill sticker, ~200 × 44 px native
- Color cycle: white-on-dark, dark-on-white, frosted-glass variant, brand-color variant — tap to cycle (in editor)
- Customizable text (default: destination domain)
- Free-form draggable placement on the Story frame
- Subtle shadow on contrasting backgrounds

### Substantive props (D-T371-1 / D-T371-2 / D-T371-4)

T-371 binds the `link-sticker` primitive (T-371a; shipped at main `8f7dbd4b`)
via the `PRESET_ID_BINDINGS` override path (Pattern C). Snapshot is
intentionally minimal — only the three REQUIRED fields (`label`, `variant`,
`position`). Every other knob (`phase`, `width`, `height`, `fontSize`,
`shimmer`, per-variant tokens) inherits the primitive default; re-declaring
them in the snapshot would be redundant noise.

| Field | Value | Source |
|---|---|---|
| `label` | `'instagram.com/yourhandle'` | D-T371-2 — domain-canon placeholder; does NOT encode a real handle |
| `variant` | `'white-on-dark'` | Stub line 43 default — black `#000000` backdrop, white `#FFFFFF` text, white shimmer-highlight |
| `position` | `{ x: 540, y: 338 }` | D-T371-4 — canvas-centered top-left on parity-CLI 1280 × 720 (`(1280-200)/2 = 540`; `(720-44)/2 = 338`) |

Inherited from primitive defaults (NOT in `INSTAGRAM_LINK_STICKER_PROPS`):
`phase: 'shimmering'` (always-shimmering canon), `width: 200`, `height: 44`
(rounded pill border-radius 22 px), `fontSize: 14` (lower bound of stub's
14–16 px range), `shimmer: { cycleFrames: ceil(fps * 3) = 90 at fps 30,
bandWidth: 40, highlightColor: '#FFFFFF' }`, variant tokens (`background`,
`textColor`, `shadowColor` from `VARIANT_TOKENS['white-on-dark']`).

At frame 60 with default `cycleFrames = 90`: phase progress
`60 / 90 ≈ 0.667`; `shimmerX = round(0.667 * 240 - 40) = 120`. Band lands
at `left = 540 + 120 = 660` (right portion of the pill; on-pill left=120,
right=160 within 200-px pill width). Captures the canonical mid-shimmer
register.

## Typography
- Instagram's proprietary system font, fallback to Inter Medium
- 14–16 px native
- Mixed case

### Substantive notes (D-T371-6 / D-T371-11-b)

The proprietary Instagram system font is `platform-byo` (consumer-wired);
v1 parity render uses **Inter Medium (OFL; registered via T-307)**. The
visual register (rounded pill + 14 px medium-weight glyphs) is captured
faithfully — only the typeface differs from the platform-canonical
Instagram font (D-T371-11-b documented divergence; NOT a T-371 fix). The
primitive's `fontRequirements()` returns `[{ family: 'Inter', weight: 500 }]`;
`auditMissingFallback()` does NOT flag this preset.

`signOff.typeDesign: 'pending-cluster-batch'` PRESERVED per D-T371-6 —
cluster `'ctas'` IS in `TYPE_DESIGN_REQUIRED_CLUSTERS` and `license:
'platform-byo'` does NOT short-circuit the gate (only `'na'` does). The
cluster-batch flip (`pending-cluster-batch` → `signed:<date>`) happens in
the Cluster G cluster-composer follow-up after all 5 presets sign their
parity goldens. T-371 is the LAST typography-carrying Cluster G preset to
sign — its parity sign-off here completes the precondition for the
cluster-composer flip.

## Animation
- No independent entry — sticker appears with the Story frame
- Subtle shimmer / highlight on text (3 s cycle, light sweep across glyphs)
- On tap: sticker depresses to 95% scale, 100 ms; expands a link-preview card from the bottom showing destination URL, 300 ms

### Substantive notes (D-T371-1 / D-T371-3 / D-T371-11-c)

v1 ships `phase: 'shimmering'` (primitive default) at frame 60 mid-shimmer.
Shimmer math is closed-form (`computeShimmerX(frame, cycleFrames, pillWidth,
bandWidth)` — frame-deterministic O(1)). `cycleFrames = ceil(fps * 3) = 90`
at fps 30; `bandWidth = 40`; `pillWidth = 200`. At frame 60: phase progress
`60 / 90 ≈ 0.667` → `shimmerX = round(0.667 * 240 - 40) = 120` (band on the
right portion of the pill; left=120, right=160 within 200-px pill width).

Tap-depress (95 % scale, 100 ms) + link-preview card (300 ms expansion)
NOT in v1 (T-371a-followup carve-out per D-T371-11-c). Reference frames
0 / 30 / 90 N/A under v1 single-frame infra (D-T371-5). Frosted-glass
`backdrop-filter: blur()` NOT in v1 (T-371a-blur carve-out — sealed at
opaque `#CCCCCC` overlay; T-371's snapshot uses `'white-on-dark'`,
avoiding this entirely). Other Story sticker types (Mention / Poll / GIF /
Question / Slider / Music) NOT in v1 (T-371a-extend carve-out).

## Rules
- Available to all accounts (post 10K-follower restriction removal). Always permitted; do not gate.
- Pill shape is the platform-recognizable signal; do not square it off.
- Place near the content's focal point, not the frame edge. Compass canon: this is the differentiator vs. the old swipe-up.
- Color variant should be chosen for legibility against the underlying media; default white-on-dark.

### Substantive notes (D-T371-11)

Three documented v1 cosmetic divergences from the stub register (flagged,
NOT fixed in T-371):

**(a) Center-canvas position instead of "near content's focal point"** —
Stub line 42 specifies "Place near the content's focal point, not the
frame edge". T-371 ships canvas-centered `{ x: 540, y: 338 }` per
D-T371-4. The parity golden's purpose is to lock the **visual register at
a canonical reference frame**, not to mimic real consumer placement. Real
consumer renders override `position` per their actual content.

**(b) Inter Medium fallback rendered instead of Instagram proprietary
font** — Stub line 30 specifies "Instagram's proprietary system font,
fallback to Inter Medium". The proprietary font is `platform-byo`
(consumer-wired); v1 parity render uses Inter Medium (OFL; registered via
T-307). Visual register is captured faithfully; only the typeface differs.

**(c) Stub-listed candidate frames `0 / 30 / 60 / 90` reduced to `60`
only** — Per D-T371-5: 0 is N/A (no entrance phase in T-371a v1; shimmer
band is off-left at `shimmerX = -40`); 30 is early-cycle (phase progress
0.333; off-canon for the mid-shimmer register); 60 is the canonical
mid-shimmer (selected); 90 is N/A (no post-tap depress in T-371a v1; AND
visually identical to frame 0 because the cycle wraps). Single-variant v1
mirrors T-369 / T-370 / T-372 / T-373 posture; multi-variant infra is a
T-359a-family follow-up.

All three divergences are documented in the PR body. T-371 inherits the
documented divergences as-is; it does NOT introduce them, does NOT widen
them, does NOT fix them.

## Acceptance (parity)
- Reference frames: 0 (sticker entering with frame), 30 (settled), 60 (mid-shimmer), 90 (post-tap depress)
- PSNR ≥ 42 dB, SSIM ≥ 0.98

### Substantive notes (D-T371-5 / D-T371-7)

**v1 ships frame 60 only.** The other listed candidates are annotated
under D-T371-11 (c) above. Threshold pin **42 dB / 0.98** is **cluster-norm**
(NOT preset-pinned 38 / 0.94 like T-372) — the `link-sticker` shimmer is a
smooth steady-state-icon register: no motion blur (the shimmer is a
linear-gradient sweep over a STATIC pill; only the band's `left` position
changes per frame), static glyph layout (label rendered once at `fontSize
= 14` Inter Medium; no per-frame glyph reflow), no per-frame color cycling
(shimmer highlight color is the fixed variant default `'#FFFFFF'`). The
stub explicitly pre-declares 42 / 0.98 at line 47. Written by the F-4 flag
set `--psnr=42 --ssim=0.98 --mark-signed` directly into `thresholds.json`;
no hand-edit post-generation.

## References
- `docs/compass_artifact.md` § Instagram Stories link sticker
- Sticker UX pattern democratizing what used to be 10K-follower-gated
- Gap clip T-371a (`LinkSticker`) — primitive shipped on main `8f7dbd4b`
- T-371 task spec (`docs/tasks/T-371.md`)
- ADR-004

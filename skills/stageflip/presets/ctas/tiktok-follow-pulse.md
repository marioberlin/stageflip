---
id: tiktok-follow-pulse
cluster: ctas
clipKind: followPrompt
source: docs/compass_artifact.md#tiktok-follow-prompt
status: substantive
preferredFont:
  family: TikTok Sans
  license: platform-byo
fallbackFont:
  family: Source Sans 3
  weight: 600
  license: ofl
permissions: []
signOff:
  parityFixture: 'signed:2026-05-07'
  typeDesign: pending-cluster-batch
---

# TikTok Follow Pulse — right-thumb-zone CTA

## Visual tokens
- Circular avatar: 40 × 40 px native
- "+" badge in TikTok Pink/Red `#FE2C55`
- Position: right side of vertical-video frame, vertically aligned with native Like / Comment / Share icons (~70% down from top)
- Touch target: 44 px diameter (iOS / Android minimum)
- Always present on a creator's video frame (no independent entry / exit)

### Substantive props (D-T370-1 / D-T370-4)

T-370 binds the `follow-prompt` primitive's `'tiktok'` discriminant (T-318
shipped at main `25bb0c09`) via the `PRESET_ID_BINDINGS` override path
(Pattern C). Snapshot is intentionally minimal — 3 fields only — because
brand canon dominates theme on the TikTok branch (D-T318-6); avatar surface
color, badge color, badge glyph color, font, size, pulseRepeat, and
showPulseRing are all inherited from `renderTiktok`'s hardcoded constants
and primitive defaults.

| Field | Value | Source |
|---|---|---|
| `platform` | `'tiktok'` | T-318 discriminator; first production consumer of this branch |
| `position.x` | `1180` | Right-thumb-zone anchor on the parity-CLI 1280×720 default canvas (1280 − ~100 right-margin = 1180) |
| `position.y` | `504` | Right-thumb-zone anchor (720 × 0.70 = 504; ~70% down from top) |
| `phase` | `'pulsing'` | Mid-pulse register per D-T370-1; renders the 30%-alpha expanding ring + decaying-scale avatar |

Inherited from primitive defaults (NOT in `TIKTOK_FOLLOW_PULSE_PROPS`):
white `#FFFFFF` avatar surface (`BRANDED_AVATAR_DEFAULT`), TikTok-Pink
`#FE2C55` "+" badge (`TIKTOK_PINK`; hardcoded — `props.badgeColor` is no-op
on the TikTok branch per D-T318-6), white `#FFFFFF` badge glyph
(`BRANDED_GLYPH_DEFAULT`), TikTok Sans 700 font (per-platform default
`TIKTOK_FONT_FAMILY` / `TIKTOK_FONT_WEIGHT`; falls back to OFL `Source Sans 3`
weight 600 in the FontManager preload), avatar size 40 px (`DEFAULT_SIZE`),
`pulseRepeat: 1` (single bounded cycle), `showPulseRing: true`, no avatar
monogram (`avatarText` omitted).

**v1 cosmetic divergences from the stub register** (D-T370-11; flagged,
NOT fixed in T-370): right-thumb-zone anchor is projected from a portrait
1080 × 1920 native frame onto the parity-CLI 1280 × 720 landscape canvas
(brand register is the avatar+badge+ring shape, NOT the literal mobile
thumb-reach geometry); the stub's candidate-frames list "0 / 30 / 60 / 90"
is reduced to "30 only" under T-318's cycle math (`cycleFrames = 45`,
`pulseRepeat = 1`).

## Typography
- N/A — icon-only CTA
- Optional algorithmic toast text "Follow [Creator]" in Source Sans 3 fallback, 14–16 pt

### Substantive notes (D-T370-1)

`renderTiktok` hardcodes `font-family: 'TikTok Sans, sans-serif'`,
`font-weight: 700` per `TIKTOK_FONT_FAMILY` / `TIKTOK_FONT_WEIGHT`
constants (T-318 lines 141–142). T-370 omits `font` from
`TIKTOK_FOLLOW_PULSE_PROPS`; the per-platform default applies. The avatar
text monogram (`avatarText`) is omitted — the brand register is icon-only
per stub line 30, so no glyph is rendered.

`TikTok Sans` ships as `platform-byo` (proprietary; tenant-supplied per
ADR-004 §D4). The OFL fallback `Source Sans 3` (weight 600) is the
adequate-fallback the type-design consultant evaluates in the cluster-G
batch review. The puppeteer renderer falls through to `Source Sans 3` when
TikTok Sans is unavailable in the FontManager preload; the v1 parity
golden is rendered with the OFL fallback (capturing a real TikTok-Sans
render is v2 territory once a tenant supplies the licensed font).

## Animation
- Subtle pulse when unfollowed: scale 1.0 → 1.05 → 1.0, 1500 ms cycle, 30% opacity ring expanding
- Follow confirmation: "+" morphs to checkmark with quick scale pop (1.0 → 1.2 → 1.0, 300 ms)
- Algorithmic toast: slides up from bottom after viewing multiple videos from the same creator, 400 ms (gated by tenant data)

### Substantive notes (D-T370-3 / D-T370-5)

v1 ships **single-cycle `'pulsing'`** (`pulseRepeat: 1` primitive default)
at the mid-pulse frame; the `'followed'` checkmark scale-pop is NOT in v1
(carve-out / future v2); the algorithmic toast is NOT in v1 (out-of-scope
per stub line 42 — opt-in per tenant; default off; toast composition is
external to the primitive).

The parity golden is captured at **frame 30**. At fps 30,
`cycleFrames = ceil(30 * 1.5) = 45`; `peakFrame = ceil(30 * 0.5) = 15`. Frame
30 is past peak (15) and inside the cycle (< 45) — `phaseFrame = 30 % 45 = 30`.
The avatar scale interpolates `[0, 15, 45] → [1, 1.05, 1]` with cubic-bezier
ease — at frame 30, `avatarScale ≈ 1.025` (mid-decay from peak back to
baseline). The pulse ring at frame 30 has `radiusFactor ≈ 1.33`
(interpolating `[0, 45] → [1, 1.5]`) and `opacity ≈ 0.10`
(interpolating `[0, 45] → [0.3, 0]`). Captures the visually canonical
mid-pulse register: avatar mid-pulse + visible expanding pulse ring +
TikTok-Pink "+" badge.

Multi-cycle `pulseRepeat > 1` deferred (sustained-attention pulses are a
future `T-370b` carve-out OR a separate `tiktok-follow-pulse-sustained`
v2 preset); per-creator avatar images deferred (out of T-318 scope — the
primitive renders a flat color surface + optional monogram, not images).

## Rules
- Right-thumb zone placement is non-negotiable on vertical video. 67% of mobile users scroll right-thumb (UX canon); the CTA must be reachable.
- Single tap with no confirmation. Don't add an "are you sure?" — friction kills conversion.
- Always-present, no entry — the pulse animation is the only attention mechanism.
- Algorithmic toast is opt-in per tenant; default off.

### Substantive notes (D-T370-11)

The right-thumb-zone is conceptual on the parity-CLI 1280 × 720 landscape
canvas — TikTok native is 1080 × 1920 portrait. T-370 anchors at
`(1180, 504)` to project the right-thumb-zone shape onto landscape with a
canvas-safe inset (~100 px right margin, ~196 px bottom clearance). The
brand-register identity is the **shape** (white avatar + pink "+" badge +
expanding ring + right-side anchor), NOT the literal mobile thumb-reach
geometry. A future v2 multi-canvas preset could ship dual goldens
(landscape parity canvas + portrait `1080 × 1920` parity canvas) once
parity-CLI multi-canvas infra exists; not in v1.

## Acceptance (parity)
- Reference frames: 0 (start of pulse), 30 (mid-pulse), 60 (end of pulse), 90 (post-follow checkmark)
- PSNR ≥ 42 dB, SSIM ≥ 0.98

### Substantive notes (D-T370-5 / D-T370-7)

**v1 ships frame 30 only.** Under T-318's cycle math (fps 30,
`cycleFrames = 45`, `pulseRepeat = 1`, `totalFrames = 45`):

- **Frame 0** understates the brand register — ring at minimum radius
  (`radiusFactor = 1.0`) and full opacity (0.30) but the ring is the same
  size as the avatar so the expanding-ring visual is invisible.
- **Frame 30** is the canonical mid-decay register — avatar mid-pulse
  (`avatarScale ≈ 1.025`); visible expanding ring (`radiusFactor ≈ 1.33`,
  `opacity ≈ 0.10`).
- **Frame 60** is past `totalFrames = 45` — `computeAvatarScale` returns
  1.00 (settled); `computePulseRing` returns `null` (cycle over). Equivalent
  to `'idle'` phase; useless as a `'pulsing'` register.
- **Frame 90** is the `'followed'` post-follow checkmark which is
  out-of-scope per D-T370-3.

T-370 OVERRIDES the cluster-norm `--frame=60` to `--frame=30`. Document
this divergence in the PR body.

Threshold pin 42 dB / 0.98 matches the cross-cluster cluster-norm written
by the F-4 flag set `--psnr=42 --ssim=0.98 --mark-signed` directly into
`thresholds.json` — no hand-edit post-generation.

## References
- `docs/compass_artifact.md` § TikTok follow prompt
- BJ Fogg behavior model: low ability + high motivation + clear trigger
- Gap clip T-318 (`FollowPrompt`) — primitive shipped on main `25bb0c09`
- T-370 task spec (`docs/tasks/T-370.md`)
- ADR-004

---
id: coinbase-dvd-qr
cluster: ctas
clipKind: qrCodeBounce
source: docs/compass_artifact.md#coinbase-super-bowl-qr-code
status: substantive
preferredFont:
  family: N/A
  license: na
fallbackFont:
  family: N/A
  weight: 0
  license: na
permissions: []
signOff:
  parityFixture: 'signed:2026-05-07'
  typeDesign: na
---

# Coinbase DVD QR — zero-context curiosity gap

## Visual tokens
- Standard QR code on pure black `#000000` background
- **Zero branding, zero text, zero context**
- Color-shifts through rainbow hues throughout the bounce
- ~20–25% of TV screen
- Deliberately evokes the "bouncing DVD screensaver"
- No watermark, no logo, no caption

### Substantive props (D-T372-1 / D-T372-2 / D-T372-3 / D-T372-4)

T-372 binds the `qr-code-bounce` primitive (T-319 shipped at main `4d0879c8`)
via the `PRESET_ID_BINDINGS` override path (Pattern C). Snapshot is
intentionally minimal — only the two REQUIRED fields (`qrMatrix`, `bounce`).
Every other knob (`sizePercent`, `colorCycle`, `background`,
`lightModuleColor`) inherits the primitive default (`22` / rainbow @ 7 s
cycle / `#000000` / `#FFFFFF`); re-declaring them in the snapshot would be
redundant noise.

| Field | Value | Source |
|---|---|---|
| `qrMatrix` | 21×21 synthetic Version 1 placeholder | D-T372-2 — three corner finder patterns + timing patterns + arbitrary data bits; does NOT encode any real URL |
| `bounce.startPosition` | `{ x: 0, y: 0 }` | Top-left corner anchor (D-T372-1) |
| `bounce.startVelocity` | `{ vx: 8, vy: 6 }` | Mid-flight at frame 60 (D-T372-3); 4× the stub's stated 1.3–2.0 px/frame floor |

Inherited from primitive defaults (NOT in `COINBASE_DVD_QR_PROPS`): pure-black
`#000000` backdrop (`DEFAULT_BACKGROUND`; zero-brand canon dominates theme),
white `#FFFFFF` light modules (`DEFAULT_LIGHT_MODULE_COLOR`; intentionally
NOT theme-bound per T-319 D-T319-7 to preserve QR scannability), 22 %
canvas-min-dimension size (`DEFAULT_SIZE_PERCENT` → `rectSize ≈ 158 px` on
the parity-CLI 1280 × 720 canvas), rainbow HSL hue cycle
(`palette: 'rainbow'`, `cycleFrames = ceil(fps * 7) = 210` at fps 30; mid of
the 6–8 s canon).

At frame 60 with the snapshot velocities: position ≈ `(480, 360)` —
center-canvas, still in first leg (no rebound yet — `spanX = 1122`,
`spanY = 562`). Hue ≈ `60 / 210 * 360 ≈ 102.86°` (yellow-green) →
`darkColor ≈ #7BFF00` per HSL→RGB conversion. Captures the canonical
mid-bounce + mid-rainbow register.

## Typography
- N/A — icon-only

### Substantive notes (D-T372-6)

The `coinbase-dvd-qr` preset is **genuinely text-free** — no glyphs render
in the primitive (T-319 D-T319-8 declares no `fontRequirements`; QR is a
pixel-grid, not text). `preferredFont.license: 'na'` and
`fallbackFont.license: 'na'` stay; `signOff.typeDesign: na` stays per the
integrity-gate short-circuit at `license: 'na'` (verified
`scripts/check-preset-integrity.ts` line 580). T-372 does NOT participate
in the Cluster G type-design batch review — there is no font to review.

## Animation
- Continuous bounce around screen (DVD-screensaver canon)
- Speed: moderate enough to allow scanning while in motion (40–60 px/s)
- Color modules cycle smoothly through rainbow palette, 6–8 s cycle
- 60-second commercial duration is the canonical use case
- Bounces preserve angle of incidence at edges (rebound physics)

### Substantive notes (D-T372-3 / D-T372-5)

v1 ships **rainbow `colorCycle`** (`palette: 'rainbow'` primitive default;
`cycleFrames = ceil(fps * 7) = 210` at fps 30; mid of the 6–8 s stub
range) at **frame 60** — first-leg mid-flight + mid-rainbow. The bounce
math is closed-form (`computeBouncePosition` triangle-wave fold; no
iterative collision detection — frame-deterministic O(1)). At frame 60
with `startVelocity: { vx: 8, vy: 6 }` and `startPosition: { x: 0, y: 0 }`,
position lands at `(480, 360)` — center-canvas, no rebound yet.

Multi-frame goldens (stub-listed candidates `0 / 60 / 120 / 180`) NOT in
v1 (D-T372-5; multi-variant infra is a T-359a-family follow-up). Branded
variant (logo overlay) NOT in v1 (T-319b carve-out). Custom palettes
(`'mono'` / `'theme'` / explicit array) NOT in v1 (T-319c carve-out;
sealed at `'rainbow'`).

## Rules
- ZERO branding is the point. Every brand element added kills the curiosity gap. Coinbase Super Bowl LVI: 20M scans in 60 s by trusting absence.
- The QR code itself must be valid and scannable in motion — render it at sufficient size and contrast.
- Speed must allow scanning — too fast and viewers can't catch it; too slow and the bouncing feels tedious.
- Use this register for attention-max moments (Super Bowl, premiere events, viral campaigns). For routine CTAs, use a branded QR variant.

### Substantive notes (D-T372-11)

Three documented v1 cosmetic divergences from the stub register (flagged,
NOT fixed in T-372):

**(a) Synthetic placeholder QR matrix instead of a real URL encoding** —
The Coinbase Super Bowl LVI campaign used a real tracking URL. T-372
ships a synthetic 21 × 21 Version 1 placeholder matrix (D-T372-2) that
does NOT encode any real URL. The brand-register identity is the
**bouncing-rainbow-QR shape**, not a literal scannable URL; the parity
test only cares about the rendered pixel pattern. Live URL→matrix encoding
is T-319a territory (carved out of T-319 v1).

**(b) Velocity 4× faster than the stub's stated 40–60 px/s** — Stub line
36 specifies "40–60 px/s allows scanning while in motion" = 1.3–2.0
px/frame at fps 30. T-372 ships `vx: 8, vy: 6` = 240 / 180 px/s
(D-T372-3). At stub velocities, frame 60 lands at `(120, 120)` — top-left
adjacency, visually understated as "mid-bounce". The parity golden's job
is to lock the **visual register at frame 60**, not the consumer-facing
scan rate. Real consumer renders override `startVelocity` per their
broadcast spot.

**(c) Stub-listed candidate frames `0 / 60 / 120 / 180` reduced to `60`
only** — Per D-T372-5: 0 is corner-static (not mid-flight); 120 is
post-y-rebound (competing signal); 180 is post-x-rebound +
color-cycle-midpoint (competing signals). Single-variant v1 mirrors
T-369 / T-370 / T-373 posture; multi-variant infra is a T-359a-family
follow-up.

## Acceptance (parity)
- Reference frames: 0 (top-left position), 60 (mid-bounce), 120 (rebound off edge), 180 (color cycle midpoint)
- PSNR ≥ 38 dB (motion blur reduces precision), SSIM ≥ 0.94

### Substantive notes (D-T372-5 / D-T372-7)

**v1 ships frame 60 only.** The other listed candidates are annotated
under D-T372-11 (c) above. Threshold pin **38 dB / 0.94** is
preset-pinned (NOT cluster-norm 42 / 0.98) per stub line 48 — written by
the F-4 flag set `--psnr=38 --ssim=0.94 --mark-signed` directly into
`thresholds.json`; no hand-edit post-generation. The motion blur of the
bouncing QR + per-frame HSL hue cycling reduces parity precision below
the steady-state-icon range that 42 / 0.98 assumes; the stub
pre-declared the divergence with rationale ("motion blur reduces
precision"). T-372 is the **first non-cluster-norm parity threshold pin
in Phase 13**.

## References
- `docs/compass_artifact.md` § Coinbase Super Bowl QR code
- 20M+ landing page hits in 60 s; jumped from #186 to #2 on App Store
- Gap clip T-319 (`QRCodeBounce`) — primitive shipped on main `4d0879c8`
- T-372 task spec (`docs/tasks/T-372.md`)
- ADR-004

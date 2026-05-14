---
id: youtube-subscribe-bounce
cluster: ctas
clipKind: subscribeButton
source: docs/compass_artifact.md#youtube-subscribe-button-animation
status: substantive
preferredFont:
  family: Roboto
  license: apache-2.0
fallbackFont:
  family: Roboto
  weight: 500
  license: apache-2.0
permissions: []
signOff:
  parityFixture: 'signed:2026-05-07'
  typeDesign: 'signed:2026-05-14'
---

# YouTube Subscribe Bounce — native CTA

## Visual tokens

- Rounded pill button matching YouTube's native UI (border-radius: 8 px @ 1080p)
- YouTube Red `#FF0000`
- Text: white `#FFFFFF`, "SUBSCRIBE"
- After "click": gray `#AAAAAA` background with "SUBSCRIBED"
- Bell icon (white) appears post-subscribe
- Animated mouse cursor
- Position: lower-right or lower-left, ~15–20% of screen width
- Subtle drop shadow (0 / 4 px / 8 px blur, 20% opacity black)

### Substantive props (D-T369-1 / D-T369-4)

T-369 binds the `subscribe-button` primitive's `'youtube'` discriminant (T-317
shipped at main `1cc4da93`) via the `PRESET_ID_BINDINGS` override path
(Pattern C). Snapshot is intentionally minimal — 3 fields only — because
brand canon dominates theme on the YouTube branch (D-T317-6); chrome / text
color / font / border-radius / drop shadow are inherited from
`renderYoutube`'s hardcoded constants.

| Field | Value | Source |
|---|---|---|
| `platform` | `'youtube'` | T-317 discriminator; first production consumer of this branch |
| `position.x` | `1040` | Lower-right anchor on the parity-CLI 1280×720 default canvas (1280 − ~180 button-width − ~60 right-margin) |
| `position.y` | `640` | Lower-right anchor (720 − ~40 button-height − ~40 bottom-margin) |
| `label` | `'SUBSCRIBE'` | YouTube CTA canon; force-uppercased by `renderYoutube` regardless of `casing` |

Inherited from primitive defaults (NOT in `YOUTUBE_SUBSCRIBE_BOUNCE_PROPS`):
YouTube-Red `#FF0000` background, white `#FFFFFF` foreground, Roboto Medium
500 @ 18 px, border-radius 8 px, drop shadow `0 4px 8px rgba(0,0,0,0.20)`,
phase `'idle'` (entrance bounce settled), no bell glyph (idle phase), no
cursor glyph (`showCursor` absent).

**v1 cosmetic divergences from this register** (D-T369-11; flagged, NOT
fixed in T-369): bell glyph in `'subscribed'` phase renders **statically**
(no rotation interpolation) — `T-317a` carve-out; cursor glyph in
`'pressing'` phase renders **statically** (no slide-in) — `T-317b` carve-out;
the YouTube branch force-uppercases the label regardless of the schema-level
`casing` prop (T-317 D-T317-8 contract; documented).

## Typography

- Roboto Medium (500), 18 px native size — scales with screen
- "SUBSCRIBE" / "SUBSCRIBED": ALL CAPS
- Native YouTube UI canon — no other type choice

### Substantive notes (D-T369-1)

`renderYoutube` hardcodes `font-family: 'Roboto, sans-serif'`,
`font-weight: 500`, `font-size: 18` per `YOUTUBE_FONT_FAMILY` /
`YOUTUBE_FONT_WEIGHT` / `YOUTUBE_FONT_SIZE` constants (T-317 lines 151–153).
T-369 inherits all three; `font` is NOT included in
`YOUTUBE_SUBSCRIBE_BOUNCE_PROPS`. The `casing` prop is no-op on YouTube
(line 385: `label = cased.toUpperCase()`); the snapshot label `'SUBSCRIBE'`
is already uppercase ASCII so the force-uppercase has no observable effect
on the parity golden — but the contract divergence is documented as
D-T369-11-c.

`Roboto` ships under Apache License 2.0 via Google Fonts; whitelisted in
`packages/schema/src/presets/font-registry.ts` once the preset corpus
indexes it. No proprietary-byo escape hatch needed — Roboto IS the
canonical YouTube typeface AND is open-source.

## Animation

- Entry: scale 0% → 100% with bounce overshoot to 110%, 400–600 ms
- Animated cursor slides in (~600 ms), hovers, "clicks" the button (red → gray transition, 250 ms)
- Bell icon: clicked, wiggles 2–3 times (rotation ±15° over 350 ms)
- Total sequence: 3–6 s
- Exit: fades out or slides down, 300 ms
- Recommended placement: 10–15 s into video

### Substantive notes (D-T369-3)

v1 ships **steady-state pre-press only** at the post-bounce-settle frame.
The entrance bounce IS rendered at runtime — `computeScale` (T-317 lines
217–239) interpolates frame=0 scale=0 → frame=ceil(fps\*0.30)=9 scale=1.10 →
frame=ceil(fps\*0.50)=15 scale=1.00 with `BOUNCE_EASING` and
`extrapolateRight: 'clamp'` — but the parity golden is captured at frame 60
(well past settle), so the bounce is COMPLETE in the snapshot (scale 1.00,
byte-identical to a true static render).

Bell-wiggle (`T-317a` carve-out) and cursor-slide-in (`T-317b` carve-out)
are NOT in v1. Post-press multi-variant (frame 12 settled / frame 36
cursor-on-button / frame 48 post-click gray) deferred — would need
multi-variant infra (T-359a-family follow-up) OR a separate
`youtube-subscribed-bounce` v2 preset. Single-variant v1 mirrors T-333 /
T-336 / T-339a posture.

## Rules

- Mimicry of native YouTube UI is the mechanism — do NOT redesign to match brand. The familiar UI is the conversion.
- Animated cursor is the demonstration; without it, viewers don't see the action modeled. Mandatory.
- Bell-wiggle animation is part of the sequence (post-2018 canon for notifications).
- Place at 10–15 s mark; earlier feels desperate, later misses uncommitted viewers.

## Acceptance (parity)

- Reference frame: **60** (steady-state post-bounce-settle; D-T369-5)
- PSNR ≥ 42 dB, SSIM ≥ 0.98 (cluster-norm pin written directly by F-4 flags `--psnr=42 --ssim=0.98`; D-T369-7)

### Substantive notes (D-T369-5 / D-T369-7)

The stub's candidate frame list (0 / 12 / 36 / 48) is reduced to a single
canonical mid-hold at frame 60. Frame 0 is invisible (scale 0); frames 12 /
36 / 48 require non-`'idle'` phases and/or `showCursor: true` — both deferred
per D-T369-3 / D-T369-11. Frame 60 is well past the bounce-settle frame
(`ceil(30 * 0.5) = 15`), so any post-settle frame produces an identical
render. Matches the cluster-norm convention (T-333 / T-334 / T-335 / T-336 /
T-337 / T-338 / T-339 / T-339a / T-323 / T-325 / T-326 / T-327 / T-328 /
T-329 / T-330 all use frame 60) and `--frame=60` is the operator-default.

Threshold pin 42 dB / 0.98 matches the cross-cluster cluster-norm written
by the F-4 flag set `--psnr=42 --ssim=0.98 --mark-signed` directly into
`thresholds.json` — no hand-edit post-generation.

## References

- `docs/compass_artifact.md` § YouTube subscribe button animation
- Gap clip T-317 (`SubscribeButton`) — primitive shipped on main `1cc4da93`
- T-317a (carved-out bell-wiggle animation)
- T-317b (carved-out cursor-slide-in / click choreography)
- T-369 task spec (`docs/tasks/T-369.md`)
- ADR-004
